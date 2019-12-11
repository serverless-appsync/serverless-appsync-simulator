import {
  AmplifyAppSyncSimulatorAuthenticationType as AuthTypes,
} from 'amplify-appsync-simulator';
import { invoke } from 'amplify-util-mock/lib/utils/lambda/invoke';
import fs from 'fs';
import { find, get, reduce } from 'lodash';
import path from 'path';
import NodeEvaulator from 'cfn-resolver-lib';

export default function getAppSyncConfig(context, appSyncConfig) {
  // Flattening params
  const cfg = {
    ...appSyncConfig,
    mappingTemplates: (appSyncConfig.mappingTemplates || []).flat(),
    functionConfigurations: (appSyncConfig.functionConfigurations || []).flat(),
    dataSources: (appSyncConfig.dataSources || []).flat(),
  };

  const getFileMap = (basePath, filePath) => ({
    path: filePath,
    content: fs.readFileSync(path.join(basePath, filePath), { encoding: 'utf8' }),
  });

  const makeDataSource = (source) => {
    if (source.name === undefined || source.type === undefined) {
      return null;
    }

    const dataSource = {
      name: source.name,
      type: source.type,
    };

    /**
     * Resolves a resourse through `Ref:` or `Fn:GetAtt`
     */
    // FIXME: instead of this we should parse the whole YML file
    // and resolve ALL possible values everywhere:
    // e.g.:  environment variables.
    const resolveResource = (resource) => {
      if (typeof resource === 'string') {
        return resource;
      }

      const refResolvers = reduce(
        get(context.serverless.service, 'resources.Resources', {}),
        (acc, res, name) => {
          let refPath;
          if (res.Type === 'AWS::DynamoDB::Table') {
            refPath = 'Properties.TableName';
          }

          return { ...acc, [name]: get(res, refPath, null) };
        },
        {},
      );

      const evaluator = new NodeEvaulator(
        { resource },
        {
          RefResolveres: refResolvers,
          'Fn::GetAttResolvers': context.options.getAttResolver,
        },
        process.env.SLS_DEBUG,
      );
      const resolved = evaluator.evaulateNodes();

      if (resolved && resolved.resource) {
        if (process.env.SLS_DEBUG) {
          context.serverless.cli.log(
            `Resolved resource for ${JSON.stringify(resource)}: `
            + `${resolved.resource}`,
          );
        }
        return resolved.resource;
      }

      if (process.env.SLS_DEBUG) {
        context.serverless.cli.log(`Could not resolve ${JSON.stringify(resource)}`);
      }

      return null;
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
            tableName: resolveResource(source.config.tableName),
          },
        };
      }
      case 'AWS_LAMBDA': {
        const { functionName } = source.config;
        if (context.serverless.service.functions[functionName] === undefined) {
          return null;
        }

        const [fileName, handler] = context.serverless.service.functions[functionName].handler.split('.');
        return {
          ...dataSource,
          invoke: (payload) => invoke({
            packageFolder: context.serverless.config.servicePath,
            handler,
            fileName: path.join(context.options.location, fileName),
            event: payload,
            environment: context.serverless.service.provider.environment || {},
          }),
        };
      }
      case 'AMAZON_ELASTICSEARCH':
      case 'HTTP': {
        return {
          ...dataSource,
          endpoint: resolveResource(source.config.endpoint),
        };
      }
      default:
        return dataSource;
    }
  };

  const makeResolver = (resolver) => ({
    kind: resolver.kind || 'UNIT',
    fieldName: resolver.field,
    typeName: resolver.type,
    dataSourceName: resolver.dataSource,
    functions: resolver.functions,
    requestMappingTemplateLocation: resolver.request,
    responseMappingTemplateLocation: resolver.response,
  });

  const makeFunctionConfiguration = (functionConfiguration) => ({
    dataSourceName: functionConfiguration.dataSource,
    name: functionConfiguration.name,
    requestMappingTemplateLocation: functionConfiguration.request,
    responseMappingTemplateLocation: functionConfiguration.response,
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
    additionalAuthenticationProviders: (config.additionalAuthenticationProviders || [])
      .map(makeAuthType),
  });

  const mappingTemplatesLocation = path.join(
    context.serverless.config.servicePath,
    cfg.mappingTemplatesLocation || 'mapping-templates',
  );

  const makeMappingTemplates = (config) => {
    const sources = [].concat(
      config.mappingTemplates,
      config.functionConfigurations,
    );

    return sources.reduce((acc, template) => {
      const requestTemplate = template.request || `${template.type}.${template.field}.request.vtl`;
      if (!find(acc, (e) => e.path === requestTemplate)) {
        acc.push(getFileMap(mappingTemplatesLocation, requestTemplate));
      }
      const responseTemplate = template.response || `${template.type}.${template.field}.response.vtl`;
      if (!find(acc, (e) => e.path === responseTemplate)) {
        acc.push(getFileMap(mappingTemplatesLocation, responseTemplate));
      }

      return acc;
    }, []);
  };

  return {
    appSync: makeAppSync(cfg),
    schema: getFileMap(context.serverless.config.servicePath, cfg.schema || 'schema.graphql'),
    resolvers: cfg.mappingTemplates.map(makeResolver),
    dataSources: cfg.dataSources.map(makeDataSource).filter((v) => v !== null),
    functions: cfg.functionConfigurations.map(makeFunctionConfiguration),
    mappingTemplates: makeMappingTemplates(cfg),
  };
}
