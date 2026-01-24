import { jest } from "@jest/globals";
import { CircuitBreaker } from "../circuit-breaker.js";

describe("CircuitBreaker", () => {
  test("opens after threshold and recovers after cooldown", async () => {
    jest.useFakeTimers();
    const states = [];
    const breaker = new CircuitBreaker("test", {
      failThreshold: 2,
      cooldownMs: 1000,
      onStateChange: (s) => states.push(s),
    });

    const failing = () => { throw new Error("fail"); };

    await expect(breaker.exec(failing)).rejects.toThrow("fail");
    await expect(breaker.exec(failing)).rejects.toThrow("fail");
    expect(breaker.state).toBe("OPEN");

    jest.advanceTimersByTime(1000);
    // Next call should go HALF_OPEN then CLOSE on success
    await expect(breaker.exec(() => "ok")).resolves.toBe("ok");
    expect(breaker.state).toBe("CLOSED");

    expect(states).toEqual(["OPEN", "HALF_OPEN", "CLOSED"]);
    jest.useRealTimers();
  });
});
