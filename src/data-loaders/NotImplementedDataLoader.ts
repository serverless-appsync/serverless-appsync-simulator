/* eslint-disable class-methods-use-this */
export default class NotImplementedDataLoader {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async load() {
    console.log(
      `Data Loader not implemented for ${this.config.type} (${this.config.name})`,
    );

    return null;
  }
}
