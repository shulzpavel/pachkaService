import express from "express";
import dotenv from "dotenv";
import logger from "../../shared/logger.js";
import { verifyApiKey, isIPAllowed } from "../../shared/security.js";
import { routeMessage, reloadRoutes, getRoutesConfig } from "./router.js";
import { createMetrics } from "../../shared/metrics.js";

dotenv.config();

const app = express();
const PORT = process.env.ROUTER_PORT || 3001;
const metrics = createMetrics("router");

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

  logger.warn("Unauthorized access attempt to router service", {
    ip: clientIP,
    hostname,
    path: req.path,
  });
  return res.status(403).json({ error: "Forbidden" });
});

// Требуем application/json для POST/PUT/PATCH
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method) && !req.is("application/json")) {
    return res.status(415).json({ error: "Unsupported content-type, expected application/json" });
  }
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(metrics.httpMiddleware);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "router",
    timestamp: new Date().toISOString(),
  });
});

// Метрики
app.get("/metrics", metrics.metricsHandler);

// Статус конфигурации
app.get("/status", (req, res) => {
  const config = getRoutesConfig();
  res.json({
    status: "ok",
    routesCount: config.rules?.length || 0,
    timestamp: new Date().toISOString(),
  });
});

// Перезагрузка конфигурации (защищена API ключом или отключена в проде)
app.post("/reload", (req, res) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;
  const expectedKey = process.env.ADMIN_API_KEY;

  // Если ADMIN_API_KEY не настроен, endpoint отключен в проде
  if (process.env.NODE_ENV === "production" && !expectedKey) {
    logger.warn("Reload endpoint disabled in production");
    return res.status(404).json({ error: "Not found" });
  }

  // Если ключ настроен, проверяем его
  if (expectedKey && !verifyApiKey(apiKey || "", expectedKey)) {
    logger.warn("Unauthorized reload attempt", {
      ip: req.ip,
      hasKey: !!apiKey,
    });
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    reloadRoutes();
    logger.info("Routes reloaded via API", { ip: req.ip });
    res.json({ status: "ok", message: "Routes reloaded" });
  } catch (error) {
    logger.error("Failed to reload routes", { error: error.message });
    res.status(500).json({ status: "error", error: error.message });
  }
});

// API для определения маршрута
app.post("/route", async (req, res) => {
  const payload = req.body;

  try {
    const route = routeMessage(payload);

    if (!route) {
      logger.sampled(0.05, "info", "No route matched", { issueKey: payload.issue?.key });
      return res.status(200).json({ route: null });
    }

    logger.sampled(0.05, "info", "Route matched", {
      rule: route.ruleName,
      chatId: route.chatId,
      issueKey: payload.issue?.key,
    });

    res.status(200).json({
      route: {
        chatId: route.chatId,
        content: route.content,
        ruleName: route.ruleName,
      },
    });
  } catch (error) {
    logger.error("Failed to route message", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: error.message });
  }
});

// Валидация конфигурации при старте
try {
  getRoutesConfig();
  logger.info("Routes configuration validated on startup");
} catch (error) {
  logger.error("Failed to load routes configuration on startup", {
    error: error.message,
    stack: error.stack,
  });
  logger.error("Router service will not start with invalid configuration");
  process.exit(1);
}

app.listen(PORT, () => {
  logger.info(`Router service started on port ${PORT}`);
});
