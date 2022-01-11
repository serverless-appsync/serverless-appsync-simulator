[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release) ![Release](https://github.com/bboure/serverless-appsync-simulator/workflows/Release/badge.svg) <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-20-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

This serverless plugin is a wrapper for [amplify-appsync-simulator](https://github.com/aws-amplify/amplify-cli/tree/master/packages/amplify-appsync-simulator) made for testing AppSync APIs built with [serverless-appsync-plugin](https://github.com/sid88in/serverless-appsync-plugin).

# Requires

- [serverless framework](https://github.com/serverless/serverless)
- [serverless-appsync-plugin](https://github.com/sid88in/serverless-appsync-plugin)
- [serverless-offline](https://github.com/dherault/serverless-offline)
- [serverless-dynamodb-local](https://github.com/99xt/serverless-dynamodb-local) (when using dynamodb resolvers only)

# Install

```bash
npm install serverless-appsync-simulator
# or
yarn add serverless-appsync-simulator
```

# Usage

This plugin relies on your serverless yml file and on the `serverless-offline` plugin.

```yml
plugins:
  - serverless-dynamodb-local # only if you need dynamodb resolvers and you don't have an external dynamodb
  - serverless-appsync-simulator
  - serverless-offline
```

**Note:** Order is important `serverless-appsync-simulator` must go **before** `serverless-offline`

To start the simulator, run the following command:

```bash
sls offline start
```

You should see in the logs something like:

```bash
...
Serverless: AppSync endpoint: http://localhost:20002/graphql
Serverless: GraphiQl: http://localhost:20002
...
```

# Configuration

Put options under `custom.appsync-simulator` in your `serverless.yml` file

| option                   | default                    | description                                                                                                                                                                                          |
| ------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apiKey                   | `0123456789`               | When using `API_KEY` as authentication type, the key to authenticate to the endpoint.                                                                                                                |
| port                     | 20002                      | AppSync operations port; if using multiple APIs, the value of this option will be used as a starting point, and each other API will have a port of lastPort + 10 (e.g. 20002, 20012, 20022, etc.)    |
| wsPort                   | 20003                      | AppSync subscriptions port; if using multiple APIs, the value of this option will be used as a starting point, and each other API will have a port of lastPort + 10 (e.g. 20003, 20013, 20023, etc.) |
| location                 | . (base directory)         | Location of the lambda functions handlers.                                                                                                                                                           |
| refMap                   | {}                         | A mapping of [resource resolutions](#resource-cloudformation-functions-resolution) for the `Ref` function                                                                                            |
| getAttMap                | {}                         | A mapping of [resource resolutions](#resource-cloudformation-functions-resolution) for the `GetAtt` function                                                                                         |
| importValueMap           | {}                         | A mapping of [resource resolutions](#resource-cloudformation-functions-resolution) for the `ImportValue` function                                                                                    |
| functions                | {}                         | A mapping of [external functions](#functions) for providing invoke url for external fucntions                                                                                                        |
| dynamoDb.endpoint        | http://localhost:8000      | Dynamodb endpoint. Specify it if you're not using serverless-dynamodb-local. Otherwise, port is taken from dynamodb-local conf                                                                       |
| dynamoDb.region          | localhost                  | Dynamodb region. Specify it if you're connecting to a remote Dynamodb intance.                                                                                                                       |
| dynamoDb.accessKeyId     | DEFAULT_ACCESS_KEY         | AWS Access Key ID to access DynamoDB                                                                                                                                                                 |
| dynamoDb.secretAccessKey | DEFAULT_SECRET             | AWS Secret Key to access DynamoDB                                                                                                                                                                    |
| dynamoDb.sessionToken    | DEFAULT_ACCESS_TOKEEN      | AWS Session Token to access DynamoDB, only if you have temporary security credentials configured on AWS                                                                                              |
| dynamoDb.\*              |                            | You can add every configuration accepted by [DynamoDB SDK](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#constructor-property)                                               |
| rds.dbName               |                            | Name of the database                                                                                                                                                                                 |
| rds.dbHost               |                            | Database host                                                                                                                                                                                        |
| rds.dbDialect            |                            | Database dialect. Possible values (mysql|postgres)                                                                                                                                                   |
| rds.dbUsername           |                            | Database username                                                                                                                                                                                    |
| rds.dbPassword           |                            | Database password                                                                                                                                                                                    |
| rds.dbPort               |                            | Database port                                                                                                                                                                                        |
| watch                    | - \*.graphql<br/> - \*.vtl | Array of glob patterns to watch for hot-reloading.                                                                                                                                                   |

Example:

```yml
custom:
  appsync-simulator:
    location: '.webpack/service' # use webpack build directory
    dynamoDb:
      endpoint: 'http://my-custom-dynamo:8000'
```

# Hot-reloading

By default, the simulator will hot-relad when changes to `*.graphql` or `*.vtl` files are detected.
Changes to `*.yml` files are not supported (yet? - this is a Serverless Framework limitation). You will need to restart the simulator each time you change yml files.

Hot-reloading relies on [watchman](https://facebook.github.io/watchman). Make sure it is [installed](https://facebook.github.io/watchman/docs/install.html) on your system.

You can change the files being watched with the `watch` option, which is then passed to watchman as [the match expression](https://facebook.github.io/watchman/docs/expr/match.html).

e.g.

```
custom:
  appsync-simulator:
    watch:
      - ["match", "handlers/**/*.vtl", "wholename"] # => array is interpreted as the literal match expression
      - "*.graphql"                                 # => string like this is equivalent to `["match", "*.graphql"]`
```

Or you can opt-out by leaving an empty array or set the option to `false`

Note: Functions should not require hot-reloading, unless you are using a transpiler or a bundler (such as webpack, babel or typescript), un which case you should delegate hot-reloading to that instead.

# Resource CloudFormation functions resolution

This plugin supports _some_ resources resolution from the `Ref`, `Fn::GetAtt` and `Fn::ImportValue` functions
in your yaml file. It also supports _some_ other Cfn functions such as `Fn::Join`, `Fb::Sub`, etc.

**Note:** Under the hood, this features relies on the [cfn-resolver-lib](https://github.com/robessog/cfn-resolver-lib) package. For more info on supported cfn functions, refer to [the documentation](https://github.com/robessog/cfn-resolver-lib/blob/master/README.md)

## Basic usage

You can reference resources in your functions' environment variables (that will be accessible from your lambda functions) or datasource definitions.
The plugin will automatically resolve them for you.

```yaml
provider:
  environment:
    BUCKET_NAME:
      Ref: MyBucket # resolves to `my-bucket-name`

resources:
  Resources:
    MyDbTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: myTable
      ...
    MyBucket:
      Type: AWS::S3::Bucket
      Properties:
        BucketName: my-bucket-name
    ...

# in your appsync config
dataSources:
  - type: AMAZON_DYNAMODB
    name: dynamosource
    config:
      tableName:
        Ref: MyDbTable # resolves to `myTable`
```

## Override (or mock) values

Sometimes, some references **cannot** be resolved, as they come from an _Output_ from Cloudformation; or you might want to use mocked values in your local environment.

In those cases, you can define (or override) those values using the `refMap`, `getAttMap` and `importValueMap` options.

- `refMap` takes a mapping of _resource name_ to _value_ pairs
- `getAttMap` takes a mapping of _resource name_ to _attribute/values_ pairs
- `importValueMap` takes a mapping of _import name_ to _values_ pairs

Example:

```yaml
custom:
  appsync-simulator:
    refMap:
      # Override `MyDbTable` resolution from the previous example.
      MyDbTable: 'mock-myTable'
    getAttMap:
      # define ElasticSearchInstance DomainName
      ElasticSearchInstance:
        DomainEndpoint: 'localhost:9200'
    importValueMap:
      other-service-api-url: 'https://other.api.url.com/graphql'

# in your appsync config
dataSources:
  - type: AMAZON_ELASTICSEARCH
    name: elasticsource
    config:
      # endpoint resolves as 'http://localhost:9200'
      endpoint:
        Fn::Join:
          - ''
          - - https://
            - Fn::GetAtt:
                - ElasticSearchInstance
                - DomainEndpoint
```

### Key-value mock notation

In some special cases you will need to use key-value mock nottation.
Good example can be case when you need to include serverless stage value (`${self:provider.stage}`) in the import name.

_This notation can be used with all mocks - `refMap`, `getAttMap` and `importValueMap`_

```yaml
provider:
  environment:
    FINISH_ACTIVITY_FUNCTION_ARN:
      Fn::ImportValue: other-service-api-${self:provider.stage}-url

custom:
  serverless-appsync-simulator:
    importValueMap:
      - key: other-service-api-${self:provider.stage}-url
        value: 'https://other.api.url.com/graphql'
```

## Limitations

This plugin only tries to resolve the following parts of the yml tree:

- `provider.environment`
- `functions[*].environment`
- `custom.appSync`

If you have the need of resolving others, feel free to open an issue and explain your use case.

For now, the supported resources to be automatically resovled by `Ref:` are:

- DynamoDb tables
- S3 Buckets

Feel free to open a PR or an issue to extend them as well.

# External functions

When a function is not defined withing the current serverless file you can still call it by providing an invoke url which should point to a REST method. Make sure you specify "get" or "post" for the method. Default is "get", but you probably want "post".

```yaml
custom:
  appsync-simulator:
    functions:
      addUser:
        url: http://localhost:3016/2015-03-31/functions/addUser/invocations
        method: post
      addPost:
        url: https://jsonplaceholder.typicode.com/posts
        method: post
```

# Supported Resolver types

This plugin supports resolvers implemented by `amplify-appsync-simulator`, as well as custom resolvers.

**From Aws Amplify:**

- NONE
- AWS_LAMBDA
- AMAZON_DYNAMODB
- PIPELINE

**Implemented by this plugin**

- AMAZON_ELASTIC_SEARCH
- HTTP
- RELATIONAL_DATABASE

## Relational Database
### Sample VTL for a create mutation

```
#set( $cols = [] )
#set( $vals = [] )
#foreach( $entry in $ctx.args.input.keySet() )
  #set( $regex = "([a-z])([A-Z]+)")
  #set( $replacement = "$1_$2")
  #set( $toSnake = $entry.replaceAll($regex, $replacement).toLowerCase() )
  #set( $discard = $cols.add("$toSnake") )
  #if( $util.isBoolean($ctx.args.input[$entry]) )
      #if( $ctx.args.input[$entry] )
        #set( $discard = $vals.add("1") )
      #else
        #set( $discard = $vals.add("0") )
      #end
  #else
      #set( $discard = $vals.add("'$ctx.args.input[$entry]'") )
  #end
#end
#set( $valStr = $vals.toString().replace("[","(").replace("]",")") )
#set( $colStr = $cols.toString().replace("[","(").replace("]",")") )
#if ( $valStr.substring(0, 1) != '(' )
  #set( $valStr = "($valStr)" )
#end
#if ( $colStr.substring(0, 1) != '(' )
  #set( $colStr = "($colStr)" )
#end
{
  "version": "2018-05-29",
  "statements":   ["INSERT INTO <name-of-table> $colStr VALUES $valStr", "SELECT * FROM    <name-of-table> ORDER BY id DESC LIMIT 1"]
}
```

### Sample VTL for an update mutation
```
#set( $update = "" )
#set( $equals = "=" )
#foreach( $entry in $ctx.args.input.keySet() )
  #set( $cur = $ctx.args.input[$entry] )
  #set( $regex = "([a-z])([A-Z]+)")
  #set( $replacement = "$1_$2")
  #set( $toSnake = $entry.replaceAll($regex, $replacement).toLowerCase() )
  #if( $util.isBoolean($cur) )
      #if( $cur )
        #set ( $cur = "1" )
      #else
        #set ( $cur = "0" )
      #end
  #end
  #if ( $util.isNullOrEmpty($update) )
      #set($update = "$toSnake$equals'$cur'" )
  #else
      #set($update = "$update,$toSnake$equals'$cur'" )
  #end
#end
{
  "version": "2018-05-29",
  "statements":   ["UPDATE <name-of-table> SET $update WHERE id=$ctx.args.input.id", "SELECT * FROM <name-of-table> WHERE id=$ctx.args.input.id"]
}
```


### Sample resolver for delete mutation
```
{
  "version": "2018-05-29",
  "statements":   ["UPDATE <name-of-table> set deleted_at=NOW() WHERE id=$ctx.args.id", "SELECT * FROM <name-of-table> WHERE id=$ctx.args.id"]
}
```

### Sample mutation response VTL with support for handling AWSDateTime
```
#set ( $index = -1)
#set ( $result = $util.parseJson($ctx.result) )
#set ( $meta = $result.sqlStatementResults[1].columnMetadata)
#foreach ($column in $meta)
    #set ($index = $index + 1)
    #if ( $column["typeName"] == "timestamptz" )
        #set ($time = $result["sqlStatementResults"][1]["records"][0][$index]["stringValue"] )
        #set ( $nowEpochMillis = $util.time.parseFormattedToEpochMilliSeconds("$time.substring(0,19)+0000", "yyyy-MM-dd HH:mm:ssZ") )
        #set ( $isoDateTime = $util.time.epochMilliSecondsToISO8601($nowEpochMillis) )
        $util.qr( $result["sqlStatementResults"][1]["records"][0][$index].put("stringValue", "$isoDateTime") )
    #end   
#end
#set ( $res = $util.parseJson($util.rds.toJsonString($util.toJson($result)))[1][0] )
#set ( $response = {} )
#foreach($mapKey in $res.keySet())
    #set ( $s = $mapKey.split("_") )
    #set ( $camelCase="" )
    #set ( $isFirst=true )
    #foreach($entry in $s)
        #if ( $isFirst )
          #set ( $first = $entry.substring(0,1) )
        #else
          #set ( $first = $entry.substring(0,1).toUpperCase() )
        #end
        #set ( $isFirst=false )
        #set ( $stringLength = $entry.length() )
        #set ( $remaining = $entry.substring(1, $stringLength) )
        #set ( $camelCase = "$camelCase$first$remaining" )
    #end
    $util.qr( $response.put("$camelCase", $res[$mapKey]) )
#end
$utils.toJson($response)
```

### Using Variable Map
Variable map support is limited and does not differentiate numbers and strings data types, please inject them directly if needed.

Will be escaped properly: `null`, `true`, and `false` values.

```
{
  "version": "2018-05-29",
  "statements":   [
    "UPDATE <name-of-table> set deleted_at=NOW() WHERE id=:ID", 
    "SELECT * FROM <name-of-table> WHERE id=:ID and unix_timestamp > $ctx.args.newerThan"
  ],
  variableMap: {
    ":ID": $ctx.args.id,
##    ":TIMESTAMP": $ctx.args.newerThan -- This will be handled as a string!!!
  }
}
```

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://twitter.com/Benoit_Boure"><img src="https://avatars0.githubusercontent.com/u/7089997?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Benoît Bouré</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=bboure" title="Code">💻</a></td>
    <td align="center"><a href="http://filip.pyrek.cz/"><img src="https://avatars1.githubusercontent.com/u/6282843?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Filip Pýrek</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=FilipPyrek" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/marcoreni"><img src="https://avatars2.githubusercontent.com/u/2797489?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Marco Reni</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=marcoreni" title="Code">💻</a></td>
    <td align="center"><a href="https://egordmitriev.net/"><img src="https://avatars3.githubusercontent.com/u/4254771?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Egor Dmitriev</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=EgorDm" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/stschwark"><img src="https://avatars3.githubusercontent.com/u/900253?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Steffen Schwark</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=stschwark" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/moelholm"><img src="https://avatars2.githubusercontent.com/u/8393156?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Nicky Moelholm</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=moelholm" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/daisuke-awaji"><img src="https://avatars0.githubusercontent.com/u/20736455?v=4?s=100" width="100px;" alt=""/><br /><sub><b>g-awa</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=daisuke-awaji" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/LMulveyCM"><img src="https://avatars0.githubusercontent.com/u/39565663?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Lee Mulvey</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=LMulveyCM" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/JimmyHurrah"><img src="https://avatars1.githubusercontent.com/u/6367753?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jimmy Hurrah</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=JimmyHurrah" title="Code">💻</a></td>
    <td align="center"><a href="https://abda.la/"><img src="https://avatars1.githubusercontent.com/u/219340?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Abdala</b></sub></a><br /><a href="#ideas-abdala" title="Ideas, Planning, & Feedback">🤔</a></td>
    <td align="center"><a href="https://github.com/alexandrusavin"><img src="https://avatars2.githubusercontent.com/u/1612455?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Alexandru Savin</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=alexandrusavin" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/Scale93"><img src="https://avatars.githubusercontent.com/u/36473880?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Scale93</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=Scale93" title="Code">💻</a> <a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=Scale93" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/Liooo"><img src="https://avatars.githubusercontent.com/u/1630378?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ryo Yamada</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=Liooo" title="Code">💻</a> <a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=Liooo" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/h-kishi"><img src="https://avatars.githubusercontent.com/u/8940568?v=4?s=100" width="100px;" alt=""/><br /><sub><b>h-kishi</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=h-kishi" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/louislatreille"><img src="https://avatars.githubusercontent.com/u/8052355?v=4?s=100" width="100px;" alt=""/><br /><sub><b>louislatreille</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=louislatreille" title="Code">💻</a></td>
    <td align="center"><a href="http://aleksac.me"><img src="https://avatars.githubusercontent.com/u/25728391?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Aleksa Cukovic</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=AleksaC" title="Code">💻</a></td>
    <td align="center"><a href="https://vanmulligen.ca"><img src="https://avatars.githubusercontent.com/u/16951595?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Sean van Mulligen</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=seanvm" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/katesclau"><img src="https://avatars.githubusercontent.com/u/5067149?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Diego Rodrigues Ferreira</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=katesclau" title="Code">💻</a></td>
    <td align="center"><a href="https://www.wednesday.is/"><img src="https://avatars.githubusercontent.com/u/4958010?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Mohammed Ali Chherawalla</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=alichherawalla" title="Code">💻</a></td>
    <td align="center"><a href="https://adriantodt.net/"><img src="https://avatars.githubusercontent.com/u/6955035?v=4?s=100" width="100px;" alt=""/><br /><sub><b>AdrianTodt</b></sub></a><br /><a href="https://github.com/bboure/serverless-appsync-simulator/commits?author=adriantodt" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
