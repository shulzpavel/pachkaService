import fetch from "node-fetch";

/**
 * Fetch с реальным timeout через AbortController
 * @param {string} url
 * @param {Object} options
 * @param {number} timeoutMs - таймаут в миллисекундах
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      const timeoutError = new Error(`Request timeout after ${timeoutMs}ms`);
      timeoutError.name = "TimeoutError";
      timeoutError.isRetryable = true;
      throw timeoutError;
    }
    throw error;
  }
}
