import logger from "./logger.js";

/**
 * Валидирует структуру Jira webhook payload
 * @param {Object} payload - Входящий payload
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateJiraPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Payload must be an object" };
  }

  // Минимальная валидация: должен быть либо issue, либо automationName
  if (!payload.issue && !payload.automationName) {
    return {
      valid: false,
      error: "Payload must contain either 'issue' or 'automationName'",
    };
  }

  // Если есть issue, проверяем базовую структуру
  if (payload.issue) {
    if (typeof payload.issue !== "object") {
      return { valid: false, error: "Issue must be an object" };
    }

    // Проверяем наличие ключевых полей
    if (!payload.issue.key && !payload.issue.fields) {
      logger.warn("Issue missing key and fields", {
        hasKey: !!payload.issue.key,
        hasFields: !!payload.issue.fields,
      });
    }
  }

  // Валидация automationName (если есть)
  if (payload.automationName && typeof payload.automationName !== "string") {
    return { valid: false, error: "automationName must be a string" };
  }

  // Валидация user (если есть)
  if (payload.user && typeof payload.user !== "object") {
    return { valid: false, error: "User must be an object" };
  }

  return { valid: true };
}

/**
 * Логирует структурированную информацию о payload для отладки
 * (без чувствительных данных)
 * @param {Object} payload
 */
export function logPayloadStructure(payload) {
  const structure = {
    hasIssue: !!payload.issue,
    hasUser: !!payload.user,
    hasAutomationName: !!payload.automationName,
    webhookEvent: payload.webhookEvent,
    issueKey: payload.issue?.key,
    projectKey: payload.issue?.fields?.project?.key,
    issueType: payload.issue?.fields?.issuetype?.name,
    status: payload.issue?.fields?.status?.name,
  };

  logger.debug("Payload structure", structure);
}
