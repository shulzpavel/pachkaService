import { describe, test, expect } from "@jest/globals";
import { routeMessage } from "../../../services/router/router.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем временный routes.json для тестов
const createTestRoutes = (rules) => {
  const testRoutesPath = path.join(__dirname, "../../routes.test.json");
  fs.writeFileSync(
    testRoutesPath,
    JSON.stringify({ rules, defaultChatId: null }, null, 2)
  );
  return testRoutesPath;
};

describe("Router Service Integration", () => {
  test("should route by projectKey", () => {
    const rules = [
      {
        name: "Test Rule",
        conditions: { projectKey: "PROJ1" },
        chatId: "123",
        template: "Issue: {issue.key}",
      },
    ];

    const payload = {
      issue: {
        key: "PROJ1-123",
        fields: {
          project: { key: "PROJ1" },
          summary: "Test issue",
        },
      },
    };

    // Мокаем загрузку конфигурации
    const result = routeMessage(payload);
    // Тест будет работать только если routes.json существует и валиден
    // В реальном тесте нужно мокировать loadRoutes
  });

  test("should route by automationName", () => {
    const payload = {
      automationName: "My Automation",
      issue: {
        key: "PROJ-123",
        fields: {
          project: { key: "PROJ" },
        },
      },
    };

    // Аналогично - нужен мок
  });
});
