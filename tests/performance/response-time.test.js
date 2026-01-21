import { describe, test, expect } from "@jest/globals";

/**
 * Тесты производительности - проверка времени отклика
 */

describe("Performance Tests", () => {
  const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3000";
  const MAX_RESPONSE_TIME = 500; // ms

  test("health check should respond quickly", async () => {
    const start = Date.now();
    const response = await fetch(`${GATEWAY_URL}/health`);
    const duration = Date.now() - start;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(MAX_RESPONSE_TIME);
  });

  test("webhook processing should complete within timeout", async () => {
    const payload = {
      webhookEvent: "jira:issue_created",
      issue: {
        key: "PROJ-123",
        fields: {
          project: { key: "PROJ1" },
          summary: "Performance test",
        },
      },
    };

    const start = Date.now();
    const response = await fetch(`${GATEWAY_URL}/jira/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Atlassian-Token": "no-check",
      },
      body: JSON.stringify(payload),
    });
    const duration = Date.now() - start;

    // Проверяем что получили ответ (может быть 200 или 503)
    expect([200, 503]).toContain(response.status);
    // Проверяем что ответ пришел быстро
    expect(duration).toBeLessThan(5000); // 5 секунд максимум
  });
});
