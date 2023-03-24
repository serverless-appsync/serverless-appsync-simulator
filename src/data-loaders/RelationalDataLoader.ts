/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Types } from 'mysql2';
import mysql, { FieldPacket } from 'mysql2/promise';
import {
  Client,
  FieldDef,
  QueryArrayResult,
  QueryResult,
  types as pgTypes,
} from 'pg';

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

const decToBin = (dec: number) => parseInt((dec >>> 0).toString(2), 2);

const convertMySQLResponseToColumnMetaData = (rows: FieldPacket[]) => {
  return rows.map((row: any) => {
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
      typeName: (() => {
        for (const [key, value] of Object.entries(Types)) {
          if (value === row.columnType) {
            return key.toUpperCase();
          }
        }
        return 'UNKNOWN';
      })(),
      isSigned: decToBin(row.flags & FLAGS.UNSIGNED) !== FLAGS.UNSIGNED,
      autoIncrement:
        decToBin(row.flags & FLAGS.AUTO_INCREMENT) === FLAGS.AUTO_INCREMENT,
      tableName: row._buf
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        .slice(row._tableStart, row._tableStart + row._tableLength)
        .toString(),
    };
  });
};
const convertSQLResponseToRDSRecords = (rows: any[]) => {
  const records: any[][] = [];

  rows.forEach((dbObject) => {
    const record: any[] = [];
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

const convertPostgresSQLResponseToColumnMetaData = (rows: FieldDef[]) => {
  return rows.map((row) => {
    const typeName = (() => {
      for (const [key, value] of Object.entries(pgTypes.builtins)) {
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
      typeName,
    };
  });
};

const injectVariables = (
  statement: string,
  req: { variableMap?: Record<string, any> },
): string => {
  const { variableMap } = req;
  if (!variableMap) {
    return statement;
  }
  const result = Object.keys(variableMap).reduce((statmnt, key) => {
    // Adds 'g' for replaceAll effect
    const re = new RegExp(key, 'g');
    if (variableMap[key] === null || typeof variableMap[key] == 'boolean') {
      return statmnt.replace(re, `${variableMap[key]}`);
    }
    // @TODO: Differentiate number from string inputs...
    return statmnt.replace(re, `'${variableMap[key]}'`);
  }, statement);
  return result;
};

const executeSqlStatements = async (client: DbClient | null, req: any) => {
  if (!client) {
    throw new Error('RDS client not initialized');
  }
  for (const statement of req.statements) {
    const sql = injectVariables(statement, req);
    try {
      // @ts-ignore
      const result = await client.query(sql);
      return result;
    } catch (error) {
      console.log(`RDS_DATALOADER: Failed to execute: `, statement, error);
      throw error;
    }
  }
};

type DbClient = mysql.Connection | Client;

export default class RelationalDataLoader {
  private config: any;
  private client: DbClient | null;

  constructor(config: any) {
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
    if (this.config.rds.dbDialect === 'mysql') {
      this.client = await mysql.createConnection(dbConfig);
    } else if (this.config.rds.dbDialect === 'postgres') {
      this.client = new Client(dbConfig);
      await this.client.connect();
    }
    return this.client;
  }

  async load(req: any): Promise<object | null> {
    try {
      const client = await this.getClient();
      const res: any = {};
      const results = await executeSqlStatements(client, req);
      if (this.config.rds?.dbDialect === 'mysql') {
        res.sqlStatementResults = results.map((result: any) => {
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
        res.sqlStatementResults = results.map(
          (result: QueryResult | QueryArrayResult) => {
            return {
              numberOfRecordsUpdated: result.rowCount,
              records: convertSQLResponseToRDSRecords(result.rows),
              columnMetadata: convertPostgresSQLResponseToColumnMetaData(
                result.fields,
              ),
              generatedFields: [],
            };
          },
        );
      }
      return res;
    } catch (e) {
      console.log(e);
      return e as object;
    }
  }
}
