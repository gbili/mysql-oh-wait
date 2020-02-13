import RequestorCapability from './RequestorCapability';

let _events = null;
export default class RequestorModel extends RequestorCapability {

  static inject({ events, requestor }) {
    requestor && RequestorCapability.inject({ requestor });
    events && RequestorModel.setEvents(events);
  }

  static setEvents(events) {
    _events = events;
  }

  static getEvents() {
    if (!_events) {
      throw new Error('Must set events first');
    }
    return _events;
  }

  static async query(params) {

    const actionResult = await RequestorModel.getRequestor().query(params);

    if (actionResult.error) {
      RequestorModel.getEvents().emit('RequestorModel:query:error', actionResult.error);
    }

    return actionResult;
  }

}
