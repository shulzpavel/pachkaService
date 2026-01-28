import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { routeMessage, reloadRoutes } from "../../services/router/router.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testRoutesPath;

const writeTestRoutes = (rules) => {
  testRoutesPath = path.join(__dirname, "../../routes.test.json");
  fs.writeFileSync(
    testRoutesPath,
    JSON.stringify({ rules, defaultChatId: null }, null, 2)
  );
  process.env.ROUTES_CONFIG_PATH = testRoutesPath;
  reloadRoutes();
};

describe("Router Service Integration", () => {
  afterEach(() => {
    if (testRoutesPath && fs.existsSync(testRoutesPath)) {
      fs.unlinkSync(testRoutesPath);
    }
    testRoutesPath = null;
    delete process.env.ROUTES_CONFIG_PATH;
    reloadRoutes();
  });

  test("should route by projectKey", () => {
    const rules = [
      {
        name: "Test Rule",
        conditions: { projectKey: "PROJ1" },
        chatId: "123",
        template: "Issue: {issue.key}",
      },
    ];
    writeTestRoutes(rules);

    const payload = {
      issue: {
        key: "PROJ1-123",
        fields: {
          project: { key: "PROJ1" },
          summary: "Test issue",
        },
      },
    };

    const result = routeMessage(payload);
    expect(result).toBeTruthy();
    expect(result.chatId).toBe("123");
  });

  test("should route by automationName", () => {
    const rules = [
      {
        name: "Automation Rule",
        conditions: { automationName: "My Automation" },
        chatId: "999",
        template: "Automation: {automationName}",
      },
    ];
    writeTestRoutes(rules);

    const payload = {
      automationName: "My Automation",
      issue: {
        key: "PROJ-123",
        fields: {
          project: { key: "PROJ" },
        },
      },
    };

    const result = routeMessage(payload);
    expect(result).toBeTruthy();
    expect(result.chatId).toBe("999");
  });
});
