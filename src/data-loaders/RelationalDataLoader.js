"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _bluebird = _interopRequireDefault(require("bluebird"));

var _pg = require("pg");

var _promise = _interopRequireDefault(require("mysql2/promise"));

var _mysql = require("mysql2");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const FLAGS = {
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
  NUM: 32768
};

const decToBin = dec => parseInt((dec >>> 0).toString(2), 2);

const convertMySQLResponseToColumnMetaData = rows => {
  return rows.map(row => {
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
      typeName: Object.keys(_mysql.Types).find(key => _mysql.Types[key] === row.columnType).toUpperCase(),
      isSigned: decToBin(row.flags & FLAGS.UNSIGNED) !== FLAGS.UNSIGNED,
      autoIncrement: decToBin(row.flags & FLAGS.AUTO_INCREMENT) === FLAGS.AUTO_INCREMENT,
      tableName: row._buf.slice(row._tableStart, row._tableStart + row._tableLength).toString()
    };
  });
};

const convertSQLResponseToRDSRecords = rows => {
  const records = [];
  rows.forEach(dbObject => {
    const record = [];
    Object.keys(dbObject).forEach(key => {
      record.push(dbObject[key] === null ? {
        isNull: true,
        null: true
      } : typeof dbObject[key] === 'string' ? {
        stringValue: dbObject[key]
      } : typeof dbObject[key] === 'number' ? {
        longValue: dbObject[key]
      } : {
        stringValue: dbObject[key]
      });
    });
    records.push(record);
  });
  return records;
};

const convertPostgresSQLResponseToColumnMetaData = rows => {
  return rows.map(row => {
    const typeName = Object.keys(_pg.types.builtins).find(d => _pg.types.builtins[d] === row.dataTypeID);
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

    // @TODO: Does not support Custom types. ie.: CREATE TYPE status AS ENUM ('ACTIVE', 'INACTIVE');
    // Defaults to "UNKNOWN"
    return {
      label: row.name,
      name: row.name,
      type: row.dataTypeID,
      typeName: typeName ? typeName.toUpperCase() : "UNKOWN"
    };
  });
};

const injectVariables = (statement, variableMap) => {
  const result = Object.keys(variableMap).reduce((statmnt, key) => {
    if(variableMap[key] === null || variableMap[key] === false || variableMap[key] === true) {
      return statmnt.replace(key, `${variableMap[key]}`)  
    }
    return statmnt.replace(key, `'${variableMap[key]}'`)
  }, statement)
  return result
}

const executeSqlStatements = async (client, req) => _bluebird.default.mapSeries(req.statements, async (statement) => {
  if (req && req.variableMap) {
    statement = injectVariables(statement, req.variableMap);
  } 
  try {
    const result = await client.query(statement);
    return result;
  } catch (error) {
    const {message, code} = error
    return {
      statement,
      errors: [{
        message,
        code,
      }],
      rows: [],
      affectedRows: 0,
      length: 0,
    }
  }
});

class RelationalDataLoader {
  constructor(config) {
    this.config = config;
  }

  async load(req) {
    try {
      const requiredKeys = ['dbDialect', 'dbUsername', 'dbPassword', 'dbHost', 'dbName', 'dbPort'];

      if (!this.config.rds) {
        throw new Error('RDS configuration not passed');
      }

      const missingKey = requiredKeys.find(key => {
        return !this.config.rds[key];
      });

      if (missingKey) {
        throw new Error(`${missingKey} is required.`);
      }

      const dbConfig = {
        host: this.config.rds.dbHost,
        user: this.config.rds.dbUsername,
        password: this.config.rds.dbPassword,
        database: this.config.rds.dbName,
        port: this.config.rds.dbPort
      };
      const res = {};

      if (this.config.rds.dbDialect === 'mysql') {
        const client = await _promise.default.createConnection(dbConfig);
        const results = await executeSqlStatements(client, req);
        res.sqlStatementResults = results.map(result => {
          if (result.length < 2) {
            return {};
          }

          if (!result[1]) {
            // not a select query
            return {
              numberOfRecordsUpdated: result[0].affectedRows,
              generatedFields: []
            };
          }

          return {
            numberOfRecordsUpdated: result[0] ? result[0].length : 0,
            records: convertSQLResponseToRDSRecords(result[0] ? result.rows : []),
            columnMetadata: convertMySQLResponseToColumnMetaData(result[1]),
            errors: result.erros || []
          };
        });
      } else if (this.config.rds.dbDialect === 'postgres') {
        const client = new _pg.Client(dbConfig);
        await client.connect();
        const results = await executeSqlStatements(client, req);
        res.sqlStatementResults = results.map(result => {
          return {
            numberOfRecordsUpdated: result.rowCount || 0,
            records: convertSQLResponseToRDSRecords(result.rows || []),
            columnMetadata: convertPostgresSQLResponseToColumnMetaData(result.fields || []),
            generatedFields: [],
            errors: result.erros || []
          };
        });
      }

      if (this.config.rds.objectResults) {
        return res;
      }
      return JSON.stringify(res);
    } catch (e) {
      return e;
    }
  }

}

exports.default = RelationalDataLoader;