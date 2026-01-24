import express from "express";
import dotenv from "dotenv";
import logger from "../../shared/logger.js";
import { isIPAllowed } from "../../shared/security.js";
import { sendMessageWithRetry } from "./pachka.js";
import { createMetrics } from "../../shared/metrics.js";
import { formatAlertMessage } from "./alertFormatter.js";
import { shouldSendAlert } from "./alertProcessor.js";
import { CircuitBreaker, circuitBreakerStateCode } from "../../shared/circuit-breaker.js";

dotenv.config();

const app = express();
const PORT = process.env.NOTIFIER_PORT || 3002;
const ALERT_CHAT_ID = process.env.ALERT_CHAT_ID || "33378985";
const metrics = createMetrics("notifier");
const alertCache = new Map();
const MAX_CONCURRENCY = parseInt(process.env.NOTIFIER_CONCURRENCY || "5", 10);
const SEND_TIMEOUT_MS = parseInt(process.env.NOTIFIER_TIMEOUT_MS || "10000", 10);
const MAX_QUEUE = parseInt(process.env.NOTIFIER_MAX_QUEUE || "500", 10);

// Circuit breaker для Pachka API
const pachkaBreaker = new CircuitBreaker("pachka", {
  failThreshold: parseInt(process.env.BREAKER_FAIL_THRESHOLD || "5", 10),
  cooldownMs: parseInt(process.env.BREAKER_COOLDOWN_MS || "30000", 10),
  onStateChange: (state, code) => breakerGauge.set({ target: "pachka" }, code),
});

// Простая очередь с ограничением параллельных отправок
let inFlight = 0;
const queue = [];
const queueGauge = new metrics.client.Gauge({
  name: "notifier_queue_length",
  help: "Current notifier queue length",
  registers: [metrics.register],
});
const breakerGauge = new metrics.client.Gauge({
  name: "notifier_circuit_breaker_state",
  help: "Circuit breaker state (0 closed,1 half-open,2 open)",
  labelNames: ["target"],
  registers: [metrics.register],
});
breakerGauge.set({ target: "pachka" }, circuitBreakerStateCode.CLOSED);
const processQueue = () => {
  if (inFlight >= MAX_CONCURRENCY) return;
  const job = queue.shift();
  if (!job) return;
  inFlight++;
  job()
    .catch(() => {})
    .finally(() => {
      inFlight--;
      if (queueGauge) queueGauge.set(queue.length);
      processQueue();
    });
};
const enqueueSend = (fn) =>
  new Promise((resolve, reject) => {
    if (queue.length >= MAX_QUEUE) {
      const err = new Error("Notifier queue overflow");
      err.isRetryable = true;
      return reject(err);
    }
    queue.push(async () => {
      try {
        const res = await fn();
        resolve(res);
      } catch (e) {
        reject(e);
      }
    });
    if (queueGauge) queueGauge.set(queue.length);
    processQueue();
  });

// Middleware для проверки внутреннего доступа (только от gateway)
// ОТКЛЮЧЕНО для локального тестирования - установи INTERNAL_ALLOWED_IPS для production
app.use((req, res, next) => {
  // Если переменная не установлена или пустая - пропускаем все (для локального тестирования)
  if (!process.env.INTERNAL_ALLOWED_IPS || process.env.INTERNAL_ALLOWED_IPS.trim() === "") {
    return next();
  }

  const allowedIPs = process.env.INTERNAL_ALLOWED_IPS.split(",").map((ip) => ip.trim());
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const hostname = req.hostname;

  // Разрешаем доступ от gateway (по имени контейнера) или из allowed IPs
  if (hostname === "gateway" || isIPAllowed(clientIP, allowedIPs)) {
    return next();
  }

  logger.warn("Unauthorized access attempt to notifier service", {
    ip: clientIP,
    hostname,
    path: req.path,
  });
  return res.status(403).json({ error: "Forbidden" });
});

app.use(express.json({ limit: "1mb" }));
app.use(metrics.httpMiddleware);

// Метрики
app.get("/metrics", metrics.metricsHandler);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "notifier",
    timestamp: new Date().toISOString(),
  });
});

// API для отправки уведомления
app.post("/notify", async (req, res) => {
  const { chatId, content, metadata } = req.body;

  if (!chatId || !content) {
    return res.status(400).json({
      error: "Missing required fields: chatId and content",
    });
  }

  try {
    logger.info("Sending notification", {
      chatId,
      contentLength: content.length,
      ruleName: metadata?.ruleName,
      issueKey: metadata?.issueKey,
    });

    await enqueueSend(() =>
      pachkaBreaker.exec(() => sendMessageWithRetry(chatId, content, null, 3, SEND_TIMEOUT_MS))
    );

    logger.info("Notification sent successfully", {
      chatId,
      ruleName: metadata?.ruleName,
    });

    res.status(200).json({
      status: "ok",
      chatId,
      messageId: "sent",
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const isRetryable =
      statusCode >= 500 || statusCode === 429 || error.isRetryable !== false;

    logger.error("Failed to send notification", {
      chatId,
      error: error.message,
      statusCode,
      isRetryable,
    });

    // Возвращаем ошибку с информацией о retryable
    res.status(isRetryable ? 503 : 400).json({
      status: "error",
      error: error.message,
      retryable: isRetryable,
    });
  }
});

// Приём алертов от Alertmanager
app.post("/alert", async (req, res) => {
  try {
    const alerts = req.body?.alerts || [];
    for (const alert of alerts) {
      if (!shouldSendAlert(alertCache, alert)) {
        logger.debug?.("Skip duplicate alert", { fingerprint: alert.fingerprint, status: alert.status });
        continue;
      }
      const content = formatAlertMessage(alert);
      await enqueueSend(() =>
        pachkaBreaker.exec(() => sendMessageWithRetry(ALERT_CHAT_ID, content, null, 3, SEND_TIMEOUT_MS))
      );
      metrics.recordForward("pachka", "alert_sent", undefined, "ok");
    }
    res.json({ status: "ok" });
  } catch (error) {
    metrics.recordForward("pachka", "alert_error", undefined, "error");
    logger.error("Failed to handle alert", { error: error.message });
    res.status(500).json({ status: "error", error: error.message });
  }
});

app.listen(PORT, () => {
  logger.info(`Notifier service started on port ${PORT}`);
});
