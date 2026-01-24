import { jest } from "@jest/globals";
import { requestWithRetry } from "../request-with-retry.js";

describe("requestWithRetry", () => {
  it("retries and succeeds on second attempt", async () => {
    const mockFetch = jest
      .fn()
      .mockImplementationOnce(() => {
        throw Object.assign(new Error("fail"), { isRetryable: true });
      })
      .mockImplementationOnce(() => ({ ok: true, status: 200 }));

    const res = await requestWithRetry("http://test", {}, { retries: 2, backoffMs: 1, timeoutMs: 5, fetchFn: mockFetch });
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("fails after max retries", async () => {
    const mockFetch = jest.fn(() => {
      throw Object.assign(new Error("fail"), { isRetryable: true });
    });
    await expect(
      requestWithRetry("http://test", {}, { retries: 2, backoffMs: 1, timeoutMs: 5, fetchFn: mockFetch })
    ).rejects.toThrow("fail");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
