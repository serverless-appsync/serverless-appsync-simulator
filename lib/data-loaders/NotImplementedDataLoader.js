"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

/* eslint-disable class-methods-use-this */
class NotImplementedDataLoader {
  constructor(config) {
    this.config = config;
  }

  async load() {
    console.log(`Data Loader not implemented for ${this.config.type} (${this.config.name})`);
    return null;
  }

}

exports.default = NotImplementedDataLoader;