/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'fs';
import path from 'path';
import { mergeTypeDefs } from '@graphql-tools/merge';
import type { AWS } from '@serverless/typescript';
import {
  AmplifyAppSyncAuthenticationProviderConfig,
  AmplifyAppSyncSimulator,
  AmplifyAppSyncSimulatorAuthenticationType as AuthTypes,
  AmplifyAppSyncSimulatorConfig,
  AppSyncSimulatorFunctionsConfig,
  AppSyncSimulatorPipelineResolverConfig,
  AppSyncSimulatorUnitResolverConfig,
  RESOLVER_KIND,
} from 'amplify-appsync-simulator';
import { Lambda } from 'aws-sdk';
import NodeEvaluator from 'cfn-resolver-lib';
import { get, merge, reduce } from 'lodash';
import {
  DEFAULT_ENCODING,
  DEFAULT_SCHEMA_FILE,
  HTTPMessage,
} from './constants';
import { getAppSyncConfig } from './getAppSyncConfig';
import { AppSyncConfigInput } from './types/appSync';
import {
  AppSyncConfig,
  Auth,
  DataSourceConfig,
  PipelineFunctionConfig,
  ResolverConfig,
} from './types/plugin';
import { DeepResolved } from './types/resolved';
import { nonNullable } from './types/utils';
import { getFileMap, globFilePaths } from './utils';

export type Config = DeepResolved<AppSyncConfig>;

export interface Simulator {
  amplifySimulator: AmplifyAppSyncSimulator;
  name: string;
}

const directLambdaMappingTemplates = {
  request: `## Direct lambda request
  {
      "version": "2018-05-29",
      "operation": "Invoke",
      "payload": $utils.toJson($context)
  }
  `,
  response: `## Direct lambda response
  #if($ctx.error)
      $util.error($ctx.error.message, $ctx.error.type, $ctx.result)
  #end
  $util.toJson($ctx.result)
  `,
};

const resolverPathMap: Record<string, string> = {
  'AWS::DynamoDB::Table': 'Properties.TableName',
  'AWS::S3::Bucket': 'Properties.BucketName',
};

interface ResourceResolvers {
  RefResolvers: any;
  'Fn::GetAttResolvers': any;
  'Fn::ImportValueResolvers': any;
}

let logger: (message: string, opts?: Record<string, any>) => void;
export function setLogger(newLogger: typeof logger) {
  logger = newLogger;
}

export async function resolveConfiguration(
  service: AWS,
  appSyncConfig: AppSyncConfigInput,
  cliOptions: Record<string, unknown>,
): Promise<{
  config: Config;
  options: Record<string, any>;
  simulator: Simulator;
}> {
  const originalConfig = getAppSyncConfig(appSyncConfig);
  const options = buildResolvedOptions(service);
  const resourceResolvers = buildResourceResolvers(service, options);
  service.functions = resolveResources(
    service.functions,
    service.resources,
    resourceResolvers,
  );
  service.provider.environment = resolveResources(
    service.provider.environment,
    service.resources,
    resourceResolvers,
  );
  const config = resolveResources(
    originalConfig,
    service.resources,
    resourceResolvers,
  );

  const simulator = {
    amplifySimulator: await startIndividualServer(options.port, options.wsPort),
    name: config.name,
  };

  options.lambdaPort = getLambdaPort(service, cliOptions);

  return { config, options, simulator };
}

function buildResolvedOptions(service: AWS): Record<string, any> {
  const options: Record<string, any> = merge(
    {
      apiKey: '0123456789',
      port: 20002,
      wsPort: 20003,
      location: '.',
      refMap: {},
      getAttMap: {},
      importValueMap: {},
      rds: {},
      dynamoDb: {
        endpoint: `http://localhost:${get(
          service,
          'custom.dynamodb.start.port',
          8000,
        )}`,
        region: 'localhost',
        accessKeyId: 'DEFAULT_ACCESS_KEY',
        secretAccessKey: 'DEFAULT_SECRET',
      },
      openSearch: {},
    },
    get(service, 'custom.appsync-simulator', {}),
  );
  options.watch ??= ['*.graphql', '*.vtl'];
  return options;
}

function buildResourceResolvers(
  service: AWS,
  options: Record<string, any>,
): ResourceResolvers {
  const refResolvers = reduce(
    service.resources?.Resources ?? {},
    (acc, res, name) => {
      const path = resolverPathMap[res.Type];
      if (path !== undefined) {
        return { ...acc, [name]: get(res, path, null) };
      }
      return acc;
    },
    {},
  );

  const keyValueArrayToObject = (mapping: any) => {
    if (Array.isArray(mapping)) {
      return mapping.reduce(
        (acc, { key, value }) => ({ ...acc, [key]: value }),
        {},
      );
    }
    return mapping;
  };

  return {
    RefResolvers: {
      ...refResolvers,
      ...keyValueArrayToObject(options.refMap),
      // Add region for cfn-resolver-lib GetAZs
      'AWS::Region': service.provider.region,
    },
    'Fn::GetAttResolvers': keyValueArrayToObject(options.getAttMap),
    'Fn::ImportValueResolvers': keyValueArrayToObject(options.importValueMap),
  };
}

async function startIndividualServer(
  port: number | undefined,
  wsPort: number | undefined,
) {
  const simulator = new AmplifyAppSyncSimulator({ port, wsPort });
  await simulator.start();
  return simulator;
}

function getLambdaPort(
  service: AWS,
  cliOptions: Record<string, unknown>,
): number {
  // Default serverless-offline lambdaPort is 3002
  let port = 3002;
  const offlineConfig = service.custom?.['serverless-offline'];
  // Check if the user has defined a specific port as part of their serverless.yml
  if (
    offlineConfig != undefined &&
    typeof offlineConfig === 'object' &&
    'lambdaPort' in offlineConfig
  ) {
    port = offlineConfig.lambdaPort as number;
  }
  // Check to see if a port override was specified as part of the CLI arguments
  if (cliOptions != undefined && cliOptions.lambdaPort != undefined) {
    port = cliOptions.lambdaPort as number;
  }
  return port;
}

/**
 * Resolves resources through `Ref:` or `Fn:GetAtt`
 */
function resolveResources<T>(
  toBeResolved: T,
  resources: AWS['resources'],
  resourceResolvers: ResourceResolvers,
): DeepResolved<T> {
  // Pass all resources to allow Fn::GetAtt and Conditions resolution
  const node = {
    ...resources,
    toBeResolved,
    Parameters: {},
  };
  const evaluator = new NodeEvaluator(node, resourceResolvers);
  const result = evaluator.evaluateNodes();
  if (result && result.toBeResolved) {
    return result.toBeResolved;
  }
  return toBeResolved as DeepResolved<T>;
}

export function buildAmplifyConfig(
  config: Config,
  service: AWS,
  options: Record<string, any>,
  servicePath: string,
): AmplifyAppSyncSimulatorConfig {
  const appSync = {
    name: config.name,
    apiKey: options.apiKey,
    defaultAuthenticationType: buildAuthType(config.authentication),
    additionalAuthenticationProviders: (
      config.additionalAuthentications || []
    ).map(buildAuthType),
  };

  // Load the schema. If multiple provided, merge them
  const schemaPaths = Array.isArray(config.schema)
    ? config.schema
    : [config.schema || DEFAULT_SCHEMA_FILE];
  const basePath = servicePath;
  const schemas = globFilePaths(basePath, schemaPaths).map((schemaPath) =>
    getFileMap(basePath, schemaPath),
  );
  const schema = {
    path: schemas[0]?.path,
    content: mergeTypeDefs(
      schemas.map((s) => s.content),
      {
        useSchemaDefinition: true,
        forceSchemaDefinition: true,
        throwOnConflict: true,
        commentDescriptions: true,
        reverseDirectives: true,
      },
    ),
  };

  return {
    appSync,
    schema,
    resolvers: Object.values(config.resolvers)
      .map((r) => buildResolver(r, config, servicePath))
      .filter(nonNullable),
    functions: Object.values(config.pipelineFunctions).map(buildFunction),
    dataSources: Object.values(config.dataSources)
      .map((d) => buildDataSource(d, service, options))
      .filter(nonNullable),
  };
}

function buildAuthType(
  auth: DeepResolved<Auth>,
): AmplifyAppSyncAuthenticationProviderConfig {
  const authenticationType = auth.type;
  switch (authenticationType) {
    case AuthTypes.AMAZON_COGNITO_USER_POOLS:
      return {
        authenticationType: AuthTypes.AMAZON_COGNITO_USER_POOLS,
        cognitoUserPoolConfig: {
          AppIdClientRegex: auth.config.appIdClientRegex,
        },
      };
    case AuthTypes.OPENID_CONNECT:
      return {
        authenticationType: AuthTypes.OPENID_CONNECT,
        openIDConnectConfig: {
          Issuer: auth.config.issuer,
          ClientId: auth.config.clientId,
        },
      };
    case AuthTypes.API_KEY:
      return {
        authenticationType: AuthTypes.API_KEY,
      };
    case AuthTypes.AWS_IAM:
      return {
        authenticationType: AuthTypes.AWS_IAM,
      };
    case AuthTypes.AWS_LAMBDA:
      return {
        authenticationType: AuthTypes.AWS_LAMBDA,
        lambdaAuthorizerConfig: {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          AuthorizerUri: auth.config.identityValidationExpression!,
          AuthorizerResultTtlInSeconds:
            auth.config.authorizerResultTtlInSeconds,
        },
      };
    default:
      throw new Error(`Unknown authentication type: ${authenticationType}`);
  }
}

function buildResolver(
  resolver: DeepResolved<ResolverConfig>,
  config: Config,
  servicePath: string,
):
  | AppSyncSimulatorUnitResolverConfig
  | AppSyncSimulatorPipelineResolverConfig
  | undefined {
  switch (resolver.kind) {
    case RESOLVER_KIND.UNIT:
      return {
        kind: RESOLVER_KIND.UNIT,
        fieldName: resolver.field,
        typeName: resolver.type,
        dataSourceName: resolver.dataSource,
        requestMappingTemplate: buildMappingTemplate(
          resolver,
          'request',
          config,
          servicePath,
        ),
        responseMappingTemplate: buildMappingTemplate(
          resolver,
          'response',
          config,
          servicePath,
        ),
      };
    case RESOLVER_KIND.PIPELINE:
      return {
        kind: RESOLVER_KIND.PIPELINE,
        fieldName: resolver.field,
        typeName: resolver.type,
        functions: resolver.functions,
        requestMappingTemplate: buildMappingTemplate(
          resolver,
          'request',
          config,
          servicePath,
        ),
        responseMappingTemplate: buildMappingTemplate(
          resolver,
          'response',
          config,
          servicePath,
        ),
      };
    default:
      return undefined;
  }
}

function buildFunction(
  config: DeepResolved<PipelineFunctionConfig>,
): AppSyncSimulatorFunctionsConfig {
  return {
    name: config.name,
    dataSourceName: config.dataSource,
    requestMappingTemplateLocation: config.request ?? '',
    responseMappingTemplateLocation: config.response ?? '',
  };
}

function buildMappingTemplate(
  resolver: DeepResolved<ResolverConfig | PipelineFunctionConfig>,
  type: HTTPMessage,
  config: Config,
  servicePath: string,
) {
  const { substitutions = {} } = resolver;
  const templatePath = resolver[type];

  // Direct lambda
  // For direct lambdas, we use a default mapping template
  // See https://amzn.to/3ncV3Dz
  if (!templatePath) {
    return directLambdaMappingTemplates[type];
  } else {
    let mappingTemplate = readFileSync(path.join(servicePath, templatePath), {
      encoding: DEFAULT_ENCODING,
    });
    // Substitutions
    const allSubstitutions = {
      ...config.substitutions,
      ...substitutions,
    };
    for (const [variable, value] of Object.entries(allSubstitutions)) {
      const regExp = new RegExp(`\\$\{?${variable}}?`, 'g');
      mappingTemplate = mappingTemplate.replace(regExp, value);
    }
    return mappingTemplate;
  }
}

function buildDataSource(
  source: DeepResolved<DataSourceConfig>,
  service: AWS,
  options: Record<string, any>,
) {
  if (source.name === undefined || source.type === undefined) {
    return null;
  }

  const dataSource = {
    name: source.name,
    type: source.type,
  };

  switch (source.type) {
    case 'AMAZON_DYNAMODB': {
      return {
        ...dataSource,
        config: {
          ...options.dynamoDb,
          tableName: source.config.tableName,
        },
      };
    }
    case 'RELATIONAL_DATABASE': {
      return {
        ...dataSource,
        rds: options.rds,
      };
    }
    case 'AWS_LAMBDA': {
      const func = ((config) => {
        if ('functionName' in config) {
          const name = config.functionName;
          return options.functions?.[name] || service.functions?.[name];
        } else if ('function' in config) {
          return config.function;
        } else if ('functionArn' in config) {
          // return config.functionArn;
          logger('On DataSource, using functionArn pattern is not supported.', {
            color: 'orange',
          });
        }
        return null;
      })(source.config);
      if (func == null) {
        logger(`The ${source.name} function is not defined`, {
          color: 'orange',
        });
        return null;
      }

      const lambda = new Lambda({
        apiVersion: '2015-03-31',
        region: 'localhost',
        endpoint: `http://localhost:${options.lambdaPort as number}`,
      });
      return {
        ...dataSource,
        invoke: async (payload: any) => {
          const params: Lambda.InvocationRequest = {
            FunctionName: func.name,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(payload),
          };
          const result = await lambda.invoke(params).promise();
          if (result.StatusCode !== 200) {
            throw new Error(
              `Request failed with status code ${result.StatusCode ?? ''}`,
            );
          }
          if (result.FunctionError) {
            const s = result.Payload?.toLocaleString();
            if (s != null) {
              const data = JSON.parse(s);
              throw {
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                type: `Lambda:${data.errorType}`,
                message: data.errorMessage,
              };
            } else {
              throw new Error(result.FunctionError);
            }
          }
          const s = result.Payload?.toLocaleString();
          if (s == null) {
            return null;
          } else {
            return JSON.parse(s);
          }
        },
      };
    }
    case 'AMAZON_OPENSEARCH_SERVICE':
      return {
        ...options.openSearch,
        ...dataSource,
        endpoint: source.config.endpoint,
      };
    case 'HTTP': {
      return {
        ...dataSource,
        endpoint: source.config.endpoint,
      };
    }
    default:
      return dataSource;
  }
}
