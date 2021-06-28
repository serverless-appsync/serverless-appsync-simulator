import Sequelize from 'sequelize';
import get from 'lodash/get'
import Promise from 'bluebird'

export default class RelationalDataLoader {
  constructor(config) {
    this.config = config;
  }

  async load(req) {
    try {
      const requiredKeys = [
        'dbDialect',
        'dbUsername',
        'dbPassword',
        'dbHost',
        'dbName',
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
      const config = {
        uri: `${this.config.rds.dbDialect}://${this.config.rds.dbUsername}:${this.config.rds.dbPassword}@${this.config.rds.dbHost}:${this.config.rds.dbPort}/${this.config.rds.dbName}`,
        options: {
          logging: console.log,
          dialectOptions: {
            decimalNumbers: true,
            multipleStatements: true,
          },
          define: {
            underScored: true,
            timestamps: true,
          },
        },
      };

      const sequelize = new Sequelize(config.uri, config.options);
      const result = await Promise.mapSeries(
        req.statements,
        (statement) => {
          return sequelize.query(statement);
        },
      );
      
      const rows = get(result, `[${req.statements.length - 1}][1].rows`, null)
      const length = rows?.length;
      if (length === 1) {
        return rows[0];
      }
      return rows;
    } catch (e) {
      console.log(e);
      return e;
    }
  }
}
