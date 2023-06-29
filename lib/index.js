"use strict";
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
var util_1 = require("util");
var amplify_appsync_simulator_1 = require("amplify-appsync-simulator");
var fb_watchman_1 = __importDefault(require("fb-watchman"));
var config_1 = require("./config");
var ElasticDataLoader_1 = __importDefault(require("./data-loaders/ElasticDataLoader"));
var HttpDataLoader_1 = __importDefault(require("./data-loaders/HttpDataLoader"));
var RelationalDataLoader_1 = __importDefault(require("./data-loaders/RelationalDataLoader"));
var ServerlessAppSyncSimulator = /** @class */ (function () {
    function ServerlessAppSyncSimulator(serverless) {
        this.options = {};
        this.serverless = serverless;
        var log = this.log.bind(this);
        this.log = log;
        this.debugLog = this.debugLog.bind(this);
        (0, config_1.setLogger)(log);
        (0, amplify_appsync_simulator_1.removeDataLoader)("AMAZON_OPENSEARCH_SERVICE" /* AppSyncSimulatorDataSourceType.OpenSearch */);
        (0, amplify_appsync_simulator_1.addDataLoader)("AMAZON_OPENSEARCH_SERVICE" /* AppSyncSimulatorDataSourceType.OpenSearch */, ElasticDataLoader_1.default);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        (0, amplify_appsync_simulator_1.addDataLoader)('HTTP', HttpDataLoader_1.default);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        (0, amplify_appsync_simulator_1.addDataLoader)('RELATIONAL_DATABASE', RelationalDataLoader_1.default);
        this.hooks = {
            'before:offline:start:init': this.startServers.bind(this),
            'before:offline:start:end': this.endServers.bind(this),
        };
    }
    ServerlessAppSyncSimulator.prototype.log = function (message, opts) {
        if (opts === void 0) { opts = {}; }
        return this.serverless.cli.log(message, 'AppSync Simulator', opts);
    };
    ServerlessAppSyncSimulator.prototype.debugLog = function (message, opts) {
        if (opts === void 0) { opts = {}; }
        if (process.env.SLS_DEBUG) {
            this.log(message, opts);
        }
    };
    ServerlessAppSyncSimulator.prototype.startServers = function () {
        return __awaiter(this, void 0, void 0, function () {
            var appSyncConfig, _a, config, options, simulator, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        appSyncConfig = this.serverless.configurationInput.appSync;
                        return [4 /*yield*/, (0, config_1.resolveConfiguration)(this.serverless.service, appSyncConfig, this.serverless.processedInput.options)];
                    case 1:
                        _a = _b.sent(), config = _a.config, options = _a.options, simulator = _a.simulator;
                        this.config = config;
                        this.options = options;
                        this.simulator = simulator;
                        if (Array.isArray(this.options.watch) && this.options.watch.length > 0) {
                            this.watch();
                        }
                        else {
                            this.initServers();
                        }
                        this.log("".concat(simulator.name, " AppSync endpoint: ").concat(simulator.amplifySimulator.url, "/graphql"));
                        this.log("".concat(simulator.name, " GraphQL: ").concat(simulator.amplifySimulator.url));
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _b.sent();
                        this.log(error_1, { color: 'red' });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ServerlessAppSyncSimulator.prototype.initServers = function () {
        var _a;
        var config = (0, config_1.buildAmplifyConfig)(this.config, this.serverless.service, this.options, this.serverless.config.servicePath);
        this.debugLog("AppSync Config ".concat(this.config.name));
        this.debugLog((0, util_1.inspect)(config, { depth: 4, colors: true }));
        (_a = this.simulator) === null || _a === void 0 ? void 0 : _a.amplifySimulator.init(config);
    };
    ServerlessAppSyncSimulator.prototype.watch = function () {
        var _this = this;
        var client = new fb_watchman_1.default.Client();
        var path = this.serverless.config.servicePath;
        // Try to watch for changes in AppSync configuration
        client.command(['watch-project', path], function (error, resp) {
            if (error) {
                console.error('Error initiating watch:', error);
                console.log('AppSync Simulator hot-reloading will not be available');
                // init server once
                _this.initServers();
                return;
            }
            if ('warning' in resp) {
                console.log('warning: ', resp.warning);
            }
            // Watch for changes in vtl and schema files.
            var sub = {
                expression: __spreadArray([
                    'anyof'
                ], _this.options.watch.map(function (glob) {
                    if (Array.isArray(glob)) {
                        return glob;
                    }
                    return ['match', glob];
                }), true),
                fields: ['name'],
                since: resp.clock,
            };
            var watch = resp.watch, relative_path = resp.relative_path;
            if (relative_path) {
                sub.relative_root = relative_path;
            }
            // init subscription
            client.command(['subscribe', watch, 'appsync-simulator', sub], function (error) {
                if (error) {
                    console.error('Failed to subscribe: ', error);
                    return;
                }
            });
        });
        client.on('subscription', function (resp) {
            if (resp.subscription === 'appsync-simulator') {
                console.log('Hot-reloading AppSync simulator...');
                _this.initServers();
            }
        });
    };
    ServerlessAppSyncSimulator.prototype.endServers = function () {
        if (this.simulator != null) {
            this.log('Halting AppSync Simulator');
            this.simulator.amplifySimulator.stop();
        }
    };
    return ServerlessAppSyncSimulator;
}());
module.exports = ServerlessAppSyncSimulator;
//# sourceMappingURL=index.js.map