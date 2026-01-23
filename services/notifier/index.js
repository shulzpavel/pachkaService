import express from "express";
import dotenv from "dotenv";
import logger from "../../shared/logger.js";
import { isIPAllowed } from "../../shared/security.js";
import { sendMessageWithRetry } from "./pachka.js";
import { createMetrics } from "../../shared/metrics.js";

dotenv.config();

const app = express();
const PORT = process.env.NOTIFIER_PORT || 3002;
const ALERT_CHAT_ID = process.env.ALERT_CHAT_ID || "33378985";
const metrics = createMetrics("notifier");

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

    await sendMessageWithRetry(chatId, content);

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
      const sev = (alert.labels?.severity || "info").toLowerCase();
      const name = alert.labels?.alertname || "Alert";
      const summary = alert.annotations?.summary || name;
      const desc = alert.annotations?.description || "Без описания";
      const emoji = sev === "critical" ? "🟥" : sev === "warning" ? "🟧" : "🟦";
      const sevText = sev === "critical" ? "Критично" : sev === "warning" ? "Предупреждение" : "Инфо";
      const source = [alert.labels?.service, alert.labels?.instance, alert.labels?.job]
        .filter(Boolean)
        .join(" / ");
      const content = `${emoji} ${summary} (${sevText})\n${desc}${source ? `\nИсточник: ${source}` : ""}`;
      await sendMessageWithRetry(ALERT_CHAT_ID, content);
      metrics.recordForward("pachka", "alert_sent");
    }
    res.json({ status: "ok" });
  } catch (error) {
    metrics.recordForward("pachka", "alert_error");
    logger.error("Failed to handle alert", { error: error.message });
    res.status(500).json({ status: "error", error: error.message });
  }
});

app.listen(PORT, () => {
  logger.info(`Notifier service started on port ${PORT}`);
});
