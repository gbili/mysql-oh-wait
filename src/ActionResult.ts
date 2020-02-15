export default class ActionResult<T extends any, U extends any> {
  constructor(public value: T, public error: Error | null, public info?: U) {}
}