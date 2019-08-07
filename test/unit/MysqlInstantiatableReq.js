import { expect } from 'chai';
import mysql from 'mysql';
import logger from 'saylo';
import MysqlInstantiatableReq from '../../src/MysqlInstantiatableReq';

describe(`MysqlInstantiatableReq`, function() {
  describe(`MysqlInstantiatableReq.constructor({adapter, logger, connectionConfig})`, function() {
    it('should be able to connect with adapter and connectionConfig params', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq({
        adapter: mysql,
        connectionConfig: config
      });
      expect(await req.connect()).to.be.a('number');
      await req.removeConnection();
    });

    it('should be able to set connectionConfig from constructor param', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq({
        adapter: mysql,
        logger,
        connectionConfig: config
      });
      expect(req.getConnectionConfig()).to.be.deep.equal(config);
      await req.removeConnection();
    });

    it('should be able to set adapter from constructor param', async function() {
      const req = new MysqlInstantiatableReq({
        adapter: mysql,
      });
      expect(req.getAdapter()).to.be.equal(mysql);
      await req.removeConnection();
    });

    it('should be able to set logger from constructor param', async function() {
      const req = new MysqlInstantiatableReq({
        logger,
      });
      expect(req.getLogger()).to.be.equal(logger);
      await req.removeConnection();
    });

    it('should be able to connect without params if setAdapter() and setConnectionConfig() are called before', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq();
      req.setAdapter(mysql);
      req.setConnectionConfig(config);
      expect(await req.connect()).to.be.a('number');
      await req.removeConnection();
    });

    it('should not be connected on instantiation', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq();
      req.setAdapter(mysql);
      req.setConnectionConfig(config);
      expect(await req.isConnected()).to.be.equal(false);
      await req.removeConnection();
    });
  });

  describe(`MysqlInstantiatableReq.extractConfigFromEnv()`, function() {
    it('should be able to load connection config from env variables and return it', async function() {
      expect(MysqlInstantiatableReq.extractConfigFromEnv(process.env)).to.be.an('object');
    });
  });

  describe(`MysqlInstantiatableReq.setConnectionConfig()`, function() {
    it('should be able to set connection config and return it', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq();
      expect(req.setConnectionConfig(config)).to.deep.equal(config);
      await req.removeConnection();
    });
  });

  describe(`MysqlInstantiatableReq.getConnectionConfig()`, function() {
    it('should return connection config created with setConnectionConfig()', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq();
      req.setConnectionConfig(config);
      expect(req.getConnectionConfig()).to.deep.equal(config);
      await req.removeConnection();
    });
  });

  describe(`MysqlInstantiatableReq.removeConnection()`, async function() {
    it('should make MysqlInstantiatableReq.hasConnection() return false', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq({
        adapter: mysql,
        logger,
        connectionConfig: config
      });
      await req.removeConnection();
      expect(req.hasConnection()).to.be.equal(false);
    });

    it('should make MysqlInstantiatableReq.hasConnection() return false even if connection was set priorly', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq({
        adapter: mysql,
        logger,
        connectionConfig: config
      });
      await req.connect();
      await req.removeConnection();
      expect(req.hasConnection()).to.be.equal(false);
      await req.removeConnection();
    });

    it('should return false if there was no connection', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq({
        adapter: mysql,
        logger,
        connectionConfig: config
      });
      await req.removeConnection();
      expect(await req.removeConnection()).to.be.equal(false);
      await req.removeConnection();
    });

    it('should return true if there was a connection', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq({
        adapter: mysql,
        logger,
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
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq({
        adapter: mysql,
        logger,
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
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq({
        adapter: mysql,
        logger,
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
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq({
        adapter: mysql,
        logger,
        connectionConfig: config
      });
      await req.removeConnection();
      expect(await req.connect()).to.be.a('number');
      const lastCallThreadId = req.getThreadId();
      expect(await req.connect()).to.be.equal(lastCallThreadId);
      await req.removeConnection();
    });

    it('should not allow reseting connectionConfig if hasConnection', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const config2 = {
        multipleStatements: true,
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq({
        adapter: mysql,
        logger,
        connectionConfig: config
      });
      expect(await req.connect()).to.be.a('number');
      expect(() => req.setConnectionConfig(config2)).to.throw();
      await req.removeConnection();
    });
  });

  describe(`req.query()`, async function() {
    it('return an array on select even if not connected priorly', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq({
        adapter: mysql,
        logger,
        connectionConfig: config
      });
      await req.removeConnection();
      expect(req.hasConnection()).to.be.equal(false);
      expect(await req.query({sql: 'SHOW TABLES'})).to.be.an('array');
      await req.removeConnection();
    });

    it('return an array on select should be altered by "after" param', async function() {
      const config = {
        multipleStatements: false,
        ...MysqlInstantiatableReq.extractConfigFromEnv(process.env),
      };
      const req = new MysqlInstantiatableReq({
        adapter: mysql,
        logger,
        connectionConfig: config
      });
      await req.removeConnection();
      expect(req.hasConnection()).to.be.equal(false);
      expect(await req.query({sql: 'SHOW TABLES', after: res => 'altered'})).to.be.equal('altered');
      await req.removeConnection();
    });
  });
});
