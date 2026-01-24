const stateCode = {
  CLOSED: 0,
  HALF_OPEN: 1,
  OPEN: 2,
};

export class CircuitBreaker {
  constructor(
    name,
    { failThreshold = 3, cooldownMs = 30000, onStateChange = null } = {}
  ) {
    this.name = name;
    this.failThreshold = failThreshold;
    this.cooldownMs = cooldownMs;
    this.state = "CLOSED";
    this.failures = 0;
    this.nextTry = 0;
    this.onStateChange = onStateChange;
  }

  _trip() {
    this._setState("OPEN");
    this.nextTry = Date.now() + this.cooldownMs;
  }

  _halfOpenIfReady() {
    if (this.state === "OPEN" && Date.now() >= this.nextTry) {
      this._setState("HALF_OPEN");
    }
  }

  _setState(newState) {
    if (this.state !== newState) {
      this.state = newState;
      if (this.onStateChange) {
        this.onStateChange(newState, stateCode[newState]);
      }
    }
  }

  async exec(fn) {
    this._halfOpenIfReady();
    if (this.state === "OPEN") {
      const err = new Error(`Circuit '${this.name}' is open`);
      err.isRetryable = true;
      throw err;
    }

    try {
      const res = await fn();
      this.failures = 0;
      this._setState("CLOSED");
      return res;
    } catch (err) {
      this.failures += 1;
      if (this.state === "HALF_OPEN" || this.failures >= this.failThreshold) {
        this._trip();
      }
      throw err;
    }
  }
}

export { stateCode as circuitBreakerStateCode };
