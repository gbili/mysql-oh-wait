"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
let _logger = {
  log: () => {}
};
let _env = {};
let _adapter = null;
let _mysqlConnection = null;
let _connectionConfig = null;
let _locked = false;
let _lockedStatePromise = null;

class MysqlReq {
  static inject({
    adapter,
    logger,
    env,
    connectionConfig
  }) {
    logger && MysqlReq.setLogger(logger);
    adapter && MysqlReq.setAdapter(adapter);
    env && MysqlReq.setEnv(env);
    connectionConfig && MysqlReq.setConnectionConfig(connectionConfig);
  }

  static setEnv(env) {
    _env = env;
  }

  static getEnv() {
    if (null === _env) {
      throw new Error('You must set the adapter first');
    }

    return _env;
  }

  static setAdapter(mysqlAdapter) {
    _adapter = mysqlAdapter;
  }

  static getAdapter() {
    if (null === _adapter) {
      throw new Error('You must set the adapter first');
    }

    return _adapter;
  }

  static setLogger(logger) {
    _logger = logger;
  }

  static getLogger() {
    if (null === _logger) {
      throw new Error('You must set the logger first');
    }

    return _logger;
  }

  static setConnectionConfig({
    host,
    user,
    password,
    database,
    envVarNames,
    ...rest
  }) {
    MysqlReq.disconnect();

    if (!envVarNames) {
      envVarNames = {
        host: 'DB_HOST',
        user: 'DB_USER',
        password: 'DB_PASSWORD',
        database: 'DB_NAME'
      };
    }

    _connectionConfig = {
      host: host || envVarNames && _env[envVarNames.host] || null,
      user: user || envVarNames && _env[envVarNames.user] || null,
      password: password || envVarNames && _env[envVarNames.password] || null,
      database: database || envVarNames && _env[envVarNames.database] || null,
      ...rest
    };
    return _connectionConfig;
  }

  static getConnectionConfig() {
    return _connectionConfig || MysqlReq.setConnectionConfig({});
  }

  static createConnection() {
    if (null !== _mysqlConnection) {
      throw new Error('Cannot create another connection');
    }

    _mysqlConnection = MysqlReq.getAdapter().createConnection(MysqlReq.getConnectionConfig());
    MysqlReq.getLogger().log('MysqlReq.createConnection(), Connection created');
  }

  static hasConnection() {
    return _mysqlConnection !== null;
  }

  static getConnection() {
    if (!MysqlReq.hasConnection()) {
      throw new Error('You must create a connection first');
    }

    return _mysqlConnection;
  }

  static async removeConnection() {
    let didRemove = false;

    if (MysqlReq.hasConnection()) {
      await MysqlReq.disconnect();
      MysqlReq.getLogger().log('MysqlReq.removeConnection(), Connection removed', _mysqlConnection);
      _mysqlConnection = null;
      didRemove = true;
    }

    return didRemove;
  }

  static getThreadId() {
    return MysqlReq.hasConnection() && MysqlReq.getConnection().threadId || null;
  }

  static async isConnected() {
    await MysqlReq.awaitLockStatePromises();
    return MysqlReq.hasConnection() && Number.isInteger(MysqlReq.getThreadId());
  }

  static async connect() {
    await MysqlReq.awaitLockStatePromises();

    if (await MysqlReq.isConnected()) {
      MysqlReq.getLogger().log('MysqlReq:connect(), Already connected');
      return MysqlReq.getThreadId();
    }

    if (!MysqlReq.hasConnection()) {
      MysqlReq.getLogger().log('MysqlReq:connect(), No connection');
      MysqlReq.createConnection();
    }

    MysqlReq.getLogger().log('MysqlReq:connect(), Connecting...');

    try {
      MysqlReq.getLogger().log('MysqlReq:connect(), locking');
      MysqlReq.lock(new Promise((resolve, reject) => {
        MysqlReq.getConnection().connect(err => err && reject(err) || resolve(true));
      }));
      await MysqlReq.awaitLockStatePromises();
      MysqlReq.getLogger().log(`MysqlReq:connect(), Connected to database, threadId: ${MysqlReq.getThreadId()}`);
    } catch (err) {
      MysqlReq.getLogger().log('MysqlReq:connect(), trouble connecting threw: ', err);
    }

    return MysqlReq.getThreadId();
  }

  static async disconnect() {
    await MysqlReq.awaitLockStatePromises();

    if (!(await MysqlReq.isConnected())) {
      MysqlReq.getLogger().log('MysqlReq:disconnect(), isConnected: false');
      return;
    }

    MysqlReq.getLogger().log('MysqlReq:disconnect(), isConnected: true', MysqlReq.getThreadId());

    try {
      MysqlReq.getLogger().log('MysqlReq:disconnect(), locking');
      MysqlReq.lock(new Promise((resolve, reject) => {
        MysqlReq.getConnection().end(err => err && reject(err) || resolve(true));
      }));
      await MysqlReq.awaitLockStatePromises();
      _mysqlConnection = null;
    } catch (err) {
      MysqlReq.getLogger().log('MysqlReq:disconnect(), difficulties disconnecting', err);
    }

    let isConn = await MysqlReq.isConnected();
    MysqlReq.getLogger().log('MysqlReq:disconnect() end isConnected:', isConn, ' threadId', MysqlReq.getThreadId());
  }

  static async query({
    sql,
    values,
    after
  }) {
    let res = null;
    await MysqlReq.awaitLockStatePromises();
    let isConn = await MysqlReq.isConnected();

    if (!isConn) {
      MysqlReq.getLogger().log('MysqlReq.query() You did not connect manually, attempting automatic connection');
      await MysqlReq.connect();
    }

    try {
      res = await new Promise((resolve, reject) => {
        const cb = (err, result) => err ? reject(err) : resolve(result);

        if (values) MysqlReq.getConnection().query(sql, values, cb);else MysqlReq.getConnection().query(sql, cb);
      });
    } catch (err) {
      MysqlReq.getLogger().log('MysqlReq.query() failed', {
        sqlMessage: err.sqlMessage,
        sql: err.sql,
        sqlState: err.sqlState
      }, err);
    }

    if (typeof after === 'function') {
      res = after(res);
    }

    return res;
  }

  static async awaitLockStatePromises() {
    if (MysqlReq.isLocked()) {
      try {
        await _lockedStatePromise;
        MysqlReq.getLogger().log('MysqlReq:awaitLockStatePromises(), finished waiting _lockedStatePromise');
        MysqlReq.unlock();
      } catch (err) {
        MysqlReq.getLogger().log('MysqlReq:awaitLockStatePromises(), error', err);
      }
    }
  }

  static lock(promise) {
    _lockedStatePromise = promise;
    _locked = true;
    MysqlReq.getLogger().log('MysqlReq:lock(), _locked:', _locked);
  }

  static unlock() {
    _lockedStatePromise = null;
    _locked = false;
    MysqlReq.getLogger().log('MysqlReq:unlock(), _locked:', _locked);
  }

  static isLocked() {
    MysqlReq.getLogger().log('MysqlReq:isLocked(), _locked:', _locked);
    return _locked;
  }

}

var _default = MysqlReq;
exports.default = _default;