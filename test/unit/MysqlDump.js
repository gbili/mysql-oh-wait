import { expect } from 'chai';
import MysqlDump from '../../src/MysqlDump';

describe(`MysqlDump`, function() {
  describe(`MysqlDump.executeSqlFile({filePath})`, function() {
    it('should execute sql in file with multiple statements on env connection settings and disconnect', async function() {
      const filePath = `${__dirname}/schema.sql`;
      await MysqlDump.executeSqlFile({filePath});
      expect(await MysqlDump.getRequestor().isConnected()).to.be.equal(false);
    });

    it('should execute sql in file with multiple statements with connection settings and disconnect', async function() {
      const filePath = `${__dirname}/schema.sql`;
      const connectionConfig = {
        envVarNames : {
          host: 'TEST_DB_HOST',
          user: 'TEST_DB_USER',
          password: 'TEST_DB_PASSWORD',
          database: 'TEST_DB_DATABASE',
        },
      };
      await MysqlDump.executeSqlFile({filePath, connectionConfig});
      expect(await MysqlDump.getRequestor().isConnected()).to.be.equal(false);
    });

    it('should execute sql in file with multiple statements with connection settings and not disconnect', async function() {
      const filePath = `${__dirname}/schema.sql`;
      const connectionConfig = {
        envVarNames : {
          host: 'TEST_DB_HOST',
          user: 'TEST_DB_USER',
          password: 'TEST_DB_PASSWORD',
          database: 'TEST_DB_DATABASE',
        },
      };
      await MysqlDump.executeSqlFile({filePath, connectionConfig, disconnectOnFinish: false});
      expect(await MysqlDump.getRequestor().isConnected()).to.be.equal(true);
      await MysqlDump.getRequestor().removeConnection();
    });
  });

  describe(`MysqlDump.inject({adapter})`, async function() {
    it('should change requestor if passed as param', function() {
      let req = MysqlDump.getRequestor();
      let other = 'fake';
      MysqlDump.inject({ requestor: other });
      expect(MysqlDump.getRequestor()).to.be.equal(other);
      MysqlDump.inject({ requestor: req });
      expect(MysqlDump.getRequestor()).to.be.equal(req);
    });

    it('should change the logger if passed as param', async function() {
      let logger = MysqlDump.getLogger();
      let otherLogger = () => {};
      MysqlDump.inject({ logger: otherLogger });
      expect(MysqlDump.getLogger()).to.be.equal(otherLogger);
      MysqlDump.inject({ logger });
      expect(MysqlDump.getLogger()).to.be.equal(logger);
    });

    it('should accept readFileSync if passed as param', async function() {
      const readFileSync = require('fs').readFileSync;
      const notThrow = () => MysqlDump.inject({ readFileSync });
      expect(notThrow).to.not.throw();
    });

    it('should accept existsSync if passed as param', async function() {
      const existsSync = require('fs').existsSync;
      const notThrow = () => MysqlDump.inject({ existsSync });
      expect(notThrow).to.not.throw();
    });
  });
});
