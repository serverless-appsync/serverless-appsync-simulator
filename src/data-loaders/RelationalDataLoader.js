import Sequelize from 'sequelize';

export default class ElasticDataLoader {
  constructor(config) {
    this.config = config;
  }

  async load(req) {
    try {
      console.log(req);
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
          host: process.env.DB_HOST,
          logging: console.log,
          dialect: process.env.DB_DIALECT,
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
      console.log(JSON.stringify(config));
      const sequelize = new Sequelize(config.uri, config.options);
      let result;
      result = await Promise.all(
        req.statements.map((statement) => {
          return sequelize.query(statement);
        }),
      ).catch((err) => (result = err));
      console.log(JSON.stringify(result));
      if (Array.isArray(result) && result.length > 1) {
        const length = result[0][1];
        if (length === 1) {
          return result[1][1].rows[0];
        }
        return result[1][1].rows;
      }
      return result;
    } catch (e) {
      console.log(e);
    }

    return null;
  }
}
