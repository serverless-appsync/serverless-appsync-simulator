import { AmplifyAppSyncSimulatorAuthenticationType as AuthTypes } from 'amplify-appsync-simulator';
import axios from 'axios';
import fs from 'fs';
import { forEach, isNil, first } from 'lodash';
import path from 'path';
import { mergeTypeDefs } from '@graphql-tools/merge';
import * as globby from 'globby';
import directLambdaRequest from './templates/direct-lambda.request.vtl';
import directLambdaResponse from './templates/direct-lambda.response.vtl';
import {
  DEFAULT_MAPPING_TEMPLATE_LOCATION,
  DEFAULT_ENCODING,
  DEFAULT_SCHEMA_FILE,
  DEFAULT_HTTP_METHOD,
  DEFAULT_RESOLVER_TYPE,
  HTTPMessage,
  MappingTemplateType,
  SourceType,
} from './constants';

const directLambdaMappingTemplates = {
  request: directLambdaRequest,
  response: directLambdaResponse,
};

export default function getAppSyncConfig(context, appSyncConfig) {
  // Flattening params
  const cfg = {
    ...appSyncConfig,
    mappingTemplates: (appSyncConfig.mappingTemplates || []).flat(),
    functionConfigurations: (appSyncConfig.functionConfigurations || []).flat(),
    dataSources: (appSyncConfig.dataSources || []).flat(),
  };

  const mappingTemplatesLocation = path.join(
    context.serverless.config.servicePath,
    cfg.mappingTemplatesLocation || DEFAULT_MAPPING_TEMPLATE_LOCATION,
  );

  const functionConfigurationsLocation = path.join(
    context.serverless.config.servicePath,
    cfg.functionConfigurationsLocation ||
      cfg.mappingTemplatesLocation ||
      DEFAULT_MAPPING_TEMPLATE_LOCATION,
  );

  const { defaultMappingTemplates = {} } = cfg;

  const getMappingTemplate = (filePath, type) => {
    switch (type) {
      case MappingTemplateType.MAPPING_TEMPLATE:
        return fs.readFileSync(path.join(mappingTemplatesLocation, filePath), {
          encoding: DEFAULT_ENCODING,
        });
      case MappingTemplateType.FUNCTION_CONFIGURATION:
        return fs.readFileSync(
          path.join(functionConfigurationsLocation, filePath),
          {
            encoding: DEFAULT_ENCODING,
          },
        );
      default:
        return null;
    }
  };

  const toAbsolutePosixPath = (basePath, filePath) =>
    (path.isAbsolute(filePath)
      ? filePath
      : path.join(basePath, filePath)
    ).replace(/\\/g, '/');

  const globFilePaths = (basePath, filePaths) => {
    return filePaths
      .map((filePath) => {
        const paths = globby.sync(toAbsolutePosixPath(basePath, filePath));
        if (path.isAbsolute(filePath)) {
          return paths;
        } else {
          // For backward compatibility with FileMap, revert to relative path
          return paths.map((p) => path.relative(basePath, p));
        }
      })
      .flat();
  };

  const getFileMap = (basePath, filePath) => ({
    path: filePath,
    content: fs.readFileSync(toAbsolutePosixPath(basePath, filePath), {
      encoding: DEFAULT_ENCODING,
    }),
  });

  const makeDataSource = (source) => {
    if (source.name === undefined || source.type === undefined) {
      return null;
    }

    const dataSource = {
      name: source.name,
      type: source.type,
    };

    switch (source.type) {
      case SourceType.AMAZON_DYNAMODB: {
        return {
          ...dataSource,
          config: {
            ...context.options.dynamoDb,
            tableName: source.config.tableName,
          },
        };
      }
      case SourceType.RELATIONAL_DATABASE: {
        return {
          ...dataSource,
          rds: context.options.rds,
        };
      }
      case SourceType.AWS_LAMBDA: {
        const { functionName } = source.config;
        if (functionName === undefined) {
          context.plugin.log(`${source.name} does not have a functionName`, {
            color: 'orange',
          });
          return null;
        }

        const conf = context.options;
        const func =
          conf.functions?.[functionName] ||
          context.serverless.service.functions?.[functionName];

        if (func === undefined) {
          context.plugin.log(`The ${functionName} function is not defined`, {
            color: 'orange',
          });
          return null;
        }

        let url, method;
        if (func.url) {
          url = func.url;
          method = func.method;
        } else {
          url = `http://localhost:${context.options.lambdaPort}/2015-03-31/functions/${func.name}/invocations`;
        }
        return {
          ...dataSource,
          invoke: async (payload) => {
            const result = await axios.request({
              url,
              method: method || DEFAULT_HTTP_METHOD,
              data: payload,
              headers: payload?.request?.headers,
              validateStatus: false,
            });
            // When the Lambda returns an error, the status code is 200 OK.
            // The presence of an error is indicated by a header in the response.
            // 400 and 500-series status codes are reserved for invocation errors:
            // https://docs.aws.amazon.com/lambda/latest/dg/API_Invoke.html#API_Invoke_Errors
            if (result.status === 200) {
              const errorType =
                result.headers['x-amz-function-error'] ||
                result.headers['X-Amz-Function-Error'] ||
                result.headers['x-amzn-errortype'] ||
                result.headers['x-amzn-ErrorType'];
              if (errorType) {
                throw {
                  type: `Lambda:${errorType}`,
                  message: result.data.errorMessage,
                };
              }
              // If the result of a lambda function is null or undefined, it returns as an empty string via HTTP.
              // Then, AppSync handles an empty string of the response as null (or undefined).
              if (result.data === '') {
                return null;
              }
              return result.data;
            } else {
              throw new Error(
                `Request failed with status code ${result.status}`,
              );
            }
          },
        };
      }
      case SourceType.AMAZON_ELASTICSEARCH:
        return {
          ...context.options.openSearch,
          ...dataSource,
          endpoint: source.config.endpoint,
        };
      case SourceType.HTTP: {
        return {
          ...dataSource,
          endpoint: source.config.endpoint,
        };
      }
      default:
        return dataSource;
    }
  };

  const makeMappingTemplate = (resolver, type, templateType) => {
    const { name, type: parent, field, substitutions = {} } = resolver;

    const defaultTemplatePrefix = name || `${parent}.${field}`;
    const templatePath = !isNil(resolver?.[type])
      ? resolver?.[type]
      : !isNil(defaultMappingTemplates?.[type])
      ? defaultMappingTemplates?.[type]
      : `${defaultTemplatePrefix}.${type}.vtl`;

    let mappingTemplate;
    // Direct lambda
    // For direct lambdas, we use a default mapping template
    // See https://amzn.to/3ncV3Dz
    if (templatePath === false) {
      mappingTemplate = directLambdaMappingTemplates[type];
    } else {
      mappingTemplate = getMappingTemplate(templatePath, templateType);
      // Substitutions
      const allSubstitutions = { ...cfg.substitutions, ...substitutions };
      forEach(allSubstitutions, (value, variable) => {
        const regExp = new RegExp(`\\$\{?${variable}}?`, 'g');
        mappingTemplate = mappingTemplate.replace(regExp, value);
      });
    }

    return mappingTemplate;
  };

  const makeResolver = (resolver) => {
    let templateType = MappingTemplateType.MAPPING_TEMPLATE;
    return {
      kind: resolver.kind || DEFAULT_RESOLVER_TYPE,
      fieldName: resolver.field,
      typeName: resolver.type,
      dataSourceName: resolver.dataSource,
      functions: resolver.functions,
      requestMappingTemplate: makeMappingTemplate(
        resolver,
        HTTPMessage.REQUEST,
        templateType,
      ),
      responseMappingTemplate: makeMappingTemplate(
        resolver,
        HTTPMessage.RESPONSE,
        templateType,
      ),
    };
  };

  const makeFunctionConfiguration = (config) => {
    let templateType = MappingTemplateType.FUNCTION_CONFIGURATION;
    return {
      dataSourceName: config.dataSource,
      name: config.name,
      requestMappingTemplate: makeMappingTemplate(
        config,
        HTTPMessage.REQUEST,
        templateType,
      ),
      responseMappingTemplate: makeMappingTemplate(
        config,
        HTTPMessage.RESPONSE,
        templateType,
      ),
    };
  };

  const makeAuthType = (authType) => {
    const auth = {
      authenticationType: authType.authenticationType,
    };

    if (auth.authenticationType === AuthTypes.AMAZON_COGNITO_USER_POOLS) {
      auth.cognitoUserPoolConfig = {
        AppIdClientRegex: authType.userPoolConfig.appIdClientRegex,
      };
    } else if (auth.authenticationType === AuthTypes.OPENID_CONNECT) {
      auth.openIDConnectConfig = {
        Issuer: authType.openIdConnectConfig.issuer,
        ClientId: authType.openIdConnectConfig.clientId,
      };
    }

    return auth;
  };

  const makeAppSync = (config) => ({
    name: config.name,
    apiKey: context.options.apiKey,
    defaultAuthenticationType: makeAuthType(config),
    additionalAuthenticationProviders: (
      config.additionalAuthenticationProviders || []
    ).map(makeAuthType),
  });

  // Load the schema. If multiple provided, merge them
  const schemaPaths = Array.isArray(cfg.schema)
    ? cfg.schema
    : [cfg.schema || DEFAULT_SCHEMA_FILE];
  const basePath = context.serverless.config.servicePath;
  const schemas = globFilePaths(basePath, schemaPaths).map((schemaPath) =>
    getFileMap(basePath, schemaPath),
  );
  const schema = {
    path: first(schemas).path,
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
    appSync: makeAppSync(cfg),
    schema,
    resolvers: cfg.mappingTemplates.map(makeResolver),
    dataSources: cfg.dataSources.map(makeDataSource).filter((v) => v !== null),
    functions: cfg.functionConfigurations.map(makeFunctionConfiguration),
  };
}
