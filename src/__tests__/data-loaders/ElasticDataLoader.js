import { PassThrough } from 'stream';
import * as AWS from 'aws-sdk';
import axios from 'axios';
import ElasticDataLoader from '../../data-loaders/ElasticDataLoader';

describe('data-loaders/ElasticDataLoader', () => {
  beforeEach(() => {
    jest.spyOn(AWS.HttpClient.prototype, 'handleRequest');
    jest.spyOn(axios, 'request');
  });

  afterEach(() => {
    AWS.HttpClient.prototype.handleRequest.mockClear();
    axios.request.mockClear();
  });

  it('should send a request', async () => {
    const loader = new ElasticDataLoader({
      endpoint: 'https://my-elasticsearch-cluster.region.amazonaws.com',
    });
    axios.request.mockImplementation(async () => {
      return { data: { hits: {} } };
    });
    const req = {
      path: '[index]/_search',
      operation: 'GET',
      params: {
        headers: {},
        body: '{"query": { "match_all": {} }}',
      },
    };
    const data = await loader.load(req);
    expect(data).toEqual({ hits: {} });
  });

  it('should send a signed request', async () => {
    const loader = new ElasticDataLoader({
      endpoint: 'https://my-elasticsearch-cluster.region.amazonaws.com',
      useSignature: true,
      accessKeyId: 'fakeAccessKeyId',
      secretAccessKey: 'fakeSecretAccessKey',
      region: '',
    });
    const mockStream = new PassThrough();
    let signedRequest;
    AWS.HttpClient.prototype.handleRequest.mockImplementation(
      (request, _options, callback) => {
        signedRequest = request;
        callback(mockStream);
      },
    );
    const body = '{"query": { "match_all": {} }}';
    const req = {
      path: '[index]/_search',
      operation: 'GET',
      params: {
        headers: {},
        body,
      },
    };
    process.nextTick(() => {
      mockStream.emit('data', '{ "hits": {} }');
      mockStream.end();
    });
    const data = await loader.load(req);
    expect(signedRequest.headers.host).toEqual(
      'my-elasticsearch-cluster.region.amazonaws.com',
    );
    expect(signedRequest.headers['Authorization']).toMatch(/^AWS4-HMAC-SHA256/);
    expect(signedRequest.body).toEqual(body);
    expect(data).toEqual({ hits: {} });
  });
});
