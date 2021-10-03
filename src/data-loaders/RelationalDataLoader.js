import Promise from 'bluebird';
import { Client, types as pgTypes } from 'pg';
import mysql from 'mysql2/promise';
import { Types } from 'mysql2';
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
  NUM: 32768,
};

const decToBin = (dec) => parseInt((dec >>> 0).toString(2), 2);

const convertMySQLResponseToColumnMetaData = (rows) => {
  return rows.map((row) => {
    // @TODO: Add for the following fields
    // arrayBaseColumnType,
    // isCaseSensitive,
    // isCurrency,
    // currency,
    // precision,
    // scale,
    // schemaName,
    return {
      isAutoIncrement:
        decToBin(row.flags & FLAGS.AUTO_INCREMENT) === FLAGS.AUTO_INCREMENT,
      label: row.name,
      name: row.name,
      nullable: decToBin(row.flags && FLAGS.NOT_NULL) !== FLAGS.NOT_NULL,
      type: row.columnType,
      typeName: Object.keys(Types)
        .find((key) => Types[key] === row.columnType)
        .toUpperCase(),
      isSigned: decToBin(row.flags & FLAGS.UNSIGNED) !== FLAGS.UNSIGNED,
      autoIncrement:
        decToBin(row.flags & FLAGS.AUTO_INCREMENT) === FLAGS.AUTO_INCREMENT,
      tableName: row._buf
        .slice(row._tableStart, row._tableStart + row._tableLength)
        .toString(),
    };
  });
};
const convertSQLResponseToRDSRecords = (rows) => {
  const records = [];

  rows.forEach((dbObject) => {
    const record = [];
    Object.keys(dbObject).forEach((key) => {
      record.push(
        dbObject[key] === null
          ? { isNull: true, null: true }
          : typeof dbObject[key] === 'string'
          ? { stringValue: dbObject[key] }
          : typeof dbObject[key] === 'number'
          ? { longValue: dbObject[key] }
          : { stringValue: dbObject[key] },
      );
    });
    records.push(record);
  });
  return records;
};

const convertPostgresSQLResponseToColumnMetaData = (rows) => {
  return rows.map((row) => {
    const typeName =
      Object.keys(pgTypes.builtins).find(
        (d) => pgTypes.builtins[d] === row.dataTypeID,
      ) ?? 'UNKNOWN';
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
      typeName,
    };
  });
};

const injectVariables = (statement, req) => {
  const { variableMap } = req;
  if (!variableMap) {
    return statement;
  }
  const result = Object.keys(variableMap).reduce((statmnt, key) => {
    // Adds 'g' for replaceAll effect
    var re = new RegExp(key, 'g');
    if (variableMap[key] === null || typeof variableMap[key] == 'boolean') {
      return statmnt.replace(re, `${variableMap[key]}`);
    }
    // @TODO: Differentiate number from string inputs...
    return statmnt.replace(re, `'${variableMap[key]}'`);
  }, statement);
  return result;
};

const executeSqlStatements = async (client, req) =>
  Promise.mapSeries(req.statements, async (statement) => {
    statement = injectVariables(statement, req);
    try {
      const result = await client.query(statement);
      return result;
    } catch (error) {
      console.log(`RDS_DATALOADER: Failed to execute: `, statement, error);
      throw error;
    }
  });

export default class RelationalDataLoader {
  constructor(config) {
    this.config = config;
    this.client = null;
  }

  async getClient() {
    if (this.client) {
      return this.client;
    }

    const requiredKeys = [
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
    const missingKey = requiredKeys.find((key) => {
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
      port: this.config.rds.dbPort,
    };
    const res = {};
    if (this.config.rds.dbDialect === 'mysql') {
      this.client = await mysql.createConnection(dbConfig);
    } else if (this.config.rds.dbDialect === 'postgres') {
      this.client = new Client(dbConfig);
      await this.client.connect();
    }
    return this.client;
  }

  async load(req) {
    try {
      const client = await this.getClient();
      const res = {};
      const results = await executeSqlStatements(client, req);
      if (this.config.rds.dbDialect === 'mysql') {
        res.sqlStatementResults = results.map((result) => {
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
      } else if (this.config.rds.dbDialect === 'postgres') {
        res.sqlStatementResults = results.map((result) => {
          return {
            numberOfRecordsUpdated: result.rowCount,
            records: convertSQLResponseToRDSRecords(result.rows),
            columnMetadata: convertPostgresSQLResponseToColumnMetaData(
              result.fields,
            ),
            generatedFields: [],
          };
        });
      }
      return JSON.stringify(res);
    } catch (e) {
      console.log(e);
      return e;
    }
  }
}
