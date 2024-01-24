/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PassThrough } from 'stream';
import * as AWS from 'aws-sdk';
import axios from 'axios';
import ElasticDataLoader from '../../data-loaders/ElasticDataLoader';

describe('data-loaders/ElasticDataLoader', () => {
  it('should send a request', async () => {
    const spyRequest = jest.spyOn(axios, 'request');
    spyRequest.mockImplementation(async () => {
      return Promise.resolve({ data: { hits: {} } });
    });

    const loader = new ElasticDataLoader({
      endpoint: 'https://my-elasticsearch-cluster.region.amazonaws.com',
    });
    const req = {
      path: '[index]/_search',
      operation: 'GET',
      params: {
        headers: {},
        queryString: '',
        body: '{"query": { "match_all": {} }}',
      },
    };
    const data = await loader.load(req);
    expect(data).toEqual({ hits: {} });
  });

  it('should send a signed request', async () => {
    const spyHandleRequest = jest.spyOn(
      // @ts-ignore
      AWS.HttpClient.prototype,
      'handleRequest',
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let signedRequest: any;
    const mockStream = new PassThrough();
    spyHandleRequest.mockImplementation((request, _options, callback) => {
      signedRequest = request;
      // @ts-ignore
      callback(mockStream);
    });

    const loader = new ElasticDataLoader({
      endpoint: 'https://my-elasticsearch-cluster.region.amazonaws.com',
      useSignature: true,
      accessKeyId: 'fakeAccessKeyId',
      secretAccessKey: 'fakeSecretAccessKey',
      region: '',
    });
    const body = '{"query": { "match_all": {} }}';
    const req = {
      path: '[index]/_search',
      operation: 'GET',
      params: {
        headers: {},
        queryString: '',
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
