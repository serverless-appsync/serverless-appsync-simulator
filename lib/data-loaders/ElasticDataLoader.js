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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
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
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
var AWS = __importStar(require("aws-sdk"));
var axios_1 = __importDefault(require("axios"));
var ElasticDataLoader = /** @class */ (function () {
    function ElasticDataLoader(config) {
        this.config = config;
    }
    ElasticDataLoader.prototype.load = function (req) {
        return __awaiter(this, void 0, void 0, function () {
            var signedRequest_1, client_1, data, data, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        if (!this.config.useSignature) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.createSignedRequest(req)];
                    case 1:
                        signedRequest_1 = _a.sent();
                        client_1 = new AWS.HttpClient();
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                client_1.handleRequest(signedRequest_1, null, function (response) {
                                    var responseBody = '';
                                    response.on('data', function (chunk) {
                                        responseBody += chunk;
                                    });
                                    response.on('end', function () {
                                        resolve(responseBody);
                                    });
                                }, function (err) {
                                    reject(err);
                                });
                            })];
                    case 2:
                        data = _a.sent();
                        return [2 /*return*/, JSON.parse(data)];
                    case 3: return [4 /*yield*/, axios_1.default.request({
                            baseURL: this.config.endpoint,
                            url: req.path,
                            headers: req.params.headers,
                            params: req.params.queryString,
                            method: req.operation.toLowerCase(),
                            data: req.params.body,
                        })];
                    case 4:
                        data = (_a.sent()).data;
                        return [2 /*return*/, data];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        err_1 = _a.sent();
                        console.log(err_1);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/, null];
                }
            });
        });
    };
    ElasticDataLoader.prototype.createSignedRequest = function (req) {
        return __awaiter(this, void 0, void 0, function () {
            var domain, headers, endpoint, httpRequest, credentials, signer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        domain = this.config.endpoint.replace('https://', '');
                        headers = __assign(__assign({}, req.params.headers), { host: domain, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(req.params.body) });
                        endpoint = new AWS.Endpoint(domain);
                        httpRequest = new AWS.HttpRequest(endpoint, this.config.region);
                        httpRequest.headers = headers;
                        httpRequest.body = req.params.body;
                        httpRequest.method = req.operation;
                        httpRequest.path = req.path;
                        return [4 /*yield*/, this.getCredentials()];
                    case 1:
                        credentials = _a.sent();
                        signer = new AWS.Signers.V4(httpRequest, 'es');
                        signer.addAuthorization(credentials, new Date());
                        return [2 /*return*/, httpRequest];
                }
            });
        });
    };
    ElasticDataLoader.prototype.getCredentials = function () {
        return __awaiter(this, void 0, void 0, function () {
            var chain;
            var _this = this;
            return __generator(this, function (_a) {
                chain = new AWS.CredentialProviderChain([
                    function () { return new AWS.EnvironmentCredentials('AWS'); },
                    function () { return new AWS.EnvironmentCredentials('AMAZON'); },
                    function () { return new AWS.SharedIniFileCredentials(); },
                ]);
                if (this.config.accessKeyId && this.config.secretAccessKey) {
                    chain.providers.unshift(function () {
                        return new AWS.Credentials(_this.config.accessKeyId, _this.config.secretAccessKey);
                    });
                }
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        return chain.resolve(function (err, creds) {
                            if (err) {
                                reject(err);
                            }
                            else {
                                resolve(creds);
                            }
                        });
                    })];
            });
        });
    };
    return ElasticDataLoader;
}());
exports.default = ElasticDataLoader;
//# sourceMappingURL=ElasticDataLoader.js.map