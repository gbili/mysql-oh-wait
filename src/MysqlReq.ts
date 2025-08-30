import { createPool, Pool, PoolConnection, PoolOptions } from 'mysql2/promise';
import QueryFormat from './QueryFormat';
import { ActionResult, ConnectionInfo, SimpleQueryResult } from './ActionResult';
import { type Logger, silentLogger } from 'saylo';

export type MysqlReqConfig = {
  connectionConfig: PoolOptions;
  logger?: Logger;
  queryFormatter?: QueryFormat;
};

export class MysqlReq {
  private pool: Pool;
  private logger: Logger;

  constructor(private config: MysqlReqConfig) {
    this.logger = config.logger ?? silentLogger;
    this.logger.debug('🔄 Initializing MySQL connection pool...');

    const queryFormatter = config.queryFormatter || new QueryFormat({ escape: (v: any) => JSON.stringify(v) } as any);

    const poolConfig = {
      ...config.connectionConfig,
      queryFormat: queryFormatter.queryFormat.bind(queryFormatter),
    };

    try {
      this.pool = createPool(poolConfig);
      this.logger.debug('✅ MySQL connection pool created successfully.');
    } catch (err) {
      this.logger.error('❌ Failed to create MySQL pool:', err);
      throw err;
    }
  }

  async getConnection(): Promise<PoolConnection> {
    this.logger.debug('🔄 Attempting to get a database connection...');
    try {
      const connection = await this.pool.getConnection();
      this.logger.debug(`✅ Connection established. Thread ID: ${connection.threadId}`);
      return connection;
    } catch (err) {
      this.logger.error('❌ Failed to get database connection:', err);
      throw err;
    }
  }

  async query<T extends SimpleQueryResult, Z = T>({
    sql,
    values,
    after,
  }: {
    sql: string;
    values?: any;
    after?: (res: T) => Z;
  }): Promise<ActionResult<Z | T>> {
    let connection: PoolConnection | null = null;
    try {
      this.logger.debug(`🟡 Executing query: ${sql}, values:`, values);
      if (values) this.logger.debug('📊 With values:', values);

      connection = await this.getConnection();

      const queryRet = await (values
        ? connection.query(sql, values)
        : connection.query(sql)
      );
      this.logger.debug('✅ Query executed successfully. Raw result:', queryRet);

      const [result, fieldPacket] = queryRet;
      const finalResult = after ? after(result as T) : (result as T);

      this.logger.debug('📄 Final query result:', finalResult);
      return {
        value: finalResult,
        fieldPacket,
        info: this.getConnectionInfo(connection),
      };
    } catch (err) {
      this.logger.error('❌ Query failed:', err);
      return {
        error: err as Error,
        info: { threadId: null, connection: null, config: this.config.connectionConfig },
      };
    } finally {
      if (connection) {
        this.logger.debug(`🔄 Releasing connection. Thread ID: ${connection.threadId}`);
        connection.release();
      }
    }
  }

  getConnectionInfo(connection: PoolConnection): ConnectionInfo {
    return {
      threadId: connection.threadId,
      connection,
      config: this.config.connectionConfig,
    };
  }

  // Inside MysqlReq class
  async closePool(): Promise<void> {
    this.logger.debug('🔄 Closing MySQL connection pool...');
    try {
        await this.pool.end();
        this.logger.debug('✅ MySQL connection pool closed.');
    } catch (err) {
        this.logger.error('❌ Failed to close MySQL pool:', err);
    }
  }

}

// Export instance type for ESM/CJS compatibility
export type MysqlReqInstance = MysqlReq;

export default MysqlReq;
