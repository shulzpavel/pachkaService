import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../../shared/logger.js";
import { validateRoutesSchema } from "../../shared/validate-routes-schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let routesConfig = null;

/**
 * Загружает конфигурацию роутинга из routes.json
 * @param {boolean} forceReload - Принудительная перезагрузка
 */
function loadRoutes(forceReload = false) {
  if (routesConfig && !forceReload) return routesConfig;
  
  routesConfig = null; // Сбрасываем кэш

  const configPath = path.join(__dirname, "../../routes.json");
  try {
    // Проверка существования файла
    if (!fs.existsSync(configPath)) {
      const error = `routes.json not found at ${configPath}`;
      logger.error("Routes configuration file not found", { path: configPath });
      throw new Error(error);
    }

    // Чтение файла
    let data;
    try {
      data = fs.readFileSync(configPath, "utf8");
    } catch (error) {
      logger.error("Failed to read routes.json", {
        path: configPath,
        error: error.message,
      });
      throw new Error(`Cannot read routes.json: ${error.message}`);
    }

    // Парсинг JSON
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch (error) {
      logger.error("Invalid JSON in routes.json", {
        path: configPath,
        error: error.message,
        line: error.line,
      });
      throw new Error(`Invalid JSON in routes.json: ${error.message}`);
    }

    // Строгая валидация схемы
    const validation = validateRoutesSchema(parsed);
    if (!validation.valid) {
      logger.error("Invalid routes.json schema", {
        error: validation.error,
        details: validation.details,
        path: configPath,
      });

      // Формируем понятное сообщение об ошибке
      let errorMessage = `Invalid routes.json schema: ${validation.error}`;
      if (validation.details && validation.details.length > 0) {
        errorMessage += "\nDetails:\n" + validation.details.map((d) => `  - ${d}`).join("\n");
      }

      throw new Error(errorMessage);
    }

    routesConfig = parsed;
    logger.info("Routes configuration loaded successfully", {
      rulesCount: routesConfig.rules?.length || 0,
      path: configPath,
    });
    return routesConfig;
  } catch (error) {
    // Если это уже наша ошибка с деталями, просто пробрасываем
    if (error.message.includes("Invalid routes.json") || error.message.includes("Cannot")) {
      throw error;
    }

    // Для других ошибок логируем и оборачиваем
    logger.error("Failed to load routes configuration", {
      error: error.message,
      stack: error.stack,
      path: configPath,
    });
    throw new Error(`Cannot load routes.json: ${error.message}`);
  }
}

/**
 * Подставляет значения из payload в шаблон
 * @param {string} template - Шаблон с плейсхолдерами {issue.key}, {issue.fields.summary} и т.д.
 * @param {Object} payload - Jira webhook payload
 * @returns {string}
 */
function renderTemplate(template, payload) {
  let result = template;

  // Рекурсивно извлекаем значения по пути (например, "issue.fields.summary")
  const getValue = (obj, path) => {
    return path.split(".").reduce((current, key) => {
      if (current && typeof current === "object") {
        return current[key];
      }
      return undefined;
    }, obj);
  };

  // Специальные функции для обработки данных
  const specialFunctions = {
    // Обработка массива labels - объединяет через запятую
    'labels': () => {
      const labels = payload.issue?.fields?.labels || [];
      return labels.length > 0 ? labels.join(', ') : 'нет тегов';
    },
    // Формирование URL задачи (нужно указать JIRA_BASE_URL в env или использовать дефолтный)
    'issue.url': () => {
      const issueKey = payload.issue?.key;
      if (!issueKey) return '';
      const jiraBase = process.env.JIRA_BASE_URL || 'https://media-life.atlassian.net';
      return `${jiraBase}/browse/${issueKey}`;
    },
  };

  // Заменяем все плейсхолдеры вида {path}
  result = result.replace(/\{([^}]+)\}/g, (match, path) => {
    // Проверяем специальные функции
    if (specialFunctions[path]) {
      return specialFunctions[path]();
    }
    
    // Обычное извлечение значения
    const value = getValue(payload, path);
    return value !== undefined && value !== null ? String(value) : match;
  });

  return result;
}

/**
 * Проверяет, соответствует ли payload условиям правила
 * @param {Object} rule - Правило из routes.json
 * @param {Object} payload - Jira webhook payload
 * @returns {boolean}
 */
function matchesRule(rule, payload) {
  const conditions = rule.conditions || {};

  // Проверка automationName (приоритетная - для маршрутизации по автоматизациям)
  if (conditions.automationName) {
    const automationName = payload.automationName;
    if (automationName !== conditions.automationName) {
      return false;
    }
  }

  // Проверка projectKey
  if (conditions.projectKey) {
    const projectKey = payload.issue?.fields?.project?.key;
    if (projectKey !== conditions.projectKey) {
      return false;
    }
  }

  // Проверка component (если нужно)
  if (conditions.component) {
    const components = payload.issue?.fields?.components || [];
    const hasComponent = components.some((c) => c.name === conditions.component);
    if (!hasComponent) {
      return false;
    }
  }

  // Проверка label (если нужно)
  if (conditions.label) {
    const labels = payload.issue?.fields?.labels || [];
    if (!labels.includes(conditions.label)) {
      return false;
    }
  }

  // Проверка boardId (если нужно)
  if (conditions.boardId) {
    const boardId =
      payload.board?.id ||
      payload.issue?.fields?.board?.id ||
      payload.changelog?.items?.find((item) => item.field === "board")?.toString ||
      payload.issue?.fields?.customfield_10020?.[0]?.boardId;
    
    if (!boardId || String(boardId) !== String(conditions.boardId)) {
      return false;
    }
  }

  // Проверка issueType (если нужно)
  if (conditions.issueType) {
    const issueType = payload.issue?.fields?.issuetype?.name;
    if (issueType !== conditions.issueType) {
      return false;
    }
  }

  return true;
}

/**
 * Находит подходящее правило для payload и возвращает chatId и текст сообщения
 * @param {Object} payload - Jira webhook payload
 * @returns {Object|null} { chatId, content } или null если не найдено
 */
export function routeMessage(payload) {
  const config = loadRoutes();
  const rules = config.rules || [];

  for (const rule of rules) {
    if (matchesRule(rule, payload)) {
      const content = renderTemplate(rule.template, payload);
      logger.info(`Route matched: ${rule.name}`, {
        ruleName: rule.name,
        chatId: rule.chatId,
        projectKey: payload.issue?.fields?.project?.key,
        automationName: payload.automationName,
      });
      return {
        chatId: rule.chatId,
        content: content,
        ruleName: rule.name,
      };
    }
  }

  // Если есть defaultChatId, используем его (безопасно - только минимальная информация)
  if (config.defaultChatId) {
    logger.info("Using default chat", { defaultChatId: config.defaultChatId });
    const issueKey = payload.issue?.key || "unknown";
    const summary = payload.issue?.fields?.summary || "No summary";
    const projectKey = payload.issue?.fields?.project?.key || "unknown";
    const status = payload.issue?.fields?.status?.name || "unknown";
    
    return {
      chatId: config.defaultChatId,
      content: `📋 Jira event (no route matched)\n\n*${issueKey}*: ${summary}\nProject: ${projectKey}\nStatus: ${status}`,
      ruleName: "default",
    };
  }

  logger.warn("No route matched for payload", {
    projectKey: payload.issue?.fields?.project?.key,
    issueKey: payload.issue?.key,
  });
  return null;
}

/**
 * Перезагружает конфигурацию роутинга
 */
export function reloadRoutes() {
  loadRoutes(true);
  logger.info("Routes configuration reloaded");
}

/**
 * Возвращает текущую конфигурацию роутинга
 */
export function getRoutesConfig() {
  return loadRoutes();
}
