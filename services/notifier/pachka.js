import logger from "../../shared/logger.js";
import { createMetrics } from "../../shared/metrics.js";
import { fetchWithTimeout } from "../../shared/fetch-with-timeout.js";

const PACHKA_API_BASE = process.env.PACHKA_API_BASE || "https://api.pachca.com/api/shared/v1";
const PACHKA_TOKEN = process.env.PACHKA_TOKEN;
const metrics = createMetrics("notifier"); // отдельный регистр для отправок

if (!PACHKA_TOKEN) {
  throw new Error("PACHKA_TOKEN is required in environment variables");
}

/**
 * Отправляет сообщение в чат Пачки
 * @param {string} chatId - ID чата (discussion)
 * @param {string} content - Текст сообщения
 * @param {Array} files - Массив файлов (опционально)
 * @returns {Promise<Object>} Ответ API
 */
export async function sendMessage(chatId, content, files = null, timeoutMs = 10000) {
  // Правильный endpoint для отправки сообщений
  const url = `${PACHKA_API_BASE}/messages`;

  // entity_id должен быть числом, не строкой
  let entityId;
  if (typeof chatId === 'string') {
    entityId = parseInt(chatId, 10);
  } else if (typeof chatId === 'number') {
    entityId = chatId;
  } else {
    throw new Error(`Invalid chatId type: ${typeof chatId} (expected string or number)`);
  }
  
  if (isNaN(entityId) || entityId <= 0) {
    throw new Error(`Invalid chatId: ${chatId} (must be a positive number, got: ${entityId})`);
  }

  // Создаем body в правильном формате для Pachka API
  // Правильный формат: { "message": { "entity_id": number, "content": string } }
  const body = {
    message: {
      entity_id: entityId, // Число, не строка
      content: String(content), // Текст сообщения
    },
  };

  // Дополнительная проверка перед отправкой
  if (!body.message.entity_id || isNaN(body.message.entity_id) || body.message.entity_id <= 0) {
    throw new Error(`entity_id is invalid: ${body.message.entity_id} (from chatId: ${chatId}, entityId: ${entityId})`);
  }

  // Логируем для отладки
  logger.debug(`Prepared body: entity_id=${body.message.entity_id} (type: ${typeof body.message.entity_id})`);

  // Файлы добавляются в message объект (если поддерживается API)
  if (files && files.length > 0) {
    body.message.files = files;
  }

  try {
    logger.sampled(0.05, "info", `Sending message to chat ${chatId}`, { 
      chatId, 
      entityId,
      contentLength: content.length,
      url,
      apiBase: PACHKA_API_BASE,
      hasToken: !!PACHKA_TOKEN,
      tokenLength: PACHKA_TOKEN?.length || 0,
    });

    const bodyString = JSON.stringify(body);

    // Проверяем что entity_id валидный перед отправкой
    if (!body.message.entity_id || isNaN(body.message.entity_id) || body.message.entity_id <= 0) {
      throw new Error(`Invalid entity_id in body: ${body.message.entity_id} (type: ${typeof body.message.entity_id})`);
    }

    const started = Date.now();
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PACHKA_TOKEN}`,
      },
      body: bodyString,
    }, timeoutMs);
    metrics.recordForward("pachka", response.status, (Date.now() - started) / 1000);

    if (!response.ok) {
      const errorText = await response.text();
      const statusCode = response.status;
      
      // Логируем детали для отладки
      logger.error(`Pachka API error: ${statusCode} ${response.statusText}`, {
        status: statusCode,
        statusText: response.statusText,
        error: errorText,
        chatId,
        url,
        requestBody: body,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PACHKA_TOKEN?.substring(0, 10)}...`,
        },
        isRetryable: statusCode >= 500 || statusCode === 429,
      });
      
      const error = new Error(`Pachka API error: ${statusCode} - ${errorText}`);
      error.statusCode = statusCode;
      error.isRetryable = statusCode >= 500 || statusCode === 429;
      
      throw error;
    }

    const data = await response.json();
    logger.info(`Message sent successfully to chat ${chatId}`, { chatId, messageId: data.id });
    return data;
  } catch (error) {
    metrics.recordForward("pachka", "error");
    logger.error(`Failed to send message to chat ${chatId}`, {
      chatId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Retry отправки с экспоненциальной задержкой и джиттером
 * НЕ ретраирует 4xx ошибки (авторизация, валидация и т.д.)
 * @param {string} chatId
 * @param {string} content
 * @param {Array} files
 * @param {number} maxRetries
 * @returns {Promise<Object>}
 */
export async function sendMessageWithRetry(chatId, content, files = null, maxRetries = 3, timeoutMs = 10000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendMessage(chatId, content, files, timeoutMs);
    } catch (error) {
      lastError = error;
      
      // Не ретраируем 4xx ошибки (400, 401, 403, 404 и т.д.)
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        logger.warn(`Non-retryable error (4xx), stopping retries`, {
          chatId,
          statusCode: error.statusCode,
          error: error.message,
        });
        throw error;
      }
      
      // Ретраируем только 5xx и сетевые ошибки
      if (attempt < maxRetries && error.isRetryable !== false) {
        // Экспоненциальная задержка с джиттером
        const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // max 10s
        const jitter = Math.random() * 0.3 * baseDelay; // до 30% джиттера
        const delay = Math.floor(baseDelay + jitter);
        
        logger.warn(`Retry ${attempt}/${maxRetries} after ${delay}ms`, {
          chatId,
          error: error.message,
          statusCode: error.statusCode,
        });
        
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
