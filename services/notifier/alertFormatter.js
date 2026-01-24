/**
 * Форматирует дату ISO в вид dd.mm.yy HH:MM.
 * Возвращает "-" при недопустимой дате или при годе < 1970.
 * @param {string|null|undefined} iso
 */
export function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime()) || d.getFullYear() < 1970) return "-";
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Собирает текст алерта для отправки в Пачку.
 * @param {Object} alert Alertmanager alert object
 * @returns {string}
 */
export function formatAlertMessage(alert) {
  const sev = (alert.labels?.severity || "info").toLowerCase();
  const status = (alert.status || "firing").toLowerCase();
  const name = alert.labels?.alertname || "Alert";
  const summary = alert.annotations?.summary || name;
  const desc = alert.annotations?.description || "Без описания";
  const starts = alert.startsAt || null;
  const ends = alert.endsAt || null;
  const emoji = sev === "critical" ? "🟥" : sev === "warning" ? "🟧" : "🟦";
  const sevText = sev === "critical" ? "Критично" : sev === "warning" ? "Предупреждение" : "Инфо";
  const source = [alert.labels?.service, alert.labels?.instance || alert.labels?.pod || alert.labels?.host, alert.labels?.job]
    .filter(Boolean)
    .join(" / ");
  const labelsLine = Object.entries(alert.labels || {})
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  const statusText = status === "firing" ? "FIRING 🔥" : status === "resolved" ? "RESOLVED ✅" : status.toUpperCase();

  return [
    `${emoji} **Status:** **${statusText}** (${sevText})`,
    summary ? `**Событие:** ${summary}` : null,
    `**Alert:** ${name}`,
    `**Причина:** ${desc}`,
    source ? `**Источник:** ${source}` : null,
    labelsLine ? `**Метки:** ${labelsLine}` : null,
    `**Начало:** ${formatDate(starts)}`,
    ends ? `**Окончание:** ${formatDate(ends)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
