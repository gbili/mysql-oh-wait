import { ActionResult, SimpleQueryResult } from '../ActionResult';
import RequestorCapability, { InjectRequestorInterface } from './RequestorCapability';

export interface EventsInterface {
  emit: (eventName: string, data: any) => void;
}

export interface InjectRequestorEventsInterface extends InjectRequestorInterface {
  events?: EventsInterface;
}

let _events: EventsInterface | null = null;

export default class RequestorModel extends RequestorCapability {

  static inject({ events, requestor }: InjectRequestorEventsInterface) {
    requestor && RequestorCapability.inject({ requestor });
    events && RequestorModel.setEvents(events);
  }

  static setEvents(events: EventsInterface) {
    _events = events;
  }

  static getEvents(): EventsInterface {
    if (!_events) {
      throw new Error('Must set events first');
    }
    return _events;
  }

  static async query<T extends SimpleQueryResult>(params: {
    sql: string;
    values?: any;
  }): Promise<ActionResult<T>>;
  // Overload 2: When `after` is provided
  static async query<T extends SimpleQueryResult, Z>(params: {
    sql: string;
    values?: any;
    after: (res: T) => Z;
  }): Promise<ActionResult<Z>>;
  // Implementation
  static async query<T extends SimpleQueryResult, Z>(params: {
    sql: string;
    values?: any;
    after?: (res: T) => Z;
  }) {
    const actionResult = await RequestorModel.getRequestor().query(params);
    if (actionResult.error) {
      RequestorModel.getEvents().emit('RequestorModel:query:error', actionResult.error);
    }
    return actionResult;
  }

}
