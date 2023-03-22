import axios from 'axios';
import * as AWS from 'aws-sdk';

export default class ElasticDataLoader {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async load(req: {
    path: string;
    params: { headers: any; queryString: any; body: any };
    operation: string;
  }) {
    try {
      if (this.config.useSignature) {
        const signedRequest = await this.createSignedRequest(req);
        // @ts-ignore
        const client = new AWS.HttpClient();
        const data = await new Promise<string>((resolve, reject) => {
          client.handleRequest(
            signedRequest,
            null,
            (response: any) => {
              let responseBody = '';
              response.on('data', (chunk: string) => {
                responseBody += chunk;
              });
              response.on('end', () => {
                resolve(responseBody);
              });
            },
            (err: any) => {
              reject(err);
            },
          );
        });
        return JSON.parse(data);
      } else {
        const { data } = await axios.request({
          baseURL: this.config.endpoint,
          url: req.path,
          headers: req.params.headers,
          params: req.params.queryString,
          method: req.operation.toLowerCase(),
          data: req.params.body,
        });

        return data;
      }
    } catch (err) {
      console.log(err);
    }

    return null;
  }

  async createSignedRequest(req: {
    path: string;
    params: any;
    operation: string;
  }) {
    const domain = this.config.endpoint.replace('https://', '');
    const headers = {
      ...req.params.headers,
      host: domain,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(req.params.body),
    };
    const endpoint = new AWS.Endpoint(domain);
    const httpRequest = new AWS.HttpRequest(endpoint, this.config.region);
    httpRequest.headers = headers;
    httpRequest.body = req.params.body;
    httpRequest.method = req.operation;
    httpRequest.path = req.path;

    const credentials = await this.getCredentials();
    // @ts-ignore
    const signer = new AWS.Signers.V4(httpRequest, 'es');
    signer.addAuthorization(credentials, new Date());

    return httpRequest;
  }

  async getCredentials() {
    const chain = new AWS.CredentialProviderChain([
      () => new AWS.EnvironmentCredentials('AWS'),
      () => new AWS.EnvironmentCredentials('AMAZON'),
      () => new AWS.SharedIniFileCredentials(),
    ]);
    if (this.config.accessKeyId && this.config.secretAccessKey) {
      chain.providers.unshift(
        () =>
          new AWS.Credentials(
            this.config.accessKeyId,
            this.config.secretAccessKey,
          ),
      );
    }
    return new Promise((resolve, reject) =>
      chain.resolve((err, creds) => {
        if (err) {
          reject(err);
        } else {
          resolve(creds);
        }
      }),
    );
  }
}
