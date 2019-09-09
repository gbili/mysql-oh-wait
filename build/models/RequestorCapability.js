"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
let _requestor = null;

class RequestorCapability {
  static inject({
    requestor
  }) {
    requestor && RequestorCapability.setRequestor(requestor);
  }

  static setRequestor(requestor) {
    _requestor = requestor;
  }

  static getRequestor() {
    if (!_requestor) {
      throw new Error('Must set requestor first');
    }

    return _requestor;
  }

}

exports.default = RequestorCapability;