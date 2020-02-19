import { expect } from 'chai';
import mysql from 'mysql';
import { logger } from 'saylo';
import MysqlReq from '../../src/MysqlReq';
import ActionResult from '../../src/ActionResult';

describe(`MysqlReq`, function() {

  logger.turnOn('debug');
  logger.turnOff('debug');

  describe(`MysqlReq.constructor({adapter, logger, connectionConfig})`, function() {
    it('should be able to get an ActionResult', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq({
        adapter: mysql,
        connectionConfig: config
      });
      const actionResult = await req.connect();
      expect(actionResult).to.be.an.instanceof(ActionResult);
      await req.removeConnection();
    });

    it('should be able to connect with adapter and connectionConfig params', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq({
        adapter: mysql,
        connectionConfig: config
      });
      const actionResult = await req.connect();
      expect(actionResult.value).to.be.a('number');
      await req.removeConnection();
    });

    it('should make ActionResult have an error property on wrong connection credentials confg', async function() {
      const config = {
        multipleStatements: false,
        database: 'wrongone',
        host: 'wrongone',
        user: 'wrongone',
        password: 'wrongone',
      };
      const req = new MysqlReq({
        adapter: mysql,
        connectionConfig: config
      });
      const actionResult = await req.connect();
      expect(actionResult.error).to.not.be.equal(null);
      await req.removeConnection();
    });

    it('should throw an error property on missing host connection confg construction', async function() {
      const { user, password } = MysqlReq.extractConfigFromEnv(process.env);
      const config = {
        multipleStatements: false,
        user,
        password
      };
      const shouldThrow = function() {
        new MysqlReq({
          adapter: mysql,
          connectionConfig: config
        });
      };
      expect(shouldThrow).to.throw();
    });

    it('should be able to set connectionConfig from constructor param', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq({
        adapter: mysql,
        logger: logger,
        connectionConfig: config
      });
      expect(req.getConnectionConfig()).to.be.deep.equal(config);
      await req.removeConnection();
    });

    it('should be able to set adapter from constructor param', async function() {
      const req = new MysqlReq({
        adapter: mysql,
      });
      expect(req.getAdapter()).to.be.equal(mysql);
      await req.removeConnection();
    });

    it('should be able to set logger from constructor param', async function() {
      const req = new MysqlReq({
        logger,
      });
      expect(req.getLogger()).to.be.equal(logger);
      await req.removeConnection();
    });

    it('should be able to connect without params if setAdapter() and setConnectionConfig() are called before', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq();
      req.setAdapter(mysql);
      req.setConnectionConfig(config);
      const actionResult = await req.connect()
      expect(actionResult.value).to.be.a('number');
      await req.removeConnection();
    });

    it('should not be connected on instantiation', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq();
      req.setAdapter(mysql);
      req.setConnectionConfig(config);
      expect(await req.isConnected()).to.be.equal(false);
      await req.removeConnection();
    });
  });

  describe(`MysqlReq.extractConfigFromEnv()`, function() {
    it('should be able to load connection config from env variables and return it', async function() {
      expect(MysqlReq.extractConfigFromEnv(process.env)).to.be.an('object');
    });
  });

  describe(`MysqlReq.setConnectionConfig()`, function() {
    it('should be able to set connection config and return it', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq();
      expect(req.setConnectionConfig(config)).to.deep.equal(config);
      await req.removeConnection();
    });
  });

  describe(`MysqlReq.getConnectionConfig()`, function() {
    it('should return connection config created with setConnectionConfig()', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq();
      req.setConnectionConfig(config);
      expect(req.getConnectionConfig()).to.deep.equal(config);
      await req.removeConnection();
    });
  });

  describe(`MysqlReq.removeConnection()`, async function() {
    it('should make MysqlReq.hasConnection() return false', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq({
        adapter: mysql,
        logger: logger,
        connectionConfig: config
      });
      await req.removeConnection();
      expect(req.hasConnection()).to.be.equal(false);
    });

    it('should make MysqlReq.hasConnection() return false even if connection was set priorly', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq({
        adapter: mysql,
        logger: logger,
        connectionConfig: config
      });
      const actionResult = await req.connect();
      expect(actionResult.value).to.be.a('number');
      await req.removeConnection();
      expect(req.hasConnection()).to.be.equal(false);
      await req.removeConnection();
    });

    it('should return false if there was no connection', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq({
        adapter: mysql,
        logger: logger,
        connectionConfig: config
      });
      await req.removeConnection();
      expect(await req.removeConnection()).to.be.equal(false);
      await req.removeConnection();
    });

    it('should return true if there was a connection', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq({
        adapter: mysql,
        logger: logger,
        connectionConfig: config
      });
      await req.removeConnection();
      await req.createConnection();
      expect(await req.removeConnection()).to.be.equal(true);
      await req.removeConnection();
    });
  });

  describe(`req.hasConnection()`, async function() {
    it('should return true if createConnection() is called before', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq({
        adapter: mysql,
        logger: logger,
        connectionConfig: config
      });
      await req.hasConnection() && await req.removeConnection();
      await req.createConnection();
      expect(req.hasConnection()).to.be.equal(true);
      await req.removeConnection();
    });

    it('should return false if removeConnection() is called before', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq({
        adapter: mysql,
        logger: logger,
        connectionConfig: config
      });
      await req.removeConnection();
      expect(req.hasConnection()).to.be.equal(false);
      await req.removeConnection();
    });
  });

  describe(`req.connect()`, async function() {
    it('should not reconnect if connectionConfig has not changed', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq({
        adapter: mysql,
        logger: logger,
        connectionConfig: config
      });
      await req.removeConnection();
      const actionResult = await req.connect();
      expect(actionResult.value).to.be.a('number');
      const actionResult2 = await req.connect();
      expect(actionResult2.value).to.be.a('number');
      expect(actionResult.value).to.be.equal(actionResult2.value);
      await req.removeConnection();
    });

    it('should not allow reseting connectionConfig if hasConnection', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const config2 = {
        multipleStatements: true,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq({
        adapter: mysql,
        logger: logger,
        connectionConfig: config
      });
      const actionResult = await req.connect();
      expect(actionResult.value).to.be.a('number');
      expect(() => req.setConnectionConfig(config2)).to.throw();
      await req.removeConnection();
    });
  });

  describe(`req.query()`, async function() {
    it('should return an array on select even if not connected priorly', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq({
        adapter: mysql,
        logger: logger,
        connectionConfig: config
      });
      await req.removeConnection();
      expect(req.hasConnection()).to.be.equal(false);

      const actionResult = await req.query({sql: 'SHOW TABLES'});
      expect(actionResult.value).to.be.a('array');
      expect(actionResult.error).to.be.equal(null);
      expect(actionResult?.info?.threadId).to.be.a('number');

      await req.removeConnection();
    });

    it('should have an error in ActionResult but not throw, on BAD SQL query error', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq({
        adapter: mysql,
        logger: logger,
        connectionConfig: config
      });

      const actionResult = await req.query({sql: 'BAD SQL'});
      expect(actionResult.value).to.be.equal(null);
      expect(actionResult.error).to.not.be.equal(null);
      expect(actionResult?.info?.threadId).to.be.a('number');

      await req.removeConnection();
    });

    it('return an array on select should be altered by "after" param', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlReq({
        adapter: mysql,
        logger: logger,
        connectionConfig: config
      });
      await req.removeConnection();
      expect(req.hasConnection()).to.be.equal(false);
      const actionResult = await req.query({sql: 'SHOW TABLES', after: res => 'altered'});
      expect(actionResult.value).to.be.equal('altered');
      await req.removeConnection();
    });
  });
});
