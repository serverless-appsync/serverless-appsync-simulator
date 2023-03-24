import { resolveConfiguration } from '../config';

describe('resolveConfiguration', () => {
  it('should generate a valid config', async () => {
    const { config, options, simulator } = await resolveConfiguration(
      {
        service: 'test service',
        provider: {
          name: 'aws',
          region: 'us-west-2',
          runtime: 'nodejs16.x',
        },
        functions: {
          resolver: {
            name: 'appsync-resolver',
            handler: 'src/__tests__/files/resolver.handler',
          },
        },
      },
      {
        name: 'myAPI',
        schema: 'src/__tests__/files/*.graphql',
        authentication: {
          type: 'API_KEY',
        },
        apiKeys: ['foo-bar'],
        additionalAuthentications: [
          {
            type: 'AMAZON_COGNITO_USER_POOLS',
            config: {
              userPoolId: 'us-west-2_123456789',
            },
          },
        ],
        dataSources: {
          lambda: {
            type: 'AWS_LAMBDA',
            config: {
              functionName: 'resolver',
            },
          },
          dynamodb: {
            type: 'AMAZON_DYNAMODB',
            config: {
              tableName: 'myTable',
            },
          },
          http: {
            type: 'HTTP',
            config: {
              endpoint: 'http://127.0.0.1',
            },
          },
          none: {
            type: 'NONE',
          },
        },
        pipelineFunctions: {
          func: {
            dataSource: 'lambda',
            request:
              'src/__tests__/files/mapping-templates/templates.request.vtl',
            response:
              'src/__tests__/files/mapping-templates/templates.response.vtl',
            substitutions: {
              mySubVar: 'template-function',
            },
          },
          funcDirect: {
            dataSource: 'lambda',
          },
        },
        resolvers: {
          'Query.node': {
            kind: 'UNIT',
            dataSource: 'lambda',
          },
          'Mutation.updateNode': {
            kind: 'UNIT',
            dataSource: 'lambda',
          },

          'Query.templates': {
            kind: 'UNIT',
            dataSource: 'lambda',
            request:
              'src/__tests__/files/mapping-templates/templates.request.vtl',
            response:
              'src/__tests__/files/mapping-templates/templates.response.vtl',
            substitutions: {
              mySubVar: 'lambda',
            },
          },
          'Query.pipeline': {
            kind: 'PIPELINE',
            functions: ['func', 'funcDirect'],
          },
        },
      },
      {},
    );

    expect(config).toMatchSnapshot();
    expect(options).toMatchSnapshot();
    expect(simulator.name).toBe('myAPI');
  });
});
