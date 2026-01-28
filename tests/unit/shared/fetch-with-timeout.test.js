import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { fetchWithTimeout } from "../../../shared/fetch-with-timeout.js";

let originalFetch;
let mockFetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  mockFetch = jest.fn();
  globalThis.fetch = (...args) => mockFetch(...args);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchWithTimeout", () => {
  test("should resolve before timeout for fast requests", async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true }), 10);
        })
    );

    const result = await fetchWithTimeout("http://test.local", {}, 5000);
    expect(result).toBeDefined();
  }, 10000);

  test("should reject on timeout", async () => {
    mockFetch.mockImplementation(
      (url, options = {}) =>
        new Promise((resolve, reject) => {
          const { signal } = options;
          const abortError = () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          };

          if (signal) {
            if (signal.aborted) {
              abortError();
              return;
            }
            signal.addEventListener("abort", abortError, { once: true });
          }
        })
    );

    await expect(fetchWithTimeout("http://test.local", {}, 100)).rejects.toThrow(
      "timeout"
    );
  }, 10000);
});
