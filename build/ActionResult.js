"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

class ActionResult {
  constructor({
    value,
    error,
    info
  }) {
    this.value = value;
    this.error = error;

    if (info) {
      this.info = info;
    }
  }

}

exports.default = ActionResult;