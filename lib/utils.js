"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFileMap = exports.globFilePaths = void 0;
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var globby_1 = __importDefault(require("globby"));
var constants_1 = require("./constants");
function toAbsolutePosixPath(basePath, filePath) {
    return (path_1.default.isAbsolute(filePath) ? filePath : path_1.default.join(basePath, filePath)).replace(/\\/g, '/');
}
function globFilePaths(basePath, filePaths) {
    return filePaths
        .map(function (filePath) {
        var paths = globby_1.default.sync(toAbsolutePosixPath(basePath, filePath));
        if (path_1.default.isAbsolute(filePath)) {
            return paths;
        }
        else {
            // For backward compatibility with FileMap, revert to relative path
            return paths.map(function (p) { return path_1.default.relative(basePath, p); });
        }
    })
        .flat();
}
exports.globFilePaths = globFilePaths;
function getFileMap(basePath, filePath) {
    return {
        path: filePath,
        content: fs_1.default.readFileSync(toAbsolutePosixPath(basePath, filePath), {
            encoding: constants_1.DEFAULT_ENCODING,
        }),
    };
}
exports.getFileMap = getFileMap;
//# sourceMappingURL=utils.js.map