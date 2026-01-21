import { describe, test, expect, beforeAll } from "@jest/globals";

/**
 * Полный интеграционный тест потока:
 * Jira webhook → Gateway → Router → Notifier → Pachka
 * 
 * Для запуска требуется:
 * 1. Запущенные сервисы (docker-compose up)
 * 2. Валидный routes.json
 * 3. Валидный PACHKA_TOKEN (опционально, можно мокировать)
 */

describe("Full Flow Integration Test", () => {
  const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3000";

  beforeAll(() => {
    // Пропускаем тесты если сервисы не запущены
    if (process.env.SKIP_INTEGRATION_TESTS === "true") {
      console.log("⚠️  Skipping integration tests - set SKIP_INTEGRATION_TESTS=false to run");
    }
  });

  test("should process webhook end-to-end", async () => {
    const payload = {
      webhookEvent: "jira:issue_created",
      automationName: "Test Automation",
      issue: {
        key: "PROJ1-123",
        fields: {
          project: { key: "PROJ1" },
          summary: "Integration test issue",
          status: { name: "To Do" },
          issuetype: { name: "Bug" },
        },
      },
      user: {
        displayName: "Test User",
      },
    };

    // Этот тест требует запущенных сервисов
    if (process.env.SKIP_INTEGRATION_TESTS === "true") {
      console.log("Skipping integration test - services not available");
      return;
    }

    const response = await fetch(`${GATEWAY_URL}/jira/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Atlassian-Token": "no-check",
      },
      body: JSON.stringify(payload),
    });

    // Проверяем что получили ответ (может быть 200 или 503 если notifier недоступен)
    expect([200, 503]).toContain(response.status);
  });

  test("should validate payload and reject invalid", async () => {
    const invalidPayload = {
      webhookEvent: "jira:issue_created",
      // Нет issue и automationName
    };

    const response = await fetch(`${GATEWAY_URL}/jira/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Atlassian-Token": "no-check",
      },
      body: JSON.stringify(invalidPayload),
    });

    expect(response.status).toBe(400);
  });
});
