"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
let _logger = null;
let _adapter = null;
let _mysqlConnection = null;
let _connectionConfig = null;
let _locked = false;
let _lockedStatePromise = null;

class MysqlReq {
  static inject({
    adapter,
    logger,
    connectionConfig
  }) {
    _logger = logger || null;
    adapter && MysqlReq.setAdapter(adapter);
    connectionConfig && MysqlReq.setConnectionConfig(connectionConfig);
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
      host: host || envVarNames && process.env[envVarNames.host] || null,
      user: user || envVarNames && process.env[envVarNames.user] || null,
      password: password || envVarNames && process.env[envVarNames.password] || null,
      database: database || envVarNames && process.env[envVarNames.database] || null,
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

    _logger.log('MysqlReq.createConnection(), Connection created');
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

      _logger.log('MysqlReq.removeConnection(), Connection removed', _mysqlConnection);

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
      _logger.log('MysqlReq:connect(), Already connected');

      return MysqlReq.getThreadId();
    }

    if (!MysqlReq.hasConnection()) {
      _logger.log('MysqlReq:connect(), No connection');

      MysqlReq.createConnection();
    }

    _logger.log('MysqlReq:connect(), Connecting...');

    try {
      _logger.log('MysqlReq:connect(), locking');

      MysqlReq.lock(new Promise((resolve, reject) => {
        MysqlReq.getConnection().connect(err => err && reject(err) || resolve(true));
      }));
      await MysqlReq.awaitLockStatePromises();

      _logger.log(`MysqlReq:connect(), Connected to database, threadId: ${MysqlReq.getThreadId()}`);
    } catch (err) {
      _logger.log('MysqlReq:connect(), trouble connecting threw: ', err);
    }

    return MysqlReq.getThreadId();
  }

  static async disconnect() {
    await MysqlReq.awaitLockStatePromises();

    if (!(await MysqlReq.isConnected())) {
      _logger.log('MysqlReq:disconnect(), isConnected: false');

      return;
    }

    _logger.log('MysqlReq:disconnect(), isConnected: true', MysqlReq.getThreadId());

    try {
      _logger.log('MysqlReq:disconnect(), locking');

      MysqlReq.lock(new Promise((resolve, reject) => {
        MysqlReq.getConnection().end(err => err && reject(err) || resolve(true));
      }));
      await MysqlReq.awaitLockStatePromises();
      _mysqlConnection = null;
    } catch (err) {
      _logger.log('MysqlReq:disconnect(), difficulties disconnecting', err);
    }

    let isConn = await MysqlReq.isConnected();

    _logger.log('MysqlReq:disconnect() end isConnected:', isConn, ' threadId', MysqlReq.getThreadId());
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
      _logger.log('MysqlReq.query() You did not connect manually, attempting automatic connection');

      await MysqlReq.connect();
    }

    try {
      res = await new Promise((resolve, reject) => {
        const cb = (err, result) => err ? reject(err) : resolve(result);

        if (values) MysqlReq.getConnection().query(sql, values, cb);else MysqlReq.getConnection().query(sql, cb);
      });
    } catch (err) {
      _logger.log('MysqlReq.query() failed', {
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

        _logger.log('MysqlReq:awaitLockStatePromises(), finished waiting _lockedStatePromise');

        MysqlReq.unlock();
      } catch (err) {
        _logger.log('MysqlReq:awaitLockStatePromises(), error', err);
      }
    }
  }

  static lock(promise) {
    _lockedStatePromise = promise;
    _locked = true;

    _logger.log('MysqlReq:lock(), _locked:', _locked);
  }

  static unlock() {
    _lockedStatePromise = null;
    _locked = false;

    _logger.log('MysqlReq:unlock(), _locked:', _locked);
  }

  static isLocked() {
    _logger.log('MysqlReq:isLocked(), _locked:', _locked);

    return _locked;
  }

}

var _default = MysqlReq;
exports.default = _default;