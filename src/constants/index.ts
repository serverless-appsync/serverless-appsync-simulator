export const DEFAULT_MAPPING_TEMPLATE_LOCATION = 'mapping-templates';
export const DEFAULT_ENCODING = 'utf8';
export const DEFAULT_SCHEMA_FILE = 'schema.graphql';
export const DEFAULT_HTTP_METHOD = 'POST';
export const DEFAULT_RESOLVER_TYPE = 'UNIT';

export type HTTPMessage = 'request' | 'response';
export type MappingTemplateType = 'mappingTemplate' | 'functionConfiguration';
export type SourceType =
  | 'AMAZON_DYNAMODB'
  | 'RELATIONAL_DATABASE'
  | 'AWS_LAMBDA'
  | 'AMAZON_ELASTICSEARCH'
  | 'HTTP';
