import ActionResult from './ActionResult';
import { ConnectionConfig, Connection, MysqlError, QueryOptions, queryCallback } from 'mysql';
import QueryFormat, { Values } from './QueryFormat';

export interface ReqQueryOptions extends QueryOptions {
  after?: (p: any) => any;
}

export type ExecutorParam = <S extends (value?: any) => any, T extends (reason?: any) => any>(resolve: S, reject: T) => void

export type RequiredConfigProps = {
  host: string;
  user: string;
  password: string;
  database: string;
}

export type UserProvidedEnvVarNames = RequiredConfigProps;

export type ConfigPropsOptional = {
  host?: string;
  user?: string;
  password?: string;
  database?: string;
}

export type RequestorEnvVarNames = {
  host: 'DB_HOST';
  user: 'DB_USER';
  password: 'DB_PASSWORD';
  database: 'DB_NAME';
}

export type ConnectionConfigOptions = {
  host: string | null;
  user: string | null;
  password: string | null;
  database: string | null;
};

export type ConnectionInfo = {
  threadId: number | null;
  connection: Connection | null;
  config: ConnectionConfig;
}

export declare type LoggerInterface = {
  debug: (...params: any[]) => void;
  log: (...params: any[]) => void;
}

export declare interface MysqlReqConstructor {
  new (config: ConnectionConfigOptions): MysqlReq; 
  getDefaultEnvVarNames: () => RequestorEnvVarNames
  extractConfigFromEnv: (env: Object, envVarNames: RequestorEnvVarNames) => ConnectionConfigOptions; 
  isMissingConfigProps: (config: ConnectionConfigOptions) => boolean;
}

export declare interface AdapterInterface {
  createConnection: (config: ConnectionConfig) => Connection;
}

export type MysqlReqConfig = {
  adapter?: AdapterInterface,
  logger?: LoggerInterface,
  connectionConfig?: ConnectionConfig
};

export type MysqlReqInjectProps = {
  adapter?: AdapterInterface,
  logger?: LoggerInterface,
  env?: any 
  envVarNames?: UserProvidedEnvVarNames 
};

export default class MysqlReq {
  public logger: LoggerInterface;
  public adapter: AdapterInterface | null;
  public connectionConfig: ConnectionConfig;
  public mysqlConnection: Connection | null;
  public lockedStatePromise: Promise<any> | null;

  constructor(config?: MysqlReqConfig) {
    const { adapter, logger, connectionConfig } = config || {};
    this.mysqlConnection = null;
    this.lockedStatePromise = null;
    this.connectionConfig = {};
    this.adapter = null;
    this.logger = { log: () => undefined, debug: () => undefined, };

    logger && this.setLogger(logger);
    adapter && this.setAdapter(adapter);
    connectionConfig && this.setConnectionConfig(connectionConfig);
  }

  inject({ adapter, logger, env, envVarNames }: MysqlReqInjectProps) {
    adapter && this.setAdapter(adapter);
    logger && this.setLogger(logger);
    let config;
    if (envVarNames) {
      config = env && MysqlReq.extractConfigFromEnv(env, envVarNames);
    } else {
      config = env && MysqlReq.extractConfigFromEnv(env);
    }
    if (config) {
      this.setConnectionConfig(config);
    }
  }

  setAdapter(mysqlAdapter: AdapterInterface) {
    this.adapter = mysqlAdapter;
  }

  getAdapter() {
    if (null === this.adapter) {
      throw new Error('You must set the adapter first');
    }
    return this.adapter;
  }

  setLogger(logger: LoggerInterface): void {
    this.logger = logger;
  }

  getLogger() {
    if (null === this.logger) {
      throw new Error('You must set the logger first');
    }
    return this.logger;
  }

  setConnectionConfig(config: ConnectionConfig): ConnectionConfig | never  {
    if (this.hasConnection()) {
      throw new Error('Cannot change connection config while there is a connection, call an awating removeConnection() first.');
    }

    if (MysqlReq.isMissingConfigProps(config)) {
      console.log(config);
      throw new Error('Missing database connection config props');
    }

    this.connectionConfig = config;

    return this.connectionConfig;
  }

  getConnectionConfig(): ConnectionConfig {
    return this.connectionConfig;
  }

  createConnection(): void | never {
    if (null !== this.mysqlConnection) {
      throw new Error('Cannot create another connection');
    }
    const config = this.getConnectionConfig();
    if (MysqlReq.isMissingConfigProps(config)) {
      throw new Error('Must set full connection config before attempting to connect');
    }
    this.mysqlConnection = this.getAdapter().createConnection(config);
    this.attachQueryFormat();
    this.getLogger().debug(this.getThreadId(), 'this.createConnection(), Connection created', this.mysqlConnection);
  }

  attachQueryFormat(queryFormat?: { queryFormat: (query: string, values: Values) => string; }) {
    if (!this.hasConnection()) {
      throw new Error('Must createConnection first');
    }

    if (!this.mysqlConnection) {
      throw new Error('Connection must be provided for QueryFormat to be attached');
    }

    if (!queryFormat) {
      queryFormat = new QueryFormat(this.mysqlConnection);
    }

    this.mysqlConnection.config.queryFormat = function(query, values) {
      return (queryFormat as QueryFormat).queryFormat(query, values);
    };
  }

  hasConnection(): boolean {
    return this.mysqlConnection !== null;
  }

  getConnection(): Connection | never {
    if (this.mysqlConnection === null) {
      throw new Error('You must create a connection first');
    }
    return this.mysqlConnection;
  }

  async removeConnection(): Promise<boolean> {
    let didRemove = false;
    if (this.mysqlConnection) {
      await this.disconnect();
      this.mysqlConnection = null;
      this.getLogger().debug(this.getThreadId(), 'this.removeConnection(), Connection removed', this.mysqlConnection);
      didRemove = true;
    }
    return didRemove;
  }

  getThreadId(): number | null {
    return (this.hasConnection() && this.getConnection().threadId) || null;
  }

  async isConnected(): Promise<boolean> {
    await this.awaitLockStatePromises();
    return this.hasConnection() && Number.isInteger(this.getThreadId() as any);
  }

  async connect() {
    let error: MysqlError | null = null;
    await this.awaitLockStatePromises();

    if (!(await this.isConnected())) {
      if (!this.hasConnection()) {
        this.getLogger().debug(this.getThreadId(), 'this:connect(), No connection');
        this.createConnection();
      }

      this.getLogger().debug(this.getThreadId(), 'this:connect(), Connecting...');

      try {
        this.getLogger().debug(this.getThreadId(), 'this:connect(), locking');

        await this.lock((resolve, reject) => {
          this.getConnection().connect(err => ((err && reject(err)) || resolve(true)));
        });

        this.getLogger().debug(this.getThreadId(), `this:connect(), Connected to database, threadId: ${ this.getThreadId() }`);
      } catch (err) {
        this.getLogger().debug(this.getThreadId(), 'this:connect(), trouble connecting threw: ', err);
        error = err;
      }
    }

    return new ActionResult(
      this.getThreadId(),
      error,
      this.getConnectionInfo(),
    );
  }

  async disconnect() {

    let error = null;
    let didDisconnect = false;

    await this.awaitLockStatePromises();

    if (await this.isConnected()) {
      this.getLogger().debug(this.getThreadId(), 'this:disconnect(), isConnected: true', this.getThreadId());
      try {
        this.getLogger().debug(this.getThreadId(), 'this:disconnect(), locking');

        await this.lock((resolve, reject) => {
          this.getConnection().end(err => ((err && reject(err)) || resolve(true)));
        });

        this.mysqlConnection = null;
      } catch (err) {
        this.getLogger().debug(this.getThreadId(), 'this:disconnect(), difficulties disconnecting', err);
        error = err;
      }
      didDisconnect = true;
    }

    if (!error && await this.isConnected()) {
      error = new Error('Weird error, still connected after disconnect attempt');
    }

    return new ActionResult(
      didDisconnect,
      error,
      this.getConnectionInfo(),
    );
  }

  async query({ sql, values, after }: ReqQueryOptions) {

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
    let error: MysqlError | null = null;

    try {
      const connection = this.getConnection();

      result = await this.lock((resolve, reject) => {
        const cb: queryCallback = (err, result) => (err ? reject(err) : resolve(result));
        values ? connection.query(sql, values, cb) : connection.query(sql, cb);
      });

    } catch (err) {
      this.getLogger().debug(this.getThreadId(), 'this.query() failed', {sqlMessage: err.sqlMessage, sql: err.sql, sqlState: err.sqlState}, err);
      error = err;
    }

    if (null === error && typeof after === 'function') {
      result = after(result);
    }

    return new ActionResult(
      result,
      error,
      this.getConnectionInfo(),
    );
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      threadId: this.getThreadId(),
      connection: (this.hasConnection() && this.getConnection()) || null,
      config: this.getConnectionConfig(),
    };
  }

  async awaitLockStatePromises() {

    if (!this.isLocked()) {
      this.getLogger().debug(this.getThreadId(), 'this:awaitLockStatePromises(), not locked');
      return;
    }

    try {
      await this.lockedStatePromise;
      this.getLogger().debug(this.getThreadId(), 'this:awaitLockStatePromises(), finished waiting this.lockedStatePromise');
    } catch (err) {
      this.getLogger().debug(this.getThreadId(), 'this:awaitLockStatePromises(), error', err);
    }

    try {
      this.unlock();
      this.getLogger().debug(this.getThreadId(), 'this:awaitLockStatePromises(), unlocking');
    } catch (err) {
      this.getLogger().debug(this.getThreadId(), 'this:awaitLockStatePromises(), unlocking error', err);
    }

  }

  async lock(executor: ExecutorParam) {

    await this.awaitLockStatePromises();

    if (this.isLocked()) {
      throw new Error('this:lock() weird state, should not be locked')
    }

    this.lockedStatePromise = new Promise(executor);
    this.getLogger().debug(this.getThreadId(), 'this:lock(), this.lockedStatePromise:', this.lockedStatePromise);

    return this.lockedStatePromise;
  }

  unlock() {

    if (!this.isLocked()) {
      throw new Error('this:unlock() weird state, should be locked')
    }

    this.lockedStatePromise = null;
    this.getLogger().debug(this.getThreadId(), 'this:unlock(), this.lockedStatePromise:', this.lockedStatePromise);
  }

  isLocked() {
    return this.lockedStatePromise !== null;
  }

  static getDefaultEnvVarNames(): RequestorEnvVarNames {
    return {
      host: 'DB_HOST',
      user: 'DB_USER',
      password: 'DB_PASSWORD',
      database: 'DB_NAME',
    };
  }

  static extractConfigFromEnv(env: any, envVarNames?: UserProvidedEnvVarNames): ConfigPropsOptional {
    envVarNames = envVarNames || MysqlReq.getDefaultEnvVarNames();
    return {
      host: env[envVarNames.host] || null,
      user: env[envVarNames.user] || null,
      password: env[envVarNames.password] || null,
      database: env[envVarNames.database] || null,
    }
  }

  static isMissingConfigProps(config: ConfigPropsOptional): boolean {
    const requiredProps = ['host', 'user', 'password', 'database'];
    const missingProps = requiredProps.filter(prop => !config.hasOwnProperty(prop));
    return missingProps.length > 0;
  }

}