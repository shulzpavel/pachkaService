import crypto from "crypto";
import logger from "./logger.js";

/**
 * Проверяет HMAC подпись Jira webhook
 * @param {string} payload - Тело запроса (JSON строка)
 * @param {string} signature - Подпись из заголовка
 * @param {string} secret - Секретный ключ
 * @returns {boolean}
 */
export function verifyJiraWebhookSignature(payload, signature, secret) {
  if (!secret || !signature) {
    return false;
  }

  try {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");
    const providedBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    // Сравниваем с постоянным временем для защиты от timing attacks
    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  } catch (error) {
    logger.error("Error verifying webhook signature", { error: error.message });
    return false;
  }
}

/**
 * Проверяет API ключ для административных endpoints
 * @param {string} providedKey - Ключ из запроса
 * @param {string} expectedKey - Ожидаемый ключ из env
 * @returns {boolean}
 */
export function verifyApiKey(providedKey, expectedKey) {
  if (!expectedKey || !providedKey) {
    return false;
  }
  
  // Сравниваем с постоянным временем
  const providedBuffer = Buffer.from(providedKey);
  const expectedBuffer = Buffer.from(expectedKey);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    providedBuffer,
    expectedBuffer
  );
}

/**
 * Преобразует IP адрес в число для сравнения
 * @param {string} ip - IPv4 адрес
 * @returns {number}
 */
function ipToNumber(ip) {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Проверяет, находится ли IP в CIDR подсети
 * @param {string} ip - IP адрес
 * @param {string} cidr - CIDR нотация (например, "192.168.1.0/24")
 * @returns {boolean}
 */
function isIPInCIDR(ip, cidr) {
  const [network, prefixLength] = cidr.split("/");
  const prefix = parseInt(prefixLength, 10);

  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(network);
  const mask = (0xffffffff << (32 - prefix)) >>> 0;

  return (ipNum & mask) === (networkNum & mask);
}

/**
 * Проверяет IP адрес против allowlist
 * @param {string} ip - IP адрес клиента
 * @param {string[]} allowedIPs - Массив разрешенных IP/подсетей (CIDR)
 * @returns {boolean}
 */
/**
 * Проверяет IP адрес против allowlist
 * @param {string} ip - IP адрес клиента
 * @param {string[]} allowedIPs - Массив разрешенных IP/подсетей (CIDR) или имен хостов
 * @returns {boolean}
 */
export function isIPAllowed(ip, allowedIPs) {
  if (!allowedIPs || allowedIPs.length === 0) {
    return true; // Если список пуст, разрешаем все
  }

  if (!ip) {
    return false;
  }

  // Проверяем каждое правило
  return allowedIPs.some((allowed) => {
    // Точное совпадение IP или имени хоста
    if (allowed === ip || allowed.toLowerCase() === ip.toLowerCase()) {
      return true;
    }

    // CIDR нотация (только для IPv4)
    if (allowed.includes("/")) {
      // Проверяем что это валидный IPv4 перед проверкой CIDR
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipv4Regex.test(ip)) {
        return isIPInCIDR(ip, allowed);
      }
      return false;
    }

    return false;
  });
}
