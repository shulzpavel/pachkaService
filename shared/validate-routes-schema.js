/**
 * Валидирует схему routes.json
 * Строгая валидация для production
 * @param {Object} config - Конфигурация из routes.json
 * @returns {{ valid: boolean, error?: string, details?: string[] }}
 */
export function validateRoutesSchema(config) {
  const errors = [];

  // Проверка корневого объекта
  if (!config || typeof config !== "object") {
    return {
      valid: false,
      error: "Config must be an object",
      details: ["Root config is not an object"],
    };
  }

  // Проверяем наличие rules
  if (!Array.isArray(config.rules)) {
    return {
      valid: false,
      error: "Config must have 'rules' array",
      details: ["'rules' field is missing or not an array"],
    };
  }

  if (config.rules.length === 0) {
    errors.push("'rules' array is empty - at least one rule is required");
  }

  // Валидируем каждое правило
  for (let i = 0; i < config.rules.length; i++) {
    const rule = config.rules[i];
    const ruleIndex = i + 1;
    const rulePrefix = `Rule ${ruleIndex}`;

    if (!rule || typeof rule !== "object") {
      errors.push(`${rulePrefix}: must be an object`);
      continue;
    }

    // Проверка name
    if (!rule.name) {
      errors.push(`${rulePrefix}: missing required field 'name'`);
    } else if (typeof rule.name !== "string") {
      errors.push(`${rulePrefix}: 'name' must be a string (got ${typeof rule.name})`);
    } else if (rule.name.trim().length === 0) {
      errors.push(`${rulePrefix}: 'name' cannot be empty`);
    }

    // Проверка conditions
    if (!rule.conditions) {
      errors.push(`${rulePrefix}: missing required field 'conditions'`);
    } else if (typeof rule.conditions !== "object" || Array.isArray(rule.conditions)) {
      errors.push(`${rulePrefix}: 'conditions' must be an object (got ${Array.isArray(rule.conditions) ? "array" : typeof rule.conditions})`);
    } else {
      // Проверяем что conditions не пустой
      const conditionKeys = Object.keys(rule.conditions);
      if (conditionKeys.length === 0) {
        errors.push(`${rulePrefix}: 'conditions' object is empty - at least one condition is required`);
      }

      // Валидация типов условий
      const validConditions = [
        "automationName",
        "projectKey",
        "component",
        "label",
        "boardId",
        "issueType",
      ];
      for (const key of conditionKeys) {
        if (!validConditions.includes(key)) {
          errors.push(`${rulePrefix}: unknown condition '${key}' (valid: ${validConditions.join(", ")})`);
        } else {
          const value = rule.conditions[key];
          if (value === null || value === undefined) {
            errors.push(`${rulePrefix}: condition '${key}' cannot be null or undefined`);
          } else if (typeof value !== "string" && typeof value !== "number") {
            errors.push(`${rulePrefix}: condition '${key}' must be string or number (got ${typeof value})`);
          }
        }
      }
    }

    // Проверка chatId
    if (!rule.chatId) {
      errors.push(`${rulePrefix}: missing required field 'chatId'`);
    } else if (typeof rule.chatId !== "string" && typeof rule.chatId !== "number") {
      errors.push(`${rulePrefix}: 'chatId' must be string or number (got ${typeof rule.chatId})`);
    } else {
      const chatIdStr = String(rule.chatId);
      if (chatIdStr.trim().length === 0) {
        errors.push(`${rulePrefix}: 'chatId' cannot be empty`);
      }
    }

    // Проверка template
    if (!rule.template) {
      errors.push(`${rulePrefix}: missing required field 'template'`);
    } else if (typeof rule.template !== "string") {
      errors.push(`${rulePrefix}: 'template' must be a string (got ${typeof rule.template})`);
    } else if (rule.template.trim().length === 0) {
      errors.push(`${rulePrefix}: 'template' cannot be empty`);
    }
  }

  // Проверяем defaultChatId (опционально)
  if (config.defaultChatId !== undefined && config.defaultChatId !== null) {
    if (typeof config.defaultChatId !== "string" && typeof config.defaultChatId !== "number") {
      errors.push("defaultChatId must be string or number");
    } else {
      const defaultChatIdStr = String(config.defaultChatId);
      if (defaultChatIdStr.trim().length === 0) {
        errors.push("defaultChatId cannot be empty");
      }
    }
  }

  // Проверка на неизвестные поля в корне
  const validRootFields = ["rules", "defaultChatId"];
  const rootKeys = Object.keys(config);
  for (const key of rootKeys) {
    if (!validRootFields.includes(key)) {
      errors.push(`Unknown root field '${key}' (valid: ${validRootFields.join(", ")})`);
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      error: `Validation failed: ${errors.length} error(s) found`,
      details: errors,
    };
  }

  return { valid: true };
}
