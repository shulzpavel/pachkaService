import { shouldSendAlert, getFingerprint } from "../alertProcessor.js";

describe("alertProcessor", () => {
  test("allows first alert and blocks duplicate with same status/times", () => {
    const cache = new Map();
    const alert = {
      fingerprint: "abc",
      status: "firing",
      startsAt: "2026-01-23T18:17:26.701Z",
    };
    expect(shouldSendAlert(cache, alert)).toBe(true);
    expect(shouldSendAlert(cache, alert)).toBe(false);
  });

  test("sends when status changes to resolved", () => {
    const cache = new Map();
    const alert = { fingerprint: "abc", status: "firing", startsAt: "1" };
    const resolved = { fingerprint: "abc", status: "resolved", startsAt: "1", endsAt: "2" };
    expect(shouldSendAlert(cache, alert)).toBe(true);
    expect(shouldSendAlert(cache, resolved)).toBe(true);
  });

  test("computes fingerprint from labels if missing", () => {
    const a = { labels: { b: "2", a: "1" } };
    const b = { labels: { a: "1", b: "2" } };
    expect(getFingerprint(a)).toBe(getFingerprint(b)); // порядок неважен
  });
});
