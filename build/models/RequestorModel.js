"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _RequestorCapability = _interopRequireDefault(require("./RequestorCapability"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let _events = null;

class RequestorModel extends _RequestorCapability.default {
  static inject({
    events,
    requestor
  }) {
    requestor && _RequestorCapability.default.inject({
      requestor
    });
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

exports.default = RequestorModel;