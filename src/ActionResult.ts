import { QueryError as MysqlError, Connection, QueryOptions, PoolConnection, RowDataPacket, PoolOptions, FieldPacket, ResultSetHeader } from "mysql2/promise";
import OhWaitError from "./OhWaitError";

export declare type SimpleRowDataPacket = Omit<RowDataPacket, 'constructor'>;
export declare type SimpleResultSetHeader = Omit<ResultSetHeader, 'constructor'>;
export declare type SimpleProcedureCallPacket<
  T = [SimpleRowDataPacket[], SimpleResultSetHeader] | SimpleResultSetHeader,
> = T extends SimpleRowDataPacket[]
  ? [T, SimpleResultSetHeader]
  : T extends SimpleResultSetHeader | OkPacket
    ? SimpleResultSetHeader
    : [SimpleRowDataPacket[], SimpleResultSetHeader] | SimpleResultSetHeader;

export type SimpleQueryResult =
  | SimpleResultSetHeader
  | SimpleResultSetHeader[]
  | SimpleRowDataPacket[]
  | SimpleRowDataPacket[][]
  | SimpleProcedureCallPacket;


export interface ReqQueryOptions<RawType extends RowDataPacket[], TransformedType = RawType> extends QueryOptions {
  after?: (p: RawType) => TransformedType;
}

export type ConnectionInfo = {
  threadId: number | null;
  connection: Connection | PoolConnection | null;
  config: PoolOptions;
}

export type ActionResultSuccess<T> = {
  value: T;
  fieldPacket: FieldPacket[];
  error?: MysqlError | OhWaitError;
  info: ConnectionInfo;
}

export type ActionResultError<T> = {
  value?: T;
  error: MysqlError | OhWaitError;
  info: ConnectionInfo;
}

export type OkPacket = {
  fieldCount: number;
  affectedRows: number;
  insertId: number;
  serverStatus: number;
  warningCount: number;
  message: string;
  protocol41: boolean;
  changedRows: number;
};

export type ActionResult<T> = ActionResultSuccess<T> | ActionResultError<T>;

export function isActionResultError<T>(ar: ActionResult<T>): ar is ActionResultError<T> {
  return ar.value === undefined && ar.error !== undefined;
}

export function hasQueryFailed<T>(ar: { value: T; error?: MysqlError; } | { value?: T; error: MysqlError; }): ar is { value?: T; error: MysqlError; } {
  return ar.value === undefined && ar.error !== undefined;
}