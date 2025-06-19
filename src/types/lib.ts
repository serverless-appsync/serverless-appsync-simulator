/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'cfn-resolver-lib' {
  export default class NodeEvaluator {
    constructor(node: any, resolver: any);
    evaluateNodes(): any;
  }
}

declare module 'mysql2' {
  export const Types: Record<number, string>;
}
