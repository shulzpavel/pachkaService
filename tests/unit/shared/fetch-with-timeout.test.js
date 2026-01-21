import { describe, test, expect } from "@jest/globals";
import { fetchWithTimeout } from "../../../shared/fetch-with-timeout.js";

describe("fetchWithTimeout", () => {
  test("should resolve before timeout for fast requests", async () => {
    // Используем реальный fetch, но с большим timeout
    // В реальном тесте можно использовать моки или тестовый сервер
    const result = await fetchWithTimeout(
      "https://httpbin.org/delay/1",
      {},
      5000
    );
    expect(result).toBeDefined();
  }, 10000);

  test("should reject on timeout", async () => {
    // Тест с очень коротким timeout
    await expect(
      fetchWithTimeout(
        "https://httpbin.org/delay/5", // Задержка 5 секунд
        {},
        100 // Timeout 100ms
      )
    ).rejects.toThrow("timeout");
  }, 10000);
});
