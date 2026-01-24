import crypto from "crypto";

/**
 * Вычисляет fingerprint алерта. Alertmanager присылает готовый fingerprint,
 * но на всякий случай считаем сами из labels, если его нет.
 */
export function getFingerprint(alert) {
  if (alert.fingerprint) return alert.fingerprint;
  const labels = alert.labels || {};
  const sorted = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`)
    .join("|");
  return crypto.createHash("sha1").update(sorted).digest("hex");
}

/**
 * Решает, нужно ли отправлять алерт (избегаем дублей одного статуса).
 * Если статус или время начала/окончания изменились — отправляем и обновляем кеш.
 */
export function shouldSendAlert(cache, alert, maxSize = 2000) {
  const key = getFingerprint(alert);
  const status = (alert.status || "firing").toLowerCase();
  const startsAt = alert.startsAt || "";
  const endsAt = alert.endsAt || "";

  const prev = cache.get(key);
  const duplicate =
    prev && prev.status === status && prev.startsAt === startsAt && prev.endsAt === endsAt;

  if (duplicate) return false;

  cache.set(key, { status, startsAt, endsAt });
  if (cache.size > maxSize) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  return true;
}
