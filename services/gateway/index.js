import express from "express";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import crypto from "crypto";
import logger from "../../shared/logger.js";
import {
  verifyJiraWebhookSignature,
  isIPAllowed,
} from "../../shared/security.js";
import { validateJiraPayload, logPayloadStructure } from "../../shared/validator.js";
import { fetchWithTimeout } from "../../shared/fetch-with-timeout.js";

dotenv.config();

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;
const ROUTER_SERVICE_URL = process.env.ROUTER_SERVICE_URL || "http://router:3001";
const NOTIFIER_SERVICE_URL = process.env.NOTIFIER_SERVICE_URL || "http://notifier:3002";

// Trust proxy - только для конкретных IP/подсетей (защита от спуфинга)
// Если используешь reverse proxy, укажи его IP в TRUSTED_PROXIES
const trustedProxies = process.env.TRUSTED_PROXIES
  ? process.env.TRUSTED_PROXIES.split(",").map((ip) => ip.trim())
  : [];
if (trustedProxies.length > 0) {
  app.set("trust proxy", (ip) => trustedProxies.includes(ip));
} else {
  // Если нет настроенных прокси, не доверяем никому
  app.set("trust proxy", false);
}

// Rate limiting
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // ОТКЛЮЧЕНО для локального тестирования - установи JIRA_ALLOWED_IPS для production
    if (!process.env.JIRA_ALLOWED_IPS || process.env.JIRA_ALLOWED_IPS.trim() === "") {
      return true; // Пропускаем rate limit если IP allowlist не настроен
    }
    const allowedIPs = process.env.JIRA_ALLOWED_IPS.split(",").map((ip) => ip.trim());
    if (allowedIPs.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress;
      return isIPAllowed(clientIP, allowedIPs);
    }
    return false;
  },
});

// Middleware для сохранения raw body для HMAC
app.use(
  "/jira/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  (req, res, next) => {
    try {
      logger.debug("Parsing webhook body", {
        contentType: req.headers["content-type"],
        contentLength: req.headers["content-length"],
        hasBody: !!req.body,
        bodyLength: req.body?.length,
      });
      
      if (!req.body || req.body.length === 0) {
        logger.error("Empty webhook body", { 
          contentType: req.headers["content-type"],
          contentLength: req.headers["content-length"],
        });
        return res.status(400).json({ error: "Empty request body" });
      }
      
      req.rawBody = req.body.toString("utf8");
      logger.debug("Raw body parsed", { bodyLength: req.rawBody.length });
      
      req.body = JSON.parse(req.rawBody);
      logger.debug("JSON parsed successfully", { 
        hasIssue: !!req.body.issue,
        hasAutomationName: !!req.body.automationName,
      });
      
      next();
    } catch (error) {
      logger.error("Failed to parse webhook body", { 
        error: error.message,
        stack: error.stack,
        contentType: req.headers["content-type"],
        bodyPreview: req.body?.toString("utf8")?.substring(0, 200),
      });
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }
);

app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "gateway",
    timestamp: new Date().toISOString(),
  });
});

// Service health checks
app.get("/health/services", async (req, res) => {
  const services = {
    router: { status: "unknown", url: ROUTER_SERVICE_URL },
    notifier: { status: "unknown", url: NOTIFIER_SERVICE_URL },
  };

  // Проверяем доступность сервисов
  for (const [name, service] of Object.entries(services)) {
    try {
      const response = await fetchWithTimeout(
        `${service.url}/health`,
        {},
        2000 // 2 секунды timeout для health check
      );
      service.status = response.ok ? "ok" : "error";
    } catch (error) {
      service.status = "error";
      service.error = error.message;
    }
  }

  res.json({ services });
});

// Jira webhook endpoint
// Увеличиваем timeout для Express (по умолчанию 2 минуты, но лучше явно указать)
app.post("/jira/webhook", webhookLimiter, async (req, res) => {
  // Устанавливаем timeout для этого запроса (60 секунд)
  req.setTimeout(60000);
  res.setTimeout(60000);
  
  // Логируем начало обработки запроса
  const clientIP = req.ip || req.connection.remoteAddress;
  logger.info("Webhook request received", {
    method: req.method,
    path: req.path,
    ip: clientIP,
    contentType: req.headers["content-type"],
    contentLength: req.headers["content-length"],
    hasBody: !!req.body,
    bodyType: typeof req.body,
  });
  
  const payload = req.body;
  const webhookEvent =
    req.headers["x-atlassian-webhook-event"] || req.body.webhookEvent;

  // Проверка IP allowlist
  // ОТКЛЮЧЕНО для локального тестирования - установи JIRA_ALLOWED_IPS для production
  if (process.env.JIRA_ALLOWED_IPS && process.env.JIRA_ALLOWED_IPS.trim() !== "") {
    const allowedIPs = process.env.JIRA_ALLOWED_IPS.split(",").map((ip) => ip.trim());
    if (allowedIPs.length > 0 && !isIPAllowed(clientIP, allowedIPs)) {
      logger.warn("Webhook request from unauthorized IP", { ip: clientIP });
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  // Проверка HMAC подписи
  const webhookSecret = process.env.JIRA_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature =
      req.headers["x-jira-webhook-signature"] ||
      req.headers["x-hub-signature-256"] ||
      req.headers["x-atlassian-webhook-signature"];

    const rawBody = req.rawBody || JSON.stringify(payload);
    const actualSignature = signature
      ?.replace(/^sha256[=:]/, "")
      ?.replace(/^sha1[=:]/, "") || signature;

    if (
      !signature ||
      !verifyJiraWebhookSignature(rawBody, actualSignature, webhookSecret)
    ) {
      logger.warn("Invalid webhook signature", {
        ip: clientIP,
        hasSignature: !!signature,
      });
      return res.status(401).json({ error: "Unauthorized" });
    }
  } else {
    const atlassianToken = req.headers["x-atlassian-token"];
    if (atlassianToken !== "no-check") {
      logger.warn("Missing X-Atlassian-Token header", { ip: clientIP });
    }
  }

  // Валидация payload
  const validation = validateJiraPayload(payload);
  if (!validation.valid) {
    logger.warn("Invalid webhook payload", {
      error: validation.error,
      ip: clientIP,
    });
    return res.status(400).json({ error: validation.error });
  }

  logPayloadStructure(payload);

  logger.info("Received Jira webhook", {
    webhookEvent,
    issueKey: payload.issue?.key,
    projectKey: payload.issue?.fields?.project?.key,
    automationName: payload.automationName,
    ip: clientIP,
  });

  try {
    // Логируем URL для отладки
    const routerUrl = `${ROUTER_SERVICE_URL}/route`;
    logger.debug("Forwarding to router", { url: routerUrl });
    
    // Форвардим в Router Service с реальным timeout
    const routerResponse = await fetchWithTimeout(
      routerUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": req.headers["x-request-id"] || crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
      },
      10000 // 10 секунд timeout
    );

    if (!routerResponse.ok) {
      const errorText = await routerResponse.text();
      const statusCode = routerResponse.status;
      const isRetryable = statusCode >= 500 || statusCode === 429;

      logger.error("Router service error", {
        status: statusCode,
        error: errorText,
        isRetryable,
      });

      // Для 5xx/429 возвращаем 503 чтобы Jira повторил
      if (isRetryable) {
        return res.status(503).json({
          status: "error",
          error: "Router service temporarily unavailable",
          retryable: true,
        });
      }

      // Для 4xx возвращаем 400
      return res.status(400).json({
        status: "error",
        error: errorText,
        retryable: false,
      });
    }

    const routeResult = await routerResponse.json();

    if (!routeResult.route) {
      logger.info("No route matched, ignoring webhook");
      return res.status(200).json({ status: "ignored" });
    }

    // Форвардим в Notifier Service с реальным timeout
    const notifierResponse = await fetchWithTimeout(
      `${NOTIFIER_SERVICE_URL}/notify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": req.headers["x-request-id"] || crypto.randomUUID(),
        },
        body: JSON.stringify({
          chatId: routeResult.route.chatId,
          content: routeResult.route.content,
          metadata: {
            ruleName: routeResult.route.ruleName,
            issueKey: payload.issue?.key,
          },
        }),
      },
      15000 // 15 секунд timeout
    );

    if (!notifierResponse.ok) {
      const errorText = await notifierResponse.text();
      const statusCode = notifierResponse.status;
      const isRetryable = statusCode >= 500 || statusCode === 429;

      logger.error("Notifier service error", {
        status: statusCode,
        error: errorText,
        isRetryable,
      });

      if (isRetryable) {
        return res.status(503).json({
          status: "error",
          error: "Service temporarily unavailable",
          retryable: true,
        });
      } else {
        return res.status(200).json({
          status: "error",
          error: errorText,
          retryable: false,
        });
      }
    }

    const notifyResult = await notifierResponse.json();

    logger.info("Webhook processed successfully", {
      ruleName: routeResult.route.ruleName,
      chatId: routeResult.route.chatId,
      issueKey: payload.issue?.key,
    });

    // Отвечаем Jira сразу после успешной обработки (не ждем отправки в Пачку)
    // Это предотвращает таймауты Jira (30 секунд)
    res.status(200).json({
      status: "ok",
      rule: routeResult.route.ruleName,
      chatId: routeResult.route.chatId,
    });
    
    // Логируем успех после отправки ответа
    logger.info("Response sent to Jira, processing continues asynchronously");
  } catch (error) {
    logger.error("Failed to process webhook", {
      error: error.message,
      stack: error.stack,
      issueKey: payload?.issue?.key,
      automationName: payload?.automationName,
      ip: clientIP,
      routerUrl: ROUTER_SERVICE_URL,
      notifierUrl: NOTIFIER_SERVICE_URL,
    });

    const isRetryable =
      error.message.includes("timeout") ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ECONNRESET") ||
      error.name === "TimeoutError";

    // Для retryable ошибок возвращаем 503 (Jira повторит)
    if (isRetryable) {
      return res.status(503).json({
        status: "error",
        error: "Service temporarily unavailable",
        retryable: true,
      });
    }

    // Для критических ошибок возвращаем 500 (Jira не будет повторять)
    // Но только если это не ошибка валидации (она уже обработана выше)
    return res.status(500).json({
      status: "error",
      error: process.env.NODE_ENV === "production" 
        ? "Internal server error" 
        : error.message,
      retryable: false,
    });
  }
});

// Обработчик необработанных ошибок
app.use((err, req, res, next) => {
  logger.error("Unhandled error in Express", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Если ответ уже отправлен, передаем ошибку дальше
  if (res.headersSent) {
    return next(err);
  }

  // Возвращаем 500 для необработанных ошибок
  res.status(500).json({
    status: "error",
    error: process.env.NODE_ENV === "production" 
      ? "Internal server error" 
      : err.message,
  });
});

app.listen(PORT, () => {
  logger.info(`Gateway service started on port ${PORT}`);
  logger.info(`Router service URL: ${ROUTER_SERVICE_URL}`);
  logger.info(`Notifier service URL: ${NOTIFIER_SERVICE_URL}`);
});
