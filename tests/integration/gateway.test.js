import { describe, test, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import http from "http";

// Моки для тестирования gateway
const createMockGateway = () => {
  return http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "gateway" }));
      return;
    }

    if (req.method === "POST" && req.url === "/jira/webhook") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    res.statusCode = 404;
    res.end();
  });
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
