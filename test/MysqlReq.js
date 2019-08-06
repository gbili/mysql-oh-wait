import { expect } from 'chai';
import MysqlReq from '../src/MysqlReq';
import logger from 'saylo';

let setup = async function () {
  await MysqlReq.removeConnection();
}

describe(`MysqlReq`, function() {
  describe(`MysqlReq.setConnectionConfig()`, function() {
    it('should be able to load connection config from env variables and return it', async function() {
      expect(MysqlReq.setConnectionConfig({ multipleStatements: false })).to.deep.equal({ 
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: false,
      });
      await setup();
    });
  });

  describe(`MysqlReq.getConnectionConfig()`, function() {
    it('should return connection config created with setConnectionConfig()', async function() {
      const config = MysqlReq.setConnectionConfig({ multipleStatements: false })
      expect(MysqlReq.getConnectionConfig()).to.deep.equal(config);
      await setup();
    });
  });

  describe(`MysqlReq.removeConnection()`, async function() {
    it('should make MysqlReq.hasConnection() return false', async function() {
      await MysqlReq.removeConnection();
      expect(MysqlReq.hasConnection()).to.be.equal(false);
      await setup();
    });

    it('should make MysqlReq.hasConnection() return false even if connection was set priorly', async function() {
      await MysqlReq.connect();
      await MysqlReq.removeConnection();
      expect(MysqlReq.hasConnection()).to.be.equal(false);
      await setup();
    });

    it('should return false if there was no connection', async function() {
      await MysqlReq.removeConnection();
      expect(await MysqlReq.removeConnection()).to.be.equal(false);
      await setup();
    });

    it('should return true if there was a connection', async function() {
      await MysqlReq.removeConnection();
      await MysqlReq.createConnection();
      expect(await MysqlReq.removeConnection()).to.be.equal(true);
      await setup();
    });
  });

  describe(`MysqlReq.hasConnection()`, async function() {
    it('should return true if createConnection() is called before', async function() {
      await MysqlReq.hasConnection() && await MysqlReq.removeConnection();
      await MysqlReq.createConnection();
      expect(MysqlReq.hasConnection()).to.be.equal(true);
      await setup();
    });

    it('should return false if removeConnection() is called before', async function() {
      await MysqlReq.removeConnection();
      expect(MysqlReq.hasConnection()).to.be.equal(false);
      await setup();
    });
  });

  describe(`MysqlReq.connect()`, async function() {
    it('should connect to the db without params through .env connection settings', async function() {
      await setup();
      expect(await MysqlReq.connect()).to.be.a('number');
      await setup();
    });

    it('should not reconnect if connectionConfig has not changed', async function() {
      await setup();
      expect(await MysqlReq.connect()).to.be.a('number');
      const lastCallThreadId = MysqlReq.getThreadId();
      expect(await MysqlReq.connect()).to.be.equal(lastCallThreadId);
      await setup();
    });

    it('should reconnect if connectionConfig is changed', async function() {
      await setup();
      expect(await MysqlReq.connect()).to.be.a('number');
      const lastCallThreadId = MysqlReq.getThreadId();
      MysqlReq.setConnectionConfig({multipleStatements: true});
      expect(await MysqlReq.connect()).to.be.equal(lastCallThreadId);
      await setup();
    });
  });

  describe(`MysqlReq.query()`, async function() {
    it('return an array on select even if not connected priorly', async function() {
      await MysqlReq.removeConnection();
      expect(MysqlReq.hasConnection()).to.be.equal(false);
      expect(await MysqlReq.query({sql: 'SHOW TABLES'})).to.be.an('array');
      await setup();
    });

    it('return an array on select should be altered by "after" param', async function() {
      await MysqlReq.removeConnection();
      expect(MysqlReq.hasConnection()).to.be.equal(false);
      expect(await MysqlReq.query({sql: 'SHOW TABLES', after: res => 'altered'})).to.be.equal('altered');
      await setup();
    });
  });
});
