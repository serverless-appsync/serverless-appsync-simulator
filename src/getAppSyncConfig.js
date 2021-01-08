import { AmplifyAppSyncSimulatorAuthenticationType as AuthTypes } from 'amplify-appsync-simulator';
import axios from 'axios';
import fs from 'fs';
import { forEach, isNil, first } from 'lodash';
import path from 'path';
import { mergeTypes } from 'merge-graphql-schemas';
import directLambdaRequest from './templates/direct-lambda.request.vtl';
import directLambdaResponse from './templates/direct-lambda.response.vtl';

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
    cfg.mappingTemplatesLocation || 'mapping-templates',
  );

  const { defaultMappingTemplates = {} } = cfg;

  const getMappingTemplate = (filePath) => {
    return fs.readFileSync(path.join(mappingTemplatesLocation, filePath), {
      encoding: 'utf8',
    });
  };

  const getFileMap = (basePath, filePath) => ({
    path: filePath,
    content: fs.readFileSync(path.join(basePath, filePath), {
      encoding: 'utf8',
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
      case 'AMAZON_DYNAMODB': {
        const {
          endpoint,
          region,
          accessKeyId,
          secretAccessKey,
        } = context.options.dynamoDb;

        return {
          ...dataSource,
          config: {
            endpoint,
            region,
            accessKeyId,
            secretAccessKey,
            tableName: source.config.tableName,
          },
        };
      }
      case 'AWS_LAMBDA': {
        const { functionName } = source.config;
        if (functionName === undefined) {
          context.plugin.log(`${source.name} does not have a functionName`, {
            color: 'orange',
          });
          return null;
        }

        const conf = context.options;
        if (conf.functions && conf.functions[functionName] !== undefined) {
          const func = conf.functions[functionName];
          return {
            ...dataSource,
            invoke: async (payload) => {
              const result = await axios.request({
                url: func.url,
                method: func.method,
                data: payload,
                validateStatus: false,
              });
              return result.data;
            },
          };
        }

        const func = context.serverless.service.functions[functionName];
        if (func === undefined) {
          context.plugin.log(`The ${functionName} function is not defined`, {
            color: 'orange',
          });
          return null;
        }

        return {
          ...dataSource,
          invoke: (payload) => invokeHandler(functionName, context, payload),
        };
      }
      case 'AMAZON_ELASTICSEARCH':
      case 'HTTP': {
        return {
          ...dataSource,
          endpoint: source.config.endpoint,
        };
      }
      default:
        return dataSource;
    }
  };

  const makeMappingTemplate = (resolver, type) => {
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
      mappingTemplate = getMappingTemplate(templatePath);
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
    return {
      kind: resolver.kind || 'UNIT',
      fieldName: resolver.field,
      typeName: resolver.type,
      dataSourceName: resolver.dataSource,
      functions: resolver.functions,
      requestMappingTemplate: makeMappingTemplate(resolver, 'request'),
      responseMappingTemplate: makeMappingTemplate(resolver, 'response'),
    };
  };

  const makeFunctionConfiguration = (config) => ({
    dataSourceName: config.dataSource,
    name: config.name,
    requestMappingTemplate: makeMappingTemplate(config, 'request'),
    responseMappingTemplate: makeMappingTemplate(config, 'response'),
  });

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
    : [cfg.schema || 'schema.graphql'];
  const schemas = schemaPaths.map((schemaPath) =>
    getFileMap(context.serverless.config.servicePath, schemaPath),
  );
  const schema = {
    path: first(schemas).path,
    content: mergeTypes(schemas.map((s) => s.content)),
  };

  return {
    appSync: makeAppSync(cfg),
    schema,
    resolvers: cfg.mappingTemplates.map(makeResolver),
    dataSources: cfg.dataSources.map(makeDataSource).filter((v) => v !== null),
    functions: cfg.functionConfigurations.map(makeFunctionConfiguration),
  };
}

async function invokeHandler(functionName, context, event) {
  // Store deep copy of cliOptions so we can restore later
  context.serverless.pluginManager.cliOptions['function'] = functionName;
  context.serverless.pluginManager.cliOptions['data'] = JSON.stringify(event); // Capture stdout temporarily

  let output = '';

  // Save original write so we can restore later
  process.stdout._orig_write = process.stdout.write;
  process.stdout.write = (data) => {
    if (data.charAt(data.length - 1) == '\n') data = data.slice(0, -1);
    output += data;
    process.stdout._orig_write(data);
  };

  // Run serverless invoke local
  await context.serverless.pluginManager.run(['invoke', 'local']);
  process.stdout._orig_write('\n');

  // Restore changes
  delete context.serverless.pluginManager.cliOptions['function'];
  delete context.serverless.pluginManager.cliOptions['data'];

  process.stdout.write = process.stdout._orig_write;

  return JSON.parse(output);
}
