/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios, { CustomParamsSerializer } from 'axios';
import { isObject, forEach } from 'lodash';

const serialize: CustomParamsSerializer = (params) => {
  const parts: string[] = [];

  forEach(params, (value, key) => {
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

    forEach(v, (val) => {
      let finalValue = val;
      if (isObject(finalValue)) {
        finalValue = JSON.stringify(finalValue);
      }
      parts.push(`${k}=${finalValue}`);
    });
  });

  return parts.join('&');
};

export default class HttpDataLoader {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async load(req: {
    resourcePath: string;
    params: { headers: any; query: any; body: any };
    method: string;
  }) {
    try {
      const { data, status, headers } = await axios.request({
        baseURL: this.config.endpoint,
        validateStatus: () => false,
        url: req.resourcePath,
        headers: req.params.headers,
        params: req.params.query,
        paramsSerializer: { serialize },
        method: req.method.toLowerCase(),
        data: req.params.body,
      });

      return {
        headers,
        statusCode: status,
        body: JSON.stringify(data),
      };
    } catch (err) {
      console.log(err);
    }

    return null;
  }
}
