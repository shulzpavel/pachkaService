import express from "express";
import dotenv from "dotenv";
import logger from "../../shared/logger.js";
import { isIPAllowed } from "../../shared/security.js";
import { sendMessage, sendMessageWithRetry } from "./pachka.js";

dotenv.config();

const app = express();
const PORT = process.env.NOTIFIER_PORT || 3002;

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

app.listen(PORT, () => {
  logger.info(`Notifier service started on port ${PORT}`);
});
