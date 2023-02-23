"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _axios = _interopRequireDefault(require("axios"));

var _lodash = require("lodash");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const paramsSerializer = params => {
  const parts = [];
  (0, _lodash.forEach)(params, (value, key) => {
    if (value === null || typeof value === 'undefined') {
      return;
    }

    let k = key;
    let v = value;

    if (Array.isArray(v)) {
      k += '[]';
    } else {
      v = [v];
    }

    (0, _lodash.forEach)(v, val => {
      let finalValue = val;

      if ((0, _lodash.isObject)(finalValue)) {
        finalValue = JSON.stringify(finalValue);
      }

      parts.push(`${k}=${finalValue}`);
    });
  });
  return parts.join('&');
};

class HttpDataLoader {
  constructor(config) {
    this.config = config;
  }

  async load(req) {
    try {
      const {
        data,
        status,
        headers
      } = await _axios.default.request({
        baseURL: this.config.endpoint,
        validateStatus: false,
        url: req.resourcePath,
        headers: req.params.headers,
        params: req.params.query,
        paramsSerializer,
        method: req.method.toLowerCase(),
        data: req.params.body
      });
      return {
        headers,
        statusCode: status,
        body: JSON.stringify(data)
      };
    } catch (err) {
      console.log(err);
    }

    return null;
  }

}

exports.default = HttpDataLoader;