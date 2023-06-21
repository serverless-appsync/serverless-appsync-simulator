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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppSyncConfig = void 0;
var lodash_1 = require("lodash");
var flattenMaps = function (input) {
    if (Array.isArray(input)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return lodash_1.merge.apply(void 0, __spreadArray([{}], input, false));
    }
    else {
        return (0, lodash_1.merge)({}, input);
    }
};
var isUnitResolver = function (resolver) {
    return resolver.kind === 'UNIT';
};
var isPipelineResolver = function (resolver) {
    return !resolver.kind || resolver.kind === 'PIPELINE';
};
var toResourceName = function (name) {
    return name.replace(/[^a-z_]/i, '_');
};
var getAppSyncConfig = function (config) {
    var schema = Array.isArray(config.schema)
        ? config.schema
        : [config.schema || 'schema.graphql'];
    var dataSources = {};
    var resolvers = {};
    var pipelineFunctions = {};
    (0, lodash_1.forEach)(flattenMaps(config.dataSources), function (ds, name) {
        dataSources[name] = __assign(__assign({}, ds), { name: name });
    });
    (0, lodash_1.forEach)(flattenMaps(config.resolvers), function (resolver, typeAndField) {
        var _a = typeAndField.split('.'), type = _a[0], field = _a[1];
        if (type == null || field == null) {
            throw new Error("Invalid resolver key. Must be the format([Type].[Field]): ".concat(typeAndField));
        }
        if (typeof resolver === 'string') {
            resolvers[typeAndField] = {
                dataSource: resolver,
                kind: 'UNIT',
                type: type,
                field: field,
            };
            return;
        }
        if (isUnitResolver(resolver) && typeof resolver.dataSource === 'object') {
            var name_1 = typeAndField.replace(/[^a-z_]/i, '_');
            dataSources[name_1] = __assign(__assign({}, resolver.dataSource), { name: name_1 });
        }
        resolvers[typeAndField] = __assign(__assign(__assign({}, resolver), { type: resolver.type || type, field: resolver.field || field }), (isUnitResolver(resolver)
            ? {
                kind: 'UNIT',
                dataSource: typeof resolver.dataSource === 'object'
                    ? typeAndField.replace(/[^a-z_]/i, '_')
                    : resolver.dataSource,
            }
            : {
                kind: 'PIPELINE',
                functions: resolver.functions.map(function (f, index) {
                    if (typeof f === 'string') {
                        return f;
                    }
                    var name = "".concat(toResourceName(typeAndField), "_").concat(index);
                    pipelineFunctions[name] = __assign(__assign({}, f), { name: name, dataSource: typeof f.dataSource === 'string' ? f.dataSource : name });
                    if (typeof f.dataSource === 'object') {
                        dataSources[name] = __assign(__assign({}, f.dataSource), { name: name });
                    }
                    return name;
                }),
            }));
    });
    (0, lodash_1.forEach)(flattenMaps(config.pipelineFunctions), function (func, name) {
        if (typeof func.dataSource === 'object') {
            dataSources[name] = __assign(__assign({}, func.dataSource), { name: name });
        }
        pipelineFunctions[name] = __assign(__assign({}, func), { dataSource: typeof func.dataSource === 'string' ? func.dataSource : name, name: name });
    });
    var additionalAuthentications = config.additionalAuthentications || [];
    var apiKeys;
    if (config.authentication.type === 'API_KEY' ||
        additionalAuthentications.some(function (auth) { return auth.type === 'API_KEY'; })) {
        var inputKeys = config.apiKeys || [];
        apiKeys = inputKeys.reduce(function (acc, key) {
            if (typeof key === 'string') {
                acc[key] = { name: key };
            }
            else {
                acc[key.name] = key;
            }
            return acc;
        }, {});
    }
    return __assign(__assign({}, config), { additionalAuthentications: additionalAuthentications, apiKeys: apiKeys, schema: schema, dataSources: dataSources, resolvers: resolvers, pipelineFunctions: pipelineFunctions });
};
exports.getAppSyncConfig = getAppSyncConfig;
//# sourceMappingURL=getAppSyncConfig.js.map