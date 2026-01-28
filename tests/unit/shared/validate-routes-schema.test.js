import { describe, test, expect } from "@jest/globals";
import { validateRoutesSchema } from "../../../shared/validate-routes-schema.js";

describe("Routes Schema Validator", () => {
  test("should validate correct schema", () => {
    const config = {
      rules: [
        {
          name: "Test Rule",
          conditions: { projectKey: "PROJ1" },
          chatId: "123",
          template: "Test template",
        },
      ],
    };

    const result = validateRoutesSchema(config);
    expect(result.valid).toBe(true);
  });

  test("should reject missing rules", () => {
    const config = {};
    const result = validateRoutesSchema(config);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("rules");
  });

  test("should reject empty rules array", () => {
    const config = { rules: [] };
    const result = validateRoutesSchema(config);
    expect(result.valid).toBe(false);
    expect(result.details.some((detail) => detail.includes("empty"))).toBe(true);
  });

  test("should reject rule without name", () => {
    const config = {
      rules: [
        {
          conditions: { projectKey: "PROJ1" },
          chatId: "123",
          template: "Test",
        },
      ],
    };

    const result = validateRoutesSchema(config);
    expect(result.valid).toBe(false);
    expect(result.details.some((d) => d.includes("name"))).toBe(true);
  });

  test("should reject rule without chatId", () => {
    const config = {
      rules: [
        {
          name: "Test",
          conditions: { projectKey: "PROJ1" },
          template: "Test",
        },
      ],
    };

    const result = validateRoutesSchema(config);
    expect(result.valid).toBe(false);
    expect(result.details.some((d) => d.includes("chatId"))).toBe(true);
  });

  test("should reject rule without template", () => {
    const config = {
      rules: [
        {
          name: "Test",
          conditions: { projectKey: "PROJ1" },
          chatId: "123",
        },
      ],
    };

    const result = validateRoutesSchema(config);
    expect(result.valid).toBe(false);
    expect(result.details.some((d) => d.includes("template"))).toBe(true);
  });

  test("should reject empty template", () => {
    const config = {
      rules: [
        {
          name: "Test",
          conditions: { projectKey: "PROJ1" },
          chatId: "123",
          template: "",
        },
      ],
    };

    const result = validateRoutesSchema(config);
    expect(result.valid).toBe(false);
    expect(result.details.some((d) => d.includes("template") && d.includes("empty"))).toBe(true);
  });

  test("should reject unknown condition", () => {
    const config = {
      rules: [
        {
          name: "Test",
          conditions: { unknownCondition: "value" },
          chatId: "123",
          template: "Test",
        },
      ],
    };

    const result = validateRoutesSchema(config);
    expect(result.valid).toBe(false);
    expect(result.details.some((d) => d.includes("unknown condition"))).toBe(true);
  });

  test("should accept valid defaultChatId", () => {
    const config = {
      rules: [
        {
          name: "Test",
          conditions: { projectKey: "PROJ1" },
          chatId: "123",
          template: "Test",
        },
      ],
      defaultChatId: "999",
    };

    const result = validateRoutesSchema(config);
    expect(result.valid).toBe(true);
  });

  test("should reject invalid defaultChatId type", () => {
    const config = {
      rules: [
        {
          name: "Test",
          conditions: { projectKey: "PROJ1" },
          chatId: "123",
          template: "Test",
        },
      ],
      defaultChatId: {},
    };

    const result = validateRoutesSchema(config);
    expect(result.valid).toBe(false);
  });

  test("should validate all condition types", () => {
    const config = {
      rules: [
        {
          name: "Test",
          conditions: {
            automationName: "Auto1",
            projectKey: "PROJ1",
            component: "Backend",
            label: "urgent",
            boardId: 123,
            issueType: "Bug",
          },
          chatId: "123",
          template: "Test",
        },
      ],
    };

    const result = validateRoutesSchema(config);
    expect(result.valid).toBe(true);
  });
});
