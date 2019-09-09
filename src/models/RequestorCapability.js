let _requestor = null;

export default class RequestorCapability {
  static inject({ requestor }) {
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
