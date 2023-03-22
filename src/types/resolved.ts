import { IntrinsicFunction } from './cloudFormation';

type NonIntrinsicFunction<T> = T extends IntrinsicFunction ? never : T;

export type Resolved<T> = T extends object
  ? { [K in keyof T]: NonIntrinsicFunction<T[K]> }
  : T;
export type DeepResolved<T> = T extends object
  ? { [K in keyof T]: DeepResolved<Resolved<T[K]>> }
  : T;
