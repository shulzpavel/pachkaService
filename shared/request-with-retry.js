import { fetchWithTimeout } from "./fetch-with-timeout.js";

export async function requestWithRetry(
  url,
  options = {},
  { timeoutMs = 10000, retries = 3, backoffMs = 300, fetchFn = fetchWithTimeout } = {}
) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchFn(url, options, timeoutMs);
    } catch (error) {
      lastError = error;
      const retryable =
        error.isRetryable !== false ||
        error.name === "TimeoutError" ||
        (error.code && ["ECONNRESET", "ECONNREFUSED"].includes(error.code));
      if (!retryable || attempt === retries) throw error;
      const delay = Math.min(backoffMs * Math.pow(2, attempt - 1), 5000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
