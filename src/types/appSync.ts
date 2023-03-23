import { A, O } from 'ts-toolbelt';
import { ApiKeyConfig, AppSyncConfig, DataSourceConfig, PipelineFunctionConfig, ResolverConfig } from './plugin';

/* Completely replaces keys of O1 with those of O */
type Replace<O extends object, O1 extends object> = O.Merge<
  O,
  O.Omit<O1, A.Keys<O>>
>;

export type DataSourceConfigInput = O.Omit<DataSourceConfig, 'name'>;

export type ResolverConfigInput = O.Update<
  O.Update<
    O.Optional<ResolverConfig, 'type' | 'field'>,
    'dataSource',
    string | DataSourceConfigInput
  >,
  'functions',
  (string | FunctionConfigInput)[]
>;

export type FunctionConfigInput = Replace<
  { dataSource: string | DataSourceConfigInput },
  O.Omit<PipelineFunctionConfig, 'name'>
>;

export type AppSyncConfigInput = Replace<
  {
    schema?: string | string[];
    apiKeys?: (ApiKeyConfig | string)[];
    resolvers?:
      | Record<string, ResolverConfigInput>[]
      | Record<string, ResolverConfigInput>;
    pipelineFunctions?:
      | Record<string, FunctionConfigInput>[]
      | Record<string, FunctionConfigInput>;
    dataSources:
      | Record<string, DataSourceConfigInput>[]
      | Record<string, DataSourceConfigInput>;
  },
  O.Optional<AppSyncConfig, 'additionalAuthentications'>
>;
