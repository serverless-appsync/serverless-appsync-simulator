import {
  addDataLoader,
  AmplifyAppSyncAuthenticationProviderConfig,
  AmplifyAppSyncSimulator,
  AmplifyAppSyncSimulatorAuthenticationType as AuthTypes,
  AmplifyAppSyncSimulatorConfig,
  AppSyncSimulatorDataSourceType,
  AppSyncSimulatorFunctionsConfig,
  AppSyncSimulatorPipelineResolverConfig,
  AppSyncSimulatorUnitResolverConfig,
  removeDataLoader,
  RESOLVER_KIND,
} from 'amplify-appsync-simulator';
import { inspect } from 'util';
import { defaults, get, merge, reduce } from 'lodash';
import NodeEvaluator from 'cfn-resolver-lib';
import { Hook } from 'serverless';
import ElasticDataLoader from './data-loaders/ElasticDataLoader';
import watchman from 'fb-watchman';
import Serverless from 'serverless/lib/Serverless';
import { getAppSyncConfig } from './getAppSyncConfig';
import {
  AppSyncConfig,
  Auth,
  DataSourceConfig,
  PipelineFunctionConfig,
  ResolverConfig,
} from './types/plugin';
import { getFileMap, globFilePaths } from './utils';
import {
  DEFAULT_ENCODING,
  DEFAULT_SCHEMA_FILE,
  HTTPMessage,
} from './constants';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { DeepResolved } from './types/resolved';
import { nonNullable } from './types/utils';
import { readFileSync } from 'fs';
import path from 'path';
import { Lambda } from 'aws-sdk';

const resolverPathMap: Record<string, string> = {
  'AWS::DynamoDB::Table': 'Properties.TableName',
  'AWS::S3::Bucket': 'Properties.BucketName',
};

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

type Config = DeepResolved<AppSyncConfig>;

class ServerlessAppSyncSimulator {
  private serverless: Serverless;
  private options: Record<string, any> = {};
  private originalConfig: AppSyncConfig;
  private config!: Config;
  private simulator?: {
    amplifySimulator: AmplifyAppSyncSimulator;
    name: string;
  };
  private resourceResolvers?: {
    RefResolvers: any;
    'Fn::GetAttResolvers': any;
    'Fn::ImportValueResolvers': any;
  };

  public readonly hooks: Record<string, Hook>;

  constructor(serverless: Serverless) {
    this.serverless = serverless;
    this.originalConfig = getAppSyncConfig(
      this.serverless.configurationInput.appSync,
    );
    this.log = this.log.bind(this);
    this.debugLog = this.debugLog.bind(this);

    // addDataLoader('HTTP', HttpDataLoader);
    removeDataLoader(AppSyncSimulatorDataSourceType.OpenSearch);
    addDataLoader(AppSyncSimulatorDataSourceType.OpenSearch, ElasticDataLoader);
    // addDataLoader('RELATIONAL_DATABASE', RelationalDataLoader);

    this.hooks = {
      'before:offline:start:init': this.startServers.bind(this),
      'before:offline:start:end': this.endServers.bind(this),
    };
  }

  log(message: string, opts = {}) {
    return this.serverless.cli.log(message, 'AppSync Simulator', opts);
  }

  debugLog(message: string, opts = {}) {
    if (process.env.SLS_DEBUG) {
      this.log(message, opts);
    }
  }

  getLambdaPort(): number {
    // Default serverless-offline lambdaPort is 3002
    let port = 3002;
    const offlineConfig =
      this.serverless.service.custom?.['serverless-offline'];
    // Check if the user has defined a specific port as part of their serverless.yml
    if (
      offlineConfig != undefined &&
      typeof offlineConfig === 'object' &&
      'lambdaPort' in offlineConfig
    ) {
      port = offlineConfig.lambdaPort as number;
    }
    // Check to see if a port override was specified as part of the CLI arguments
    const cliOptions = this.serverless.processedInput.options;
    if (cliOptions != undefined && cliOptions.lambdaPort != undefined) {
      port = cliOptions.lambdaPort as number;
    }
    return port;
  }

  async startServers() {
    try {
      this.buildResolvedOptions();
      this.buildResourceResolvers();
      this.serverless.service.functions = this.resolveResources(
        this.serverless.service.functions,
      );
      this.serverless.service.provider.environment = this.resolveResources(
        this.serverless.service.provider.environment,
      );
      this.config = this.resolveResources(this.originalConfig);

      const sim = {
        amplifySimulator:
          await ServerlessAppSyncSimulator.startIndividualServer(
            this.options.port,
            this.options.wsPort,
          ),
        name: this.config.name,
      };
      this.simulator = sim;

      this.options.lambdaPort = this.getLambdaPort();

      if (Array.isArray(this.options.watch) && this.options.watch.length > 0) {
        this.watch();
      } else {
        this.initServers();
      }

      this.log(
        `${sim.name} AppSync endpoint: ${sim.amplifySimulator.url}/graphql`,
      );
      this.log(`${sim.name} GraphQL: ${sim.amplifySimulator.url}`);
    } catch (error: any) {
      this.log(error, { color: 'red' });
    }
  }

  static async startIndividualServer(
    port: number | undefined,
    wsPort: number | undefined,
  ) {
    const simulator = new AmplifyAppSyncSimulator({
      port: port,
      wsPort: wsPort,
    });
    await simulator.start();
    return simulator;
  }

  initServers() {
    const config = this.buildAmplifyConfig();

    this.debugLog(`AppSync Config ${this.config.name}`);
    this.debugLog(inspect(config, { depth: 4, colors: true }));

    this.simulator!.amplifySimulator.init(config);
  }

  watch() {
    const client = new watchman.Client();
    const path = this.serverless.config.servicePath;

    // Try to watch for changes in AppSync configuration
    client.command(['watch-project', path], (error, resp) => {
      if (error) {
        console.error('Error initiating watch:', error);
        console.log('AppSync Simulator hot-reloading will not be available');
        // init server once
        this.initServers();
        return;
      }

      if ('warning' in resp) {
        console.log('warning: ', resp.warning);
      }

      // Watch for changes in vtl and schema files.
      const sub: any = {
        expression: [
          'anyof',
          ...this.options.watch.map((glob: any) => {
            if (Array.isArray(glob)) {
              return glob;
            }
            return ['match', glob];
          }),
        ],
        fields: ['name'],
        since: resp.clock,
      };

      const { watch, relative_path } = resp;
      if (relative_path) {
        sub.relative_root = relative_path;
      }

      // init subscription
      client.command(
        ['subscribe', watch, 'appsync-simulator', sub],
        (error) => {
          if (error) {
            console.error('Failed to subscribe: ', error);
            return;
          }
        },
      );
    });

    client.on('subscription', async (resp) => {
      if (resp.subscription === 'appsync-simulator') {
        console.log('Hot-reloading AppSync simulator...');
        this.initServers();
      }
    });
  }

  endServers() {
    if (this.simulator != null) {
      this.log('Halting AppSync Simulator');
      this.simulator.amplifySimulator.stop();
    }
  }

  buildResourceResolvers() {
    const refResolvers = reduce(
      this.serverless.service.resources?.Resources ?? {},
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

    this.resourceResolvers = {
      RefResolvers: {
        ...refResolvers,
        ...keyValueArrayToObject(this.options.refMap),
        // Add region for cfn-resolver-lib GetAZs
        'AWS::Region': this.serverless.service.provider.region,
      },
      'Fn::GetAttResolvers': keyValueArrayToObject(this.options.getAttMap),
      'Fn::ImportValueResolvers': keyValueArrayToObject(
        this.options.importValueMap,
      ),
    };
  }

  buildResolvedOptions() {
    this.options = merge(
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
            this.serverless.service,
            'custom.dynamodb.start.port',
            8000,
          )}`,
          region: 'localhost',
          accessKeyId: 'DEFAULT_ACCESS_KEY',
          secretAccessKey: 'DEFAULT_SECRET',
        },
        openSearch: {},
      },
      get(this.serverless.service, 'custom.appsync-simulator', {}),
    );

    this.options = defaults(this.options, {
      watch: ['*.graphql', '*.vtl'],
    });
  }

  buildAmplifyConfig(): AmplifyAppSyncSimulatorConfig {
    const appSync = {
      name: this.config.name,
      apiKey: this.options.apiKey,
      defaultAuthenticationType: ServerlessAppSyncSimulator.buildAuthType(
        this.config.authentication,
      ),
      additionalAuthenticationProviders: (
        this.config.additionalAuthentications || []
      ).map(ServerlessAppSyncSimulator.buildAuthType),
    };

    // Load the schema. If multiple provided, merge them
    const schemaPaths = Array.isArray(this.config.schema)
      ? this.config.schema
      : [this.config.schema || DEFAULT_SCHEMA_FILE];
    const basePath = this.serverless.config.servicePath;
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

    const buildResolver = this.buildResolver.bind(this);
    const buildDataSource = this.buildDataSource.bind(this);

    return {
      appSync,
      schema,
      resolvers: Object.values(this.config.resolvers)
        .map(buildResolver)
        .filter(nonNullable),
      functions: Object.values(this.config.pipelineFunctions).map(
        ServerlessAppSyncSimulator.buildFunction,
      ),
      dataSources: Object.values(this.config.dataSources)
        .map(buildDataSource)
        .filter(nonNullable),
    };
  }

  private static buildAuthType(
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
            AuthorizerUri: auth.config.identityValidationExpression!,
            AuthorizerResultTtlInSeconds:
              auth.config.authorizerResultTtlInSeconds,
          },
        };
      default:
        throw new Error(`Unknown authentication type: ${authenticationType}`);
    }
  }

  private buildResolver(
    resolver: DeepResolved<ResolverConfig>,
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
          requestMappingTemplate: this.buildMappingTemplate(
            resolver,
            'request',
          ),
          responseMappingTemplate: this.buildMappingTemplate(
            resolver,
            'response',
          ),
        };
      case RESOLVER_KIND.PIPELINE:
        return {
          kind: RESOLVER_KIND.PIPELINE,
          fieldName: resolver.field,
          typeName: resolver.type,
          functions: resolver.functions,
          requestMappingTemplate: this.buildMappingTemplate(
            resolver,
            'request',
          ),
          responseMappingTemplate: this.buildMappingTemplate(
            resolver,
            'response',
          ),
        };
      default:
        return undefined;
    }
  }

  private static buildFunction(
    config: DeepResolved<PipelineFunctionConfig>,
  ): AppSyncSimulatorFunctionsConfig {
    return {
      name: config.name,
      dataSourceName: config.dataSource,
      requestMappingTemplateLocation: config.request ?? '',
      responseMappingTemplateLocation: config.response ?? '',
    };
  }

  private buildMappingTemplate(
    resolver: DeepResolved<ResolverConfig | PipelineFunctionConfig>,
    type: HTTPMessage,
  ) {
    const { substitutions = {} } = resolver;
    const templatePath = resolver[type];

    // Direct lambda
    // For direct lambdas, we use a default mapping template
    // See https://amzn.to/3ncV3Dz
    if (!templatePath) {
      return directLambdaMappingTemplates[type];
    } else {
      let mappingTemplate = readFileSync(
        path.join(this.serverless.config.servicePath, templatePath),
        { encoding: DEFAULT_ENCODING },
      );
      // Substitutions
      const allSubstitutions = {
        ...this.config.substitutions,
        ...substitutions,
      };
      for (const [variable, value] of Object.entries(allSubstitutions)) {
        const regExp = new RegExp(`\\$\{?${variable}}?`, 'g');
        mappingTemplate = mappingTemplate.replace(regExp, value);
      }
      return mappingTemplate;
    }
  }

  private buildDataSource(source: DeepResolved<DataSourceConfig>) {
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
            ...this.options.dynamoDb,
            tableName: source.config.tableName,
          },
        };
      }
      case 'RELATIONAL_DATABASE': {
        return {
          ...dataSource,
          rds: this.options.rds,
        };
      }
      case 'AWS_LAMBDA': {
        const func = ((config) => {
          if ('functionName' in config) {
            const name = config.functionName;
            return (
              this.options.functions?.[name] ||
              this.serverless.service.functions?.[name]
            );
          } else if ('function' in config) {
            return config.function;
          } else if ('functionArn' in config) {
            // return config.functionArn;
            this.log(
              'On DataSource, using functionArn pattern is not supported.',
              {
                color: 'orange',
              },
            );
          }
          return null;
        })(source.config);
        if (func == null) {
          this.log(`The ${source.name} function is not defined`, {
            color: 'orange',
          });
          return null;
        }

        const lambda = new Lambda({
          apiVersion: '2015-03-31',
          region: 'localhost',
          endpoint: `http://localhost:${this.options.lambdaPort}`,
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
                `Request failed with status code ${result.StatusCode}`,
              );
            }
            if (result.FunctionError) {
              throw new Error(result.FunctionError);
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
          ...this.options.openSearch,
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

  /**
   * Resolves resources through `Ref:` or `Fn:GetAtt`
   */
  resolveResources<T>(toBeResolved: T): DeepResolved<T> {
    // Pass all resources to allow Fn::GetAtt and Conditions resolution
    const node = {
      ...this.serverless.service.resources,
      toBeResolved,
      Parameters: {},
    };
    const evaluator = new NodeEvaluator(node, this.resourceResolvers);
    const result = evaluator.evaluateNodes();
    if (result && result.toBeResolved) {
      return result.toBeResolved;
    }
    return toBeResolved as DeepResolved<T>;
  }
}

module.exports = ServerlessAppSyncSimulator;
