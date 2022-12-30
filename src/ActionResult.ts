import { MysqlError } from "mysql";
import { ConnectionInfo } from "./MysqlReq";
import OhWaitError from "./OhWaitError";

// export default class ActionResult<T extends any, U extends any> {
//   constructor(public value: T, public error?: Error, public info?: U) {}
// }
export type ActionResultSuccess<T> = {
  value: T;
  error?: MysqlError | OhWaitError;
  info: ConnectionInfo;
}

export type ActionResultError<T> = {
  value?: T;
  error: MysqlError | OhWaitError;
  info: ConnectionInfo;
}

export type ActionResult<T> = ActionResultSuccess<T> | ActionResultError<T>;

export function isActionResultError<T>(ar: ActionResult<T>): ar is ActionResultError<T> {
  return ar.value === undefined && ar.error !== undefined;
}

export function hasQueryFailed<T>(ar: { value: T; error?: MysqlError; } | { value?: T; error: MysqlError; }): ar is { value?: T; error: MysqlError; } {
  return ar.value === undefined && ar.error !== undefined;
}