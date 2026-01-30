# Notifier

## Роль

Принимает алерты от Alertmanager и отправляет сообщения в Пачку.

## Эндпоинты

- `POST /alert` — алерты от Alertmanager
- `POST /notify` — ручная отправка уведомления (internal)
- `GET /metrics` — метрики
- `GET /health` — healthcheck

## Важные параметры

- `ALERT_CHAT_ID` — чат для алертов
- `NOTIFIER_CONCURRENCY` — параллельные отправки
- `NOTIFIER_MAX_QUEUE` — лимит очереди
- `NOTIFIER_TIMEOUT_MS` — таймаут отправки
- `BREAKER_FAIL_THRESHOLD` / `BREAKER_COOLDOWN_MS` — circuit breaker

## Защита от дублей

Notifier хранит fingerprint алерта (из Alertmanager или sha1 от labels).
Если статус и `startsAt/endsAt` не изменились, повтор не отправляется.

## Формат сообщений

Сообщение формируется в `services/notifier/alertFormatter.js`.
Дата выводится в формате `dd.mm.yy HH:MM` (Europe/Moscow).
