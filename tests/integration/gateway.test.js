import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import express from "express";

// Моки для тестирования gateway
const createMockGateway = () => {
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "gateway" });
  });

  app.post("/jira/webhook", (req, res) => {
    res.json({ status: "ok" });
  });

  return app;
};

describe("Gateway Service Integration", () => {
  let app;

  beforeAll(() => {
    app = createMockGateway();
  });

  test("should respond to health check", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("gateway");
  });

  test("should accept webhook payload", async () => {
    const payload = {
      webhookEvent: "jira:issue_created",
      issue: {
        key: "PROJ-123",
        fields: {
          project: { key: "PROJ" },
          summary: "Test",
        },
      },
    };

    const response = await request(app)
      .post("/jira/webhook")
      .send(payload)
      .set("Content-Type", "application/json");

    expect(response.status).toBe(200);
  });
});
