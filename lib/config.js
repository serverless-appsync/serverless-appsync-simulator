"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAmplifyConfig = exports.resolveConfiguration = exports.setLogger = void 0;
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
var fs_1 = require("fs");
var path_1 = __importDefault(require("path"));
var merge_1 = require("@graphql-tools/merge");
var amplify_appsync_simulator_1 = require("amplify-appsync-simulator");
var aws_sdk_1 = require("aws-sdk");
var cfn_resolver_lib_1 = __importDefault(require("cfn-resolver-lib"));
var lodash_1 = require("lodash");
var constants_1 = require("./constants");
var getAppSyncConfig_1 = require("./getAppSyncConfig");
var utils_1 = require("./types/utils");
var utils_2 = require("./utils");
var directLambdaMappingTemplates = {
    request: "## Direct lambda request\n  {\n      \"version\": \"2018-05-29\",\n      \"operation\": \"Invoke\",\n      \"payload\": $utils.toJson($context)\n  }\n  ",
    response: "## Direct lambda response\n  #if($ctx.error)\n      $util.error($ctx.error.message, $ctx.error.type, $ctx.result)\n  #end\n  $util.toJson($ctx.result)\n  ",
};
var resolverPathMap = {
    'AWS::DynamoDB::Table': 'Properties.TableName',
    'AWS::S3::Bucket': 'Properties.BucketName',
};
var logger;
function setLogger(newLogger) {
    logger = newLogger;
}
exports.setLogger = setLogger;
function resolveConfiguration(service, appSyncConfig, cliOptions) {
    return __awaiter(this, void 0, void 0, function () {
        var originalConfig, options, resourceResolvers, config, simulator;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    originalConfig = (0, getAppSyncConfig_1.getAppSyncConfig)(appSyncConfig);
                    options = buildResolvedOptions(service);
                    resourceResolvers = buildResourceResolvers(service, options);
                    service.functions = resolveResources(service.functions, service.resources, resourceResolvers);
                    service.provider.environment = resolveResources(service.provider.environment, service.resources, resourceResolvers);
                    config = resolveResources(originalConfig, service.resources, resourceResolvers);
                    _a = {};
                    return [4 /*yield*/, startIndividualServer(options.port, options.wsPort)];
                case 1:
                    simulator = (_a.amplifySimulator = _b.sent(),
                        _a.name = config.name,
                        _a);
                    options.lambdaPort = getLambdaPort(service, cliOptions);
                    return [2 /*return*/, { config: config, options: options, simulator: simulator }];
            }
        });
    });
}
exports.resolveConfiguration = resolveConfiguration;
function buildResolvedOptions(service) {
    var _a;
    var options = (0, lodash_1.merge)({
        apiKey: '0123456789',
        port: 20002,
        wsPort: 20003,
        location: '.',
        refMap: {},
        getAttMap: {},
        importValueMap: {},
        rds: {},
        dynamoDb: {
            endpoint: "http://localhost:".concat((0, lodash_1.get)(service, 'custom.dynamodb.start.port', 8000)),
            region: 'localhost',
            accessKeyId: 'DEFAULT_ACCESS_KEY',
            secretAccessKey: 'DEFAULT_SECRET',
        },
        openSearch: {},
    }, (0, lodash_1.get)(service, 'custom.appsync-simulator', {}));
    (_a = options.watch) !== null && _a !== void 0 ? _a : (options.watch = ['*.graphql', '*.vtl']);
    return options;
}
function buildResourceResolvers(service, options) {
    var _a, _b;
    var refResolvers = (0, lodash_1.reduce)((_b = (_a = service.resources) === null || _a === void 0 ? void 0 : _a.Resources) !== null && _b !== void 0 ? _b : {}, function (acc, res, name) {
        var _a;
        var path = resolverPathMap[res.Type];
        if (path !== undefined) {
            return __assign(__assign({}, acc), (_a = {}, _a[name] = (0, lodash_1.get)(res, path, null), _a));
        }
        return acc;
    }, {});
    var keyValueArrayToObject = function (mapping) {
        if (Array.isArray(mapping)) {
            return mapping.reduce(function (acc, _a) {
                var _b;
                var key = _a.key, value = _a.value;
                return (__assign(__assign({}, acc), (_b = {}, _b[key] = value, _b)));
            }, {});
        }
        return mapping;
    };
    return {
        RefResolvers: __assign(__assign(__assign({}, refResolvers), keyValueArrayToObject(options.refMap)), { 
            // Add region for cfn-resolver-lib GetAZs
            'AWS::Region': service.provider.region }),
        'Fn::GetAttResolvers': keyValueArrayToObject(options.getAttMap),
        'Fn::ImportValueResolvers': keyValueArrayToObject(options.importValueMap),
    };
}
function startIndividualServer(port, wsPort) {
    return __awaiter(this, void 0, void 0, function () {
        var simulator;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    simulator = new amplify_appsync_simulator_1.AmplifyAppSyncSimulator({ port: port, wsPort: wsPort });
                    return [4 /*yield*/, simulator.start()];
                case 1:
                    _a.sent();
                    return [2 /*return*/, simulator];
            }
        });
    });
}
function getLambdaPort(service, cliOptions) {
    var _a;
    // Default serverless-offline lambdaPort is 3002
    var port = 3002;
    var offlineConfig = (_a = service.custom) === null || _a === void 0 ? void 0 : _a['serverless-offline'];
    // Check if the user has defined a specific port as part of their serverless.yml
    if (offlineConfig != undefined &&
        typeof offlineConfig === 'object' &&
        'lambdaPort' in offlineConfig) {
        port = offlineConfig.lambdaPort;
    }
    // Check to see if a port override was specified as part of the CLI arguments
    if (cliOptions != undefined && cliOptions.lambdaPort != undefined) {
        port = cliOptions.lambdaPort;
    }
    return port;
}
/**
 * Resolves resources through `Ref:` or `Fn:GetAtt`
 */
function resolveResources(toBeResolved, resources, resourceResolvers) {
    // Pass all resources to allow Fn::GetAtt and Conditions resolution
    var node = __assign(__assign({}, resources), { toBeResolved: toBeResolved, Parameters: {} });
    var evaluator = new cfn_resolver_lib_1.default(node, resourceResolvers);
    var result = evaluator.evaluateNodes();
    if (result && result.toBeResolved) {
        return result.toBeResolved;
    }
    return toBeResolved;
}
function buildAmplifyConfig(config, service, options, servicePath) {
    var _a;
    var appSync = {
        name: config.name,
        apiKey: options.apiKey,
        defaultAuthenticationType: buildAuthType(config.authentication),
        additionalAuthenticationProviders: (config.additionalAuthentications || []).map(buildAuthType),
    };
    // Load the schema. If multiple provided, merge them
    var schemaPaths = Array.isArray(config.schema)
        ? config.schema
        : [config.schema || constants_1.DEFAULT_SCHEMA_FILE];
    var basePath = servicePath;
    var schemas = (0, utils_2.globFilePaths)(basePath, schemaPaths).map(function (schemaPath) {
        return (0, utils_2.getFileMap)(basePath, schemaPath);
    });
    var schema = {
        path: (_a = schemas[0]) === null || _a === void 0 ? void 0 : _a.path,
        content: (0, merge_1.mergeTypeDefs)(schemas.map(function (s) { return s.content; }), {
            useSchemaDefinition: true,
            forceSchemaDefinition: true,
            throwOnConflict: true,
            commentDescriptions: true,
            reverseDirectives: true,
        }),
    };
    return {
        appSync: appSync,
        schema: schema,
        resolvers: Object.values(config.resolvers)
            .map(function (r) { return buildResolver(r, config, servicePath); })
            .filter(utils_1.nonNullable),
        functions: Object.values(config.pipelineFunctions).map(buildFunction),
        dataSources: Object.values(config.dataSources)
            .map(function (d) { return buildDataSource(d, service, options); })
            .filter(utils_1.nonNullable),
    };
}
exports.buildAmplifyConfig = buildAmplifyConfig;
function buildAuthType(auth) {
    var authenticationType = auth.type;
    switch (authenticationType) {
        case amplify_appsync_simulator_1.AmplifyAppSyncSimulatorAuthenticationType.AMAZON_COGNITO_USER_POOLS:
            return {
                authenticationType: amplify_appsync_simulator_1.AmplifyAppSyncSimulatorAuthenticationType.AMAZON_COGNITO_USER_POOLS,
                cognitoUserPoolConfig: {
                    AppIdClientRegex: auth.config.appIdClientRegex,
                },
            };
        case amplify_appsync_simulator_1.AmplifyAppSyncSimulatorAuthenticationType.OPENID_CONNECT:
            return {
                authenticationType: amplify_appsync_simulator_1.AmplifyAppSyncSimulatorAuthenticationType.OPENID_CONNECT,
                openIDConnectConfig: {
                    Issuer: auth.config.issuer,
                    ClientId: auth.config.clientId,
                },
            };
        case amplify_appsync_simulator_1.AmplifyAppSyncSimulatorAuthenticationType.API_KEY:
            return {
                authenticationType: amplify_appsync_simulator_1.AmplifyAppSyncSimulatorAuthenticationType.API_KEY,
            };
        case amplify_appsync_simulator_1.AmplifyAppSyncSimulatorAuthenticationType.AWS_IAM:
            return {
                authenticationType: amplify_appsync_simulator_1.AmplifyAppSyncSimulatorAuthenticationType.AWS_IAM,
            };
        case amplify_appsync_simulator_1.AmplifyAppSyncSimulatorAuthenticationType.AWS_LAMBDA:
            return {
                authenticationType: amplify_appsync_simulator_1.AmplifyAppSyncSimulatorAuthenticationType.AWS_LAMBDA,
                lambdaAuthorizerConfig: {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    AuthorizerUri: auth.config.identityValidationExpression,
                    AuthorizerResultTtlInSeconds: auth.config.authorizerResultTtlInSeconds,
                },
            };
        default:
            throw new Error("Unknown authentication type: ".concat(authenticationType));
    }
}
function buildResolver(resolver, config, servicePath) {
    switch (resolver.kind) {
        case amplify_appsync_simulator_1.RESOLVER_KIND.UNIT:
            return {
                kind: amplify_appsync_simulator_1.RESOLVER_KIND.UNIT,
                fieldName: resolver.field,
                typeName: resolver.type,
                dataSourceName: resolver.dataSource,
                requestMappingTemplate: buildMappingTemplate(resolver, 'request', config, servicePath),
                responseMappingTemplate: buildMappingTemplate(resolver, 'response', config, servicePath),
            };
        case amplify_appsync_simulator_1.RESOLVER_KIND.PIPELINE:
            return {
                kind: amplify_appsync_simulator_1.RESOLVER_KIND.PIPELINE,
                fieldName: resolver.field,
                typeName: resolver.type,
                functions: resolver.functions,
                requestMappingTemplate: buildMappingTemplate(resolver, 'request', config, servicePath),
                responseMappingTemplate: buildMappingTemplate(resolver, 'response', config, servicePath),
            };
        default:
            return undefined;
    }
}
function buildFunction(config) {
    var _a, _b;
    return {
        name: config.name,
        dataSourceName: config.dataSource,
        requestMappingTemplateLocation: (_a = config.request) !== null && _a !== void 0 ? _a : '',
        responseMappingTemplateLocation: (_b = config.response) !== null && _b !== void 0 ? _b : '',
    };
}
function buildMappingTemplate(resolver, type, config, servicePath) {
    var _a = resolver.substitutions, substitutions = _a === void 0 ? {} : _a;
    var templatePath = resolver[type];
    // Direct lambda
    // For direct lambdas, we use a default mapping template
    // See https://amzn.to/3ncV3Dz
    if (!templatePath) {
        return directLambdaMappingTemplates[type];
    }
    else {
        var mappingTemplate = (0, fs_1.readFileSync)(path_1.default.join(servicePath, templatePath), {
            encoding: constants_1.DEFAULT_ENCODING,
        });
        // Substitutions
        var allSubstitutions = __assign(__assign({}, config.substitutions), substitutions);
        for (var _i = 0, _b = Object.entries(allSubstitutions); _i < _b.length; _i++) {
            var _c = _b[_i], variable = _c[0], value = _c[1];
            var regExp = new RegExp("\\${?".concat(variable, "}?"), 'g');
            mappingTemplate = mappingTemplate.replace(regExp, value);
        }
        return mappingTemplate;
    }
}
function buildDataSource(source, service, options) {
    var _this = this;
    if (source.name === undefined || source.type === undefined) {
        return null;
    }
    var dataSource = {
        name: source.name,
        type: source.type,
    };
    switch (source.type) {
        case 'AMAZON_DYNAMODB': {
            return __assign(__assign({}, dataSource), { config: __assign(__assign({}, options.dynamoDb), { tableName: source.config.tableName }) });
        }
        case 'RELATIONAL_DATABASE': {
            return __assign(__assign({}, dataSource), { rds: options.rds });
        }
        case 'AWS_LAMBDA': {
            var func_1 = (function (config) {
                var _a, _b;
                if ('functionName' in config) {
                    var name_1 = config.functionName;
                    return ((_a = options.functions) === null || _a === void 0 ? void 0 : _a[name_1]) || ((_b = service.functions) === null || _b === void 0 ? void 0 : _b[name_1]);
                }
                else if ('function' in config) {
                    return config.function;
                }
                else if ('functionArn' in config) {
                    // return config.functionArn;
                    logger('On DataSource, using functionArn pattern is not supported.', {
                        color: 'orange',
                    });
                }
                return null;
            })(source.config);
            if (func_1 == null) {
                logger("The ".concat(source.name, " function is not defined"), {
                    color: 'orange',
                });
                return null;
            }
            var lambda_1 = new aws_sdk_1.Lambda({
                apiVersion: '2015-03-31',
                region: 'localhost',
                endpoint: "http://localhost:".concat(options.lambdaPort),
            });
            return __assign(__assign({}, dataSource), { invoke: function (payload) { return __awaiter(_this, void 0, void 0, function () {
                    var params, result, s_1, data, s;
                    var _a, _b, _c;
                    return __generator(this, function (_d) {
                        switch (_d.label) {
                            case 0:
                                params = {
                                    FunctionName: func_1.name,
                                    InvocationType: 'RequestResponse',
                                    Payload: JSON.stringify(payload),
                                };
                                return [4 /*yield*/, lambda_1.invoke(params).promise()];
                            case 1:
                                result = _d.sent();
                                if (result.StatusCode !== 200) {
                                    throw new Error("Request failed with status code ".concat((_a = result.StatusCode) !== null && _a !== void 0 ? _a : ''));
                                }
                                if (result.FunctionError) {
                                    s_1 = (_b = result.Payload) === null || _b === void 0 ? void 0 : _b.toLocaleString();
                                    if (s_1 != null) {
                                        data = JSON.parse(s_1);
                                        throw {
                                            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                                            type: "Lambda:".concat(data.errorType),
                                            message: data.errorMessage,
                                        };
                                    }
                                    else {
                                        throw new Error(result.FunctionError);
                                    }
                                }
                                s = (_c = result.Payload) === null || _c === void 0 ? void 0 : _c.toLocaleString();
                                if (s == null) {
                                    return [2 /*return*/, null];
                                }
                                else {
                                    return [2 /*return*/, JSON.parse(s)];
                                }
                                return [2 /*return*/];
                        }
                    });
                }); } });
        }
        case 'AMAZON_OPENSEARCH_SERVICE':
            return __assign(__assign(__assign({}, options.openSearch), dataSource), { endpoint: source.config.endpoint });
        case 'HTTP': {
            return __assign(__assign({}, dataSource), { endpoint: source.config.endpoint });
        }
        default:
            return dataSource;
    }
}
//# sourceMappingURL=config.js.map