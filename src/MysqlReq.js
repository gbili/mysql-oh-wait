import mysql from 'mysql';
import logger from 'saylo';

let mysqlConnection = null;
let connectionConfig = null;
let locked = false;
let lockedStatePromise = null;

class MysqlReq {

  static setConnectionConfig({ host, user, password, database, envVarNames, ...rest }) {
    MysqlReq.disconnect();

    if (!envVarNames) {
      envVarNames = {
        host: 'DB_HOST',
        user: 'DB_USER',
        password: 'DB_PASSWORD',
        database: 'DB_NAME',
      };
    }

    connectionConfig = {
      host: host || (envVarNames && process.env[envVarNames.host] ) || null,
      user: user || (envVarNames && process.env[envVarNames.user] ) || null,
      password: password || (envVarNames && process.env[envVarNames.password] ) || null,
      database: database || (envVarNames && process.env[envVarNames.database] ) || null,
      ...rest
    };

    return connectionConfig;
  }

  static getConnectionConfig() {
    return connectionConfig || MysqlReq.setConnectionConfig({});
  }

  static createConnection() {
    if (null !== mysqlConnection) {
      throw new Error('Cannot create another connection');
    }
    mysqlConnection = mysql.createConnection(MysqlReq.getConnectionConfig());
    logger.log('MysqlReq.createConnection(), Connection created');
  }

  static hasConnection() {
    return mysqlConnection !== null;
  }

  static getConnection() {
    if (!MysqlReq.hasConnection()) {
      throw new Error('You must create a connection first');
    }
    return mysqlConnection;
  }

  static async removeConnection() {
    let didRemove = false;
    if (MysqlReq.hasConnection()) {
      await MysqlReq.disconnect();
      logger.log('MysqlReq.removeConnection(), Connection removed', mysqlConnection);
      mysqlConnection = null;
      didRemove = true;
    }
    return didRemove;
  }

  static getThreadId() {
    return (MysqlReq.hasConnection() && MysqlReq.getConnection().threadId) || null;
  }

  static async isConnected() {
    await MysqlReq.awaitLockStatePromises();
    return MysqlReq.hasConnection() && Number.isInteger(MysqlReq.getThreadId());
  }

  static async connect() {
    await MysqlReq.awaitLockStatePromises();
    if (await MysqlReq.isConnected()) {
      logger.log('MysqlReq:connect(), Already connected');
      return MysqlReq.getThreadId();
    }
    if (!MysqlReq.hasConnection()) {
      logger.log('MysqlReq:connect(), No connection');
      MysqlReq.createConnection();
    }
    logger.log('MysqlReq:connect(), Connecting...');
    try {
      logger.log('MysqlReq:connect(), locking');
      MysqlReq.lock(new Promise((resolve, reject) => {
        MysqlReq.getConnection().connect(err => ((err && reject(err)) || resolve(true)));
      }));
      await MysqlReq.awaitLockStatePromises();
      logger.log(`MysqlReq:connect(), Connected to database, threadId: ${ MysqlReq.getThreadId() }`);
    } catch (err) {
      logger.log('MysqlReq:connect(), trouble connecting threw: ', err);
    }
    return MysqlReq.getThreadId();
  }

  static async disconnect() {
    await MysqlReq.awaitLockStatePromises();
    if (!await MysqlReq.isConnected()) {
      logger.log('MysqlReq:disconnect(), isConnected: false');
      return;
    }
    logger.log('MysqlReq:disconnect(), isConnected: true', MysqlReq.getThreadId());
    try {
      logger.log('MysqlReq:disconnect(), locking');
      MysqlReq.lock(new Promise((resolve, reject) => {
        MysqlReq.getConnection().end(err => ((err && reject(err)) || resolve(true)));
      }));
      await MysqlReq.awaitLockStatePromises();
      mysqlConnection = null;
    } catch (err) {
      logger.log('MysqlReq:disconnect(), difficulties disconnecting', err);
    }
    let isConn = await MysqlReq.isConnected();
    logger.log('MysqlReq:disconnect() end isConnected:', isConn, ' threadId', MysqlReq.getThreadId())
  }

  static async query({ sql, values, after }) {
    let res = null;
    await MysqlReq.awaitLockStatePromises();
    let isConn = await MysqlReq.isConnected();
    if (!isConn) {
      logger.log('MysqlReq.query() You did not connect manually, attempting automatic connection');
      await MysqlReq.connect();
    }
    try {
      res = await (new Promise((resolve, reject) => {
        const cb = (err, result) => (err ? reject(err) : resolve(result));
        if (values) MysqlReq.getConnection().query(sql, values, cb);
        else MysqlReq.getConnection().query(sql, cb);
      }));
    } catch (err) {
      logger.log('MysqlReq.query() failed', {sqlMessage: err.sqlMessage, sql: err.sql, sqlState: err.sqlState}, err);
    }

    if (typeof after === 'function') {
      res = after(res);
    }

    return res;
  }

  static async awaitLockStatePromises() {
    if (MysqlReq.isLocked()) {
      try {
        await lockedStatePromise;
        logger.log('MysqlReq:awaitLockStatePromises(), finished waiting lockedStatePromise');
        MysqlReq.unlock();
      } catch (err) {
        logger.log('MysqlReq:awaitLockStatePromises(), error', err);
      }
    }
  }

  static lock(promise) {
    lockedStatePromise = promise;
    locked = true;
    logger.log('MysqlReq:lock(), locked:', locked);
  }

  static unlock() {
    lockedStatePromise = null;
    locked = false;
    logger.log('MysqlReq:unlock(), locked:', locked);
  }
  static isLocked() {
    logger.log('MysqlReq:isLocked(), locked:', locked);
    return locked;
  }

}

export default MysqlReq;
