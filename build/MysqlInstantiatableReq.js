"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

class MysqlInstantiatableReq {
  constructor(config) {
    const {
      adapter,
      logger,
      connectionConfig
    } = config || {};
    this.mysqlConnection = null;
    this.locked = false;
    this.lockedStatePromise = null;
    this.setLogger(logger || {
      log: () => {},
      debug: () => {}
    });
    this.setAdapter(adapter || null);
    connectionConfig && this.setConnectionConfig(connectionConfig);
  }

  setAdapter(mysqlAdapter) {
    this.adapter = mysqlAdapter;
  }

  getAdapter() {
    if (null === this.adapter) {
      throw new Error('You must set the adapter first');
    }

    return this.adapter;
  }

  setLogger(logger) {
    this.logger = logger;
  }

  getLogger() {
    if (null === this.logger) {
      throw new Error('You must set the logger first');
    }

    return this.logger;
  }

  setConnectionConfig(config) {
    if (this.hasConnection()) {
      throw new Error('Cannot change connection config while there is a connection, call an awating removeConnection() first.');
    }

    if (MysqlInstantiatableReq.isMissingConfigProps(config)) {
      throw new Error('Missing database connection config props');
    }

    this.connectionConfig = config;
    return this.connectionConfig;
  }

  getConnectionConfig() {
    return this.connectionConfig;
  }

  createConnection() {
    if (null !== this.mysqlConnection) {
      throw new Error('Cannot create another connection');
    }

    const config = this.getConnectionConfig();

    if (MysqlInstantiatableReq.isMissingConfigProps(config)) {
      throw new Error('Must set full connection config before attempting to connect');
    }

    this.mysqlConnection = this.getAdapter().createConnection(config);
    this.getLogger().debug('this.createConnection(), Connection created');
  }

  hasConnection() {
    return this.mysqlConnection !== null;
  }

  getConnection() {
    if (!this.hasConnection()) {
      throw new Error('You must create a connection first');
    }

    return this.mysqlConnection;
  }

  async removeConnection() {
    let didRemove = false;

    if (this.hasConnection()) {
      await this.disconnect();
      this.mysqlConnection = null;
      this.getLogger().debug('this.removeConnection(), Connection removed', this.mysqlConnection);
      didRemove = true;
    }

    return didRemove;
  }

  getThreadId() {
    return this.hasConnection() && this.getConnection().threadId || null;
  }

  async isConnected() {
    await this.awaitLockStatePromises();
    return this.hasConnection() && Number.isInteger(this.getThreadId());
  }

  async connect() {
    await this.awaitLockStatePromises();

    if (await this.isConnected()) {
      this.getLogger().debug('this:connect(), Already connected');
      return this.getThreadId();
    }

    if (!this.hasConnection()) {
      this.getLogger().debug('this:connect(), No connection');
      this.createConnection();
    }

    this.getLogger().debug('this:connect(), Connecting...');

    try {
      this.getLogger().debug('this:connect(), locking');
      await this.lock(new Promise((resolve, reject) => {
        this.getConnection().connect(err => err && reject(err) || resolve(true));
      }));
      await this.awaitLockStatePromises();
      this.getLogger().debug(`this:connect(), Connected to database, threadId: ${this.getThreadId()}`);
    } catch (err) {
      this.getLogger().debug('this:connect(), trouble connecting threw: ', err);
    }

    return this.getThreadId();
  }

  async disconnect() {
    this.getLogger().debug('this:disconnect(), beginawait');
    await this.awaitLockStatePromises();
    this.getLogger().debug('this:disconnect(), endawait');

    if (!(await this.isConnected())) {
      this.getLogger().debug('this:disconnect(), isConnected: false');
      return;
    }

    this.getLogger().debug('this:disconnect(), isConnected: true', this.getThreadId());

    try {
      this.getLogger().debug('this:disconnect(), locking');
      await this.lock(new Promise((resolve, reject) => {
        this.getConnection().end(err => err && reject(err) || resolve(true));
      }));
      await this.awaitLockStatePromises();
      this.mysqlConnection = null;
    } catch (err) {
      this.getLogger().debug('this:disconnect(), difficulties disconnecting', err);
    }

    let isConn = await this.isConnected();
    this.getLogger().debug('this:disconnect() end isConnected:', isConn, ' threadId', this.getThreadId());
  }

  async query({
    sql,
    values,
    after
  }) {
    let res = null;
    await this.awaitLockStatePromises();
    let isConn = await this.isConnected();

    if (!isConn) {
      this.getLogger().debug('this.query() You did not connect manually, attempting automatic connection');
      await this.connect();
    }

    try {
      const connection = this.getConnection();
      res = await new Promise((resolve, reject) => {
        const cb = (err, result) => err ? reject(err) : resolve(result);

        if (values) connection.query(sql, values, cb);else connection.query(sql, cb);
      });
    } catch (err) {
      this.getLogger().debug('this.query() failed', {
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

  async awaitLockStatePromises() {
    if (this.isLocked()) {
      try {
        await this.lockedStatePromise;
        this.getLogger().debug('this:awaitLockStatePromises(), finished waiting this.lockedStatePromise');
        this.unlock();
      } catch (err) {
        this.getLogger().debug('this:awaitLockStatePromises(), error', err);
      }
    } else {
      this.getLogger().debug('this:awaitLockStatePromises(), not locked');
    }
  }

  async lock(promise) {
    await this.awaitLockStatePromises();
    this.lockedStatePromise = promise;
    this.locked = true;
    this.getLogger().debug('this:lock(), this.locked:', this.locked);
  }

  unlock() {
    this.lockedStatePromise = null;
    this.locked = false;
    this.getLogger().debug('this:unlock(), this.locked:', this.locked);
  }

  isLocked() {
    this.getLogger().debug('this:isLocked(), this.locked:', this.locked);
    return this.locked;
  }

  static getDefaultEnvVarNames() {
    return {
      host: 'DB_HOST',
      user: 'DB_USER',
      password: 'DB_PASSWORD',
      database: 'DB_NAME'
    };
  }

  static extractConfigFromEnv(env, envVarNames) {
    envVarNames = envVarNames || MysqlInstantiatableReq.getDefaultEnvVarNames();
    return {
      host: env[envVarNames.host] || null,
      user: env[envVarNames.user] || null,
      password: env[envVarNames.password] || null,
      database: env[envVarNames.database] || null
    };
  }

  static isMissingConfigProps(config) {
    const requiredProps = ['host', 'user', 'password', 'database'];
    const missingProps = requiredProps.filter(prop => !config.hasOwnProperty(prop));
    return missingProps.length > 0;
  }

}

var _default = MysqlInstantiatableReq;
exports.default = _default;