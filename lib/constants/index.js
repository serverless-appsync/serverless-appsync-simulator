"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SourceType = exports.MappingTemplateType = exports.HTTPMessage = exports.DEFAULT_SCHEMA_FILE = exports.DEFAULT_RESOLVER_TYPE = exports.DEFAULT_MAPPING_TEMPLATE_LOCATION = exports.DEFAULT_HTTP_METHOD = exports.DEFAULT_ENCODING = void 0;
const DEFAULT_MAPPING_TEMPLATE_LOCATION = 'mapping-templates';
exports.DEFAULT_MAPPING_TEMPLATE_LOCATION = DEFAULT_MAPPING_TEMPLATE_LOCATION;
const DEFAULT_ENCODING = 'utf8';
exports.DEFAULT_ENCODING = DEFAULT_ENCODING;
const DEFAULT_SCHEMA_FILE = 'schema.graphql';
exports.DEFAULT_SCHEMA_FILE = DEFAULT_SCHEMA_FILE;
const DEFAULT_HTTP_METHOD = 'POST';
exports.DEFAULT_HTTP_METHOD = DEFAULT_HTTP_METHOD;
const DEFAULT_RESOLVER_TYPE = 'UNIT';
exports.DEFAULT_RESOLVER_TYPE = DEFAULT_RESOLVER_TYPE;
const HTTPMessage = {
  REQUEST: 'request',
  RESPONSE: 'response'
};
exports.HTTPMessage = HTTPMessage;
const MappingTemplateType = {
  MAPPING_TEMPLATE: 'mappingTemplate',
  FUNCTION_CONFIGURATION: 'functionConfiguration'
};
exports.MappingTemplateType = MappingTemplateType;
const SourceType = {
  AMAZON_DYNAMODB: 'AMAZON_DYNAMODB',
  RELATIONAL_DATABASE: 'RELATIONAL_DATABASE',
  AWS_LAMBDA: 'AWS_LAMBDA',
  AMAZON_ELASTICSEARCH: 'AMAZON_ELASTICSEARCH',
  HTTP: 'HTTP'
};
exports.SourceType = SourceType;