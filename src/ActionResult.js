export default class ActionResult {
  constructor({ value, error, info }) {
    this.value = value;
    this.error = error;
    if (info) {
      this.info = info;
    }
  }
}

