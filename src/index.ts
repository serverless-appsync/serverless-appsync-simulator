/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { inspect } from 'util';
import {
  addDataLoader,
  AppSyncSimulatorDataSourceType,
  removeDataLoader,
} from 'amplify-appsync-simulator';
import watchman from 'fb-watchman';
import { Hook } from 'serverless';
import Serverless from 'serverless/lib/Serverless';
import {
  buildAmplifyConfig,
  Config,
  resolveConfiguration,
  setLogger,
  Simulator,
} from './config';
import ElasticDataLoader from './data-loaders/ElasticDataLoader';
import HttpDataLoader from './data-loaders/HttpDataLoader';
import RelationalDataLoader from './data-loaders/RelationalDataLoader';
import { AppSyncConfigInput } from './types/appSync';

class ServerlessAppSyncSimulator {
  private serverless: Serverless;
  private config!: Config;
  private options: Record<string, any> = {};
  private simulator?: Simulator;

  public readonly hooks: Record<string, Hook>;

  constructor(serverless: Serverless) {
    this.serverless = serverless;
    const log = this.log.bind(this);
    this.log = log;
    this.debugLog = this.debugLog.bind(this);
    setLogger(log);

    removeDataLoader(AppSyncSimulatorDataSourceType.OpenSearch);
    addDataLoader(AppSyncSimulatorDataSourceType.OpenSearch, ElasticDataLoader);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    addDataLoader('HTTP' as any, HttpDataLoader);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    addDataLoader('RELATIONAL_DATABASE' as any, RelationalDataLoader);

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

  async startServers() {
    try {
      const appSyncConfig: AppSyncConfigInput = this.serverless
        .configurationInput.appSync;
      const { config, options, simulator } = await resolveConfiguration(
        this.serverless.service,
        appSyncConfig,
        this.serverless.processedInput.options,
      );
      this.config = config;
      this.options = options;
      this.simulator = simulator;

      if (Array.isArray(this.options.watch) && this.options.watch.length > 0) {
        this.watch();
      } else {
        this.initServers();
      }

      this.log(
        `${simulator.name} AppSync endpoint: ${simulator.amplifySimulator.url}/graphql`,
      );
      this.log(`${simulator.name} GraphQL: ${simulator.amplifySimulator.url}`);
    } catch (error) {
      this.log(error as string, { color: 'red' });
    }
  }

  initServers() {
    const config = buildAmplifyConfig(
      this.config,
      this.serverless.service,
      this.options,
      this.serverless.config.servicePath,
    );

    this.debugLog(`AppSync Config ${this.config.name}`);
    this.debugLog(inspect(config, { depth: 4, colors: true }));

    this.simulator?.amplifySimulator.init(config);
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
      client.command(['subscribe', watch, 'appsync-simulator', sub], error => {
        if (error) {
          console.error('Failed to subscribe: ', error);
          return;
        }
      });
    });

    client.on('subscription', resp => {
      if (resp.subscription === 'appsync-simulator') {
        console.log('Hot-reloading AppSync simulator...');
        this.initServers();
      }
    });
  }

  async endServers() {
    try {
      if (this.simulator != null) {
        this.log('Halting AppSync Simulator');
        await this.simulator.amplifySimulator.stop();
        this.log(`Appsync simulator stopped`);
      }
    } catch (error) {
      this.log(error as string, { color: 'red' });
    }
  }
}

module.exports = ServerlessAppSyncSimulator;
