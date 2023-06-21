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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
var mysql2_1 = require("mysql2");
var promise_1 = __importDefault(require("mysql2/promise"));
var pg_1 = require("pg");
var FLAGS = {
    NOT_NULL: 1,
    PRI_KEY: 2,
    UNIQUE_KEY: 4,
    MULTIPLE_KEY: 8,
    BLOB: 16,
    UNSIGNED: 32,
    ZEROFILL: 64,
    BINARY: 128,
    ENUM: 256,
    AUTO_INCREMENT: 512,
    TIMESTAMP: 1024,
    SET: 2048,
    NO_DEFAULT_VALUE: 4096,
    ON_UPDATE_NOW: 8192,
    NUM: 32768,
};
var decToBin = function (dec) { return parseInt((dec >>> 0).toString(2), 2); };
var convertMySQLResponseToColumnMetaData = function (rows) {
    return rows.map(function (row) {
        // @TODO: Add for the following fields
        // arrayBaseColumnType,
        // isCaseSensitive,
        // isCurrency,
        // currency,
        // precision,
        // scale,
        // schemaName,
        return {
            isAutoIncrement: decToBin(row.flags & FLAGS.AUTO_INCREMENT) === FLAGS.AUTO_INCREMENT,
            label: row.name,
            name: row.name,
            nullable: decToBin(row.flags && FLAGS.NOT_NULL) !== FLAGS.NOT_NULL,
            type: row.columnType,
            typeName: (function () {
                for (var _i = 0, _a = Object.entries(mysql2_1.Types); _i < _a.length; _i++) {
                    var _b = _a[_i], key = _b[0], value = _b[1];
                    if (value === row.columnType) {
                        return key.toUpperCase();
                    }
                }
                return 'UNKNOWN';
            })(),
            isSigned: decToBin(row.flags & FLAGS.UNSIGNED) !== FLAGS.UNSIGNED,
            autoIncrement: decToBin(row.flags & FLAGS.AUTO_INCREMENT) === FLAGS.AUTO_INCREMENT,
            tableName: row._buf
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                .slice(row._tableStart, row._tableStart + row._tableLength)
                .toString(),
        };
    });
};
var convertSQLResponseToRDSRecords = function (rows) {
    var records = [];
    rows.forEach(function (dbObject) {
        var record = [];
        Object.keys(dbObject).forEach(function (key) {
            record.push(dbObject[key] === null
                ? { isNull: true, null: true }
                : typeof dbObject[key] === 'string'
                    ? { stringValue: dbObject[key] }
                    : typeof dbObject[key] === 'number'
                        ? { longValue: dbObject[key] }
                        : { stringValue: dbObject[key] });
        });
        records.push(record);
    });
    return records;
};
var convertPostgresSQLResponseToColumnMetaData = function (rows) {
    return rows.map(function (row) {
        var typeName = (function () {
            for (var _i = 0, _a = Object.entries(pg_1.types.builtins); _i < _a.length; _i++) {
                var _b = _a[_i], key = _b[0], value = _b[1];
                if (value === row.dataTypeID) {
                    return key;
                }
            }
            return 'UNKNOWN';
        })();
        // @TODO: Add support for the following fields
        // isAutoIncrement,
        // nullable,
        // isSigned,
        // autoIncrement,
        // tableName,
        // arrayBaseColumnType,
        // isCaseSensitive,
        // isCurrency,
        // currency,
        // precision,
        // scale,
        // schemaName,
        return {
            label: row.name,
            name: row.name,
            type: row.dataTypeID,
            typeName: typeName,
        };
    });
};
var injectVariables = function (statement, req) {
    var variableMap = req.variableMap;
    if (!variableMap) {
        return statement;
    }
    var result = Object.keys(variableMap).reduce(function (statmnt, key) {
        // Adds 'g' for replaceAll effect
        var re = new RegExp(key, 'g');
        if (variableMap[key] === null || typeof variableMap[key] == 'boolean') {
            return statmnt.replace(re, "".concat(variableMap[key]));
        }
        // @TODO: Differentiate number from string inputs...
        return statmnt.replace(re, "'".concat(variableMap[key], "'"));
    }, statement);
    return result;
};
var executeSqlStatements = function (client, req) { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, statement, sql, result, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!client) {
                    throw new Error('RDS client not initialized');
                }
                _i = 0, _a = req.statements;
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 6];
                statement = _a[_i];
                sql = injectVariables(statement, req);
                _b.label = 2;
            case 2:
                _b.trys.push([2, 4, , 5]);
                return [4 /*yield*/, client.query(sql)];
            case 3:
                result = _b.sent();
                return [2 /*return*/, result];
            case 4:
                error_1 = _b.sent();
                console.log("RDS_DATALOADER: Failed to execute: ", statement, error_1);
                throw error_1;
            case 5:
                _i++;
                return [3 /*break*/, 1];
            case 6: return [2 /*return*/];
        }
    });
}); };
var RelationalDataLoader = /** @class */ (function () {
    function RelationalDataLoader(config) {
        this.config = config;
        this.client = null;
    }
    RelationalDataLoader.prototype.getClient = function () {
        return __awaiter(this, void 0, void 0, function () {
            var requiredKeys, missingKey, dbConfig, _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.client) {
                            return [2 /*return*/, this.client];
                        }
                        requiredKeys = [
                            'dbDialect',
                            'dbUsername',
                            'dbPassword',
                            'dbHost',
                            'dbName',
                            'dbPort',
                        ];
                        if (!this.config.rds) {
                            throw new Error('RDS configuration not passed');
                        }
                        missingKey = requiredKeys.find(function (key) {
                            return !_this.config.rds[key];
                        });
                        if (missingKey) {
                            throw new Error("".concat(missingKey, " is required."));
                        }
                        dbConfig = {
                            host: this.config.rds.dbHost,
                            user: this.config.rds.dbUsername,
                            password: this.config.rds.dbPassword,
                            database: this.config.rds.dbName,
                            port: this.config.rds.dbPort,
                        };
                        if (!(this.config.rds.dbDialect === 'mysql')) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, promise_1.default.createConnection(dbConfig)];
                    case 1:
                        _a.client = _b.sent();
                        return [3 /*break*/, 4];
                    case 2:
                        if (!(this.config.rds.dbDialect === 'postgres')) return [3 /*break*/, 4];
                        this.client = new pg_1.Client(dbConfig);
                        return [4 /*yield*/, this.client.connect()];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4: return [2 /*return*/, this.client];
                }
            });
        });
    };
    RelationalDataLoader.prototype.load = function (req) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var client, res, results, e_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.getClient()];
                    case 1:
                        client = _b.sent();
                        res = {};
                        return [4 /*yield*/, executeSqlStatements(client, req)];
                    case 2:
                        results = _b.sent();
                        if (((_a = this.config.rds) === null || _a === void 0 ? void 0 : _a.dbDialect) === 'mysql') {
                            res.sqlStatementResults = results.map(function (result) {
                                if (result.length < 2) {
                                    return {};
                                }
                                if (!result[1]) {
                                    // not a select query
                                    return {
                                        numberOfRecordsUpdated: result[0].affectedRows,
                                        generatedFields: [],
                                    };
                                }
                                return {
                                    numberOfRecordsUpdated: result[0].length,
                                    records: convertSQLResponseToRDSRecords(result[0]),
                                    columnMetadata: convertMySQLResponseToColumnMetaData(result[1]),
                                };
                            });
                        }
                        else if (this.config.rds.dbDialect === 'postgres') {
                            res.sqlStatementResults = results.map(function (result) {
                                return {
                                    numberOfRecordsUpdated: result.rowCount,
                                    records: convertSQLResponseToRDSRecords(result.rows),
                                    columnMetadata: convertPostgresSQLResponseToColumnMetaData(result.fields),
                                    generatedFields: [],
                                };
                            });
                        }
                        return [2 /*return*/, res];
                    case 3:
                        e_1 = _b.sent();
                        console.log(e_1);
                        return [2 /*return*/, e_1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return RelationalDataLoader;
}());
exports.default = RelationalDataLoader;
//# sourceMappingURL=RelationalDataLoader.js.map