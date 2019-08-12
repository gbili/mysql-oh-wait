"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _ActionResult = _interopRequireDefault(require("./ActionResult"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class MysqlInstantiatableReq {
  constructor(config) {
    const {
      adapter,
      logger,
      connectionConfig
    } = config || {};
    this.mysqlConnection = null;
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
    this.getLogger().debug(this.getThreadId(), 'this.createConnection(), Connection created', this.mysqlConnection);
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
      this.getLogger().debug(this.getThreadId(), 'this.removeConnection(), Connection removed', this.mysqlConnection);
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
    let error = null;
    await this.awaitLockStatePromises();

    if (!(await this.isConnected())) {
      if (!this.hasConnection()) {
        this.getLogger().debug(this.getThreadId(), 'this:connect(), No connection');
        this.createConnection();
      }

      this.getLogger().debug(this.getThreadId(), 'this:connect(), Connecting...');

      try {
        this.getLogger().debug(this.getThreadId(), 'this:connect(), locking');
        await this.lock(new Promise((resolve, reject) => {
          this.getConnection().connect(err => err && reject(err) || resolve(true));
        }));
        this.getLogger().debug(this.getThreadId(), `this:connect(), Connected to database, threadId: ${this.getThreadId()}`);
      } catch (err) {
        this.getLogger().debug(this.getThreadId(), 'this:connect(), trouble connecting threw: ', err);
        error = err;
      }
    }

    return new _ActionResult.default({
      value: this.getThreadId(),
      error,
      info: this.getConnectionInfo()
    });
  }

  async disconnect() {
    let error = null;
    let didDisconnect = false;
    await this.awaitLockStatePromises();

    if (await this.isConnected()) {
      this.getLogger().debug(this.getThreadId(), 'this:disconnect(), isConnected: true', this.getThreadId());

      try {
        this.getLogger().debug(this.getThreadId(), 'this:disconnect(), locking');
        await this.lock(new Promise((resolve, reject) => {
          this.getConnection().end(err => err && reject(err) || resolve(true));
        }));
        this.mysqlConnection = null;
      } catch (err) {
        this.getLogger().debug(this.getThreadId(), 'this:disconnect(), difficulties disconnecting', err);
        error = err;
      }

      didDisconnect = true;
    }

    if (!error && (await this.isConnected())) {
      error = new Error('Weird error, still connected after disconnect attempt');
    }

    return new _ActionResult.default({
      value: didDisconnect,
      error,
      info: this.getConnectionInfo()
    });
  }

  async query({
    sql,
    values,
    after
  }) {
    await this.awaitLockStatePromises();

    if (!(await this.isConnected())) {
      this.getLogger().debug(this.getThreadId(), 'this.query() You did not connect manually, attempting automatic connection');
      const connectResult = await this.connect();

      if (connectResult.error !== null) {
        this.getLogger().debug(this.getThreadId(), 'this.query() Automatic connection attempt failed, cannot continue with query');
        throw connectResult.error;
      }
    }

    let result = null;
    let error = null;

    try {
      const connection = this.getConnection();
      result = await this.lock(new Promise((resolve, reject) => {
        const cb = (err, result) => err ? reject(err) : resolve(result);

        values ? connection.query(sql, values, cb) : connection.query(sql, cb);
      }));
    } catch (err) {
      this.getLogger().debug(this.getThreadId(), 'this.query() failed', {
        sqlMessage: err.sqlMessage,
        sql: err.sql,
        sqlState: err.sqlState
      }, err);
      error = err;
    }

    if (typeof after === 'function') {
      result = after(result);
    }

    return new _ActionResult.default({
      value: result,
      error,
      info: this.getConnectionInfo()
    });
  }

  getConnectionInfo() {
    return {
      threadId: this.getThreadId(),
      connection: this.hasConnection() && this.getConnection() || null,
      config: this.getConnectionConfig()
    };
  }

  async awaitLockStatePromises() {
    if (this.isLocked()) {
      try {
        await this.lockedStatePromise;
        this.getLogger().debug(this.getThreadId(), 'this:awaitLockStatePromises(), finished waiting this.lockedStatePromise');
        await this.unlock();
      } catch (err) {
        this.getLogger().debug(this.getThreadId(), 'this:awaitLockStatePromises(), error', err);
      }
    } else {
      this.getLogger().debug(this.getThreadId(), 'this:awaitLockStatePromises(), not locked');
    }
  }

  async lock(promise) {
    await this.awaitLockStatePromises();

    if (this.isLocked()) {
      throw new Error('this:lock() weird state, should not be locked');
    }

    this.lockedStatePromise = promise;
    this.getLogger().debug(this.getThreadId(), 'this:lock(), this.lockedStatePromise:', this.lockedStatePromise);
    return this.lockedStatePromise;
  }

  async unlock() {
    if (!this.isLocked()) {
      throw new Error('this:unlock() weird state, should be locked');
    }

    this.lockedStatePromise = null;
    this.getLogger().debug(this.getThreadId(), 'this:unlock(), this.lockedStatePromise:', this.lockedStatePromise);
  }

  isLocked() {
    return this.lockedStatePromise !== null;
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

exports.default = MysqlInstantiatableReq;