/**
 * SQLDataLoader supports AppSync RDS DataSources, using Knex to support multiple DBs
 */
const Knex = require('knex');
const { isEmpty } = require('lodash');

export default class SQLDataLoader {
  /**
   * Constructs SQLDataLoader based on configuration
   * ie.:
   * RELATIONAL_DATABASE:
   *   RDS_MyTable: # appSync.dataSources[type === RELATIONAL_DATABASE].name
   *     client: pg
   *     version: 7.2
   *     host: localhost
   *     port: 5432
   *     user: my_user
   *     password: my_password
   *     database: my_db
   * @param { client, host, port, user, password, database, version } config 
   */
  constructor(config) {
    this.config = config;
  }

  async load(req) {
    const { client, host, port, user, password, database, version } = this.config;
    const { statements, variableMap } = req;

    // If empty, do not fail, just respond with and empty array
    if (isEmpty(statements)) {
      return {
        statements,
        results: []
      }
    }

    try {
      const knex = Knex({
        client,
        version,
        connection: {
          host,
          port,
          user,
          password,
          database,
        },
        acquireConnectionTimeout: 2000
      });

      // Construct queries
      const queries = this.buildQuery(statements, variableMap)

      // Executes
      const results = queries.map(async (query) => {
        return await knex.raw(query);
      });
      
      return {
        statements,
        variableMap,
        results,
      };
    } catch (err) {
      return {
        statements,
        results: [],
        errors: [
          err,
        ]
      }
    }
  }

  /**
   * Builds Query based on VTL statements
   * @param { Array } statements 
   * @param { Object } variableMap 
   * @returns 
   */
  buildQuery(statements, variableMap) {
    return statements.map(statement => {
      if (isEmpty(variableMap)) {
        return statement;
      }

      let updatedStatement = statement;
      Object.keys(variableMap).forEach(key => updatedStatement = updatedStatement.replace(key, variableMap[key]));
      return updatedStatement;
    });
  }
}
