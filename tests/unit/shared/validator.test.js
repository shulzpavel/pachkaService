import { describe, test, expect } from "@jest/globals";
import { validateJiraPayload } from "../../../shared/validator.js";

describe("Validator Module", () => {
  describe("validateJiraPayload", () => {
    test("should validate payload with issue", () => {
      const payload = {
        webhookEvent: "jira:issue_created",
        issue: {
          key: "PROJ-123",
          fields: {
            project: { key: "PROJ" },
            summary: "Test issue",
          },
        },
      };

      const result = validateJiraPayload(payload);
      expect(result.valid).toBe(true);
    });

    test("should validate payload with automationName", () => {
      const payload = {
        webhookEvent: "jira:issue_created",
        automationName: "My Automation",
        issue: {
          key: "PROJ-123",
          fields: {
            project: { key: "PROJ" },
          },
        },
      };

      const result = validateJiraPayload(payload);
      expect(result.valid).toBe(true);
    });

    test("should reject payload without issue or automationName", () => {
      const payload = {
        webhookEvent: "jira:issue_created",
      };

      const result = validateJiraPayload(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("either 'issue' or 'automationName'");
    });

    test("should reject non-object payload", () => {
      expect(validateJiraPayload(null).valid).toBe(false);
      expect(validateJiraPayload("string").valid).toBe(false);
      expect(validateJiraPayload(123).valid).toBe(false);
    });

    test("should validate payload with user", () => {
      const payload = {
        issue: { key: "PROJ-123", fields: {} },
        user: {
          displayName: "Test User",
        },
      };

      const result = validateJiraPayload(payload);
      expect(result.valid).toBe(true);
    });

    test("should reject invalid user type", () => {
      const payload = {
        issue: { key: "PROJ-123", fields: {} },
        user: "not-an-object",
      };

      const result = validateJiraPayload(payload);
      expect(result.valid).toBe(false);
    });

    test("should reject invalid automationName type", () => {
      const payload = {
        automationName: 123,
      };

      const result = validateJiraPayload(payload);
      expect(result.valid).toBe(false);
    });
  });
});
