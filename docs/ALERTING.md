# Alerting & Monitoring

Этот документ описывает, как устроены метрики и алерты в проекте, какие файлы конфигурации задействованы, как проверять доставку уведомлений и что делать при обновлениях.

## Архитектура

- **Поставщики метрик**: gateway (порт 3000), router (3001), notifier (3002) — каждый экспонирует `/metrics`.
- **Сборщик**: Prometheus (`prom/prometheus`, порт 9090). Конфиг: `monitoring/prometheus.yml`, правила: `monitoring/alert.rules.yml`.
- **Алёрт-роутинг**: Alertmanager (`prom/alertmanager`, порт 9093). Конфиг: `monitoring/alertmanager.yml`. Отправляет webhooks в notifier.
- **Доставка**: notifier (`services/notifier/index.js`) принимает `/alert` от Alertmanager, форматирует сообщение и шлёт в Пачку (чат `ALERT_CHAT_ID`, дефолт 33378985).
- **Визуализация**: Grafana (`grafana/grafana`, порт 3003), datasource Prometheus. Дашборды должны храниться в репо через provisioning (см. раздел «Персистентность»).

Цепочка: метрики → Prometheus → Alertmanager → notifier → Пачка.

## Ключевые файлы

- `monitoring/prometheus.yml` — таргеты, правила, alertmanagers.
- `monitoring/alert.rules.yml` — алерты (ServiceDown, 5xx/latency, Http404Detected, Router/Notifier forward errors, Pachka send errors).
- `monitoring/alertmanager.yml` — доставка в notifier (webhook `http://notifier:3002/alert`), параметры группировки/повторов.
- `services/notifier/index.js` — приём `/alert`, форматирование сообщений, отправка в чат.

## Важные параметры

- `ALERT_CHAT_ID` — чат для алертов (в `.env`, дефолт 33378985).
- `NOTIFIER_CONCURRENCY` / `NOTIFIER_MAX_QUEUE` / `NOTIFIER_TIMEOUT_MS` — параллельные отправки, лимит очереди, тайм-аут запроса в Пачку (по умолчанию 5 / 500 / 10000 мс).
- `GATEWAY_CONCURRENCY` / `GATEWAY_MAX_QUEUE` — ограничение одновременных форвардов и глубины очереди в gateway (по умолчанию 10 / 200).
- `BREAKER_FAIL_THRESHOLD` / `BREAKER_COOLDOWN_MS` — порог срабатывания circuit breaker и его “остывание” (по умолчанию 5 ошибок, 30s).
- В Alertmanager: `group_wait`, `group_interval`, `repeat_interval` (см. `monitoring/alertmanager.yml`) — определяют задержку fire/resolve.
- В правилах: `for: 1m` (в `monitoring/alert.rules.yml`) — алерт сработает/резолвнется после стабильного состояния 1 минуту.

## Provisioning Grafana

- Datasource и dashboards провижнятся из `monitoring/grafana/datasources` и `monitoring/grafana/dashboards`.
- Дашборды кладём в JSON в `monitoring/grafana/dashboards/json`, описание провижнинга — `dashboards.yml`.
- Обязательно держать volume `grafana-data` для сохранения настроек/снапшотов.
- Базовый дашборд `pachka-overview` включает: up, p95 latency, статус-коды, p95 forward по target/result, длину очереди notifier.

## Производительность и устойчивость
- Gateway и notifier используют очереди с ограничением параллельных запросов (env см. выше); при переполнении очередь отклоняет задачи.
- Circuit breaker защищает вызовы router/notifier и Pachka API; состояние сбрасывается через `BREAKER_COOLDOWN_MS`.
- Rate-limit: gateway (IP + глобальный), router (200 rps/min), Content-Type guard обязательный.
- Метрики forward включают `result=ok|error`, buckets до 30s; Gauge `notifier_queue_length`.
- Лог-сэмплинг: шумные события пишем через `logger.sampled()`.
- Новые алерты: BreakerOpen (если breaker открыт), NotifierQueueHigh (>200 в очереди), Http404Detected (любой 404 с указанием service/method/path).

## Формат сообщений в Пачке

Пример (FIRING):
```
🟥 **Status:** **FIRING 🔥** (Критично)
**Событие:** Сервис router:3001 недоступен >1м
**Alert:** ServiceDown
**Причина:** Контейнер router:3001 не отвечает более 1 минуты. Пользователи не получают ответы. Проверь логи контейнера и healthcheck, перезапусти сервис.
**Источник:** pachka-services / router:3001 / pachka-services
**Метки:** alertname=ServiceDown, instance=router:3001, job=pachka-services, service=pachka-services, severity=critical
**Начало:** 23.01.26 18:17
**Окончание:** 23.01.26 18:19   (только для RESOLVED)
```
Дата форматируется как `dd.mm.yy HH:MM`; если endsAt отсутствует/некорректна — поле не выводится.

### Защита от дублей

`notifier` хранит в памяти fingerprint алерта (из Alertmanager, либо sha1 от labels) и статус/время. Если приходит тот же статус с теми же `startsAt/endsAt`, повтор не отправляется. Новый статус (например, RESOLVED) отправляется всегда.

## Как проверить доставку

1) На сервере отправить тестовый алерт в Alertmanager v2:
```bash
cat >/tmp/test_alert.json <<'EOF'
[{
  "labels": { "alertname": "FormatCheck", "severity": "warning", "service": "prom-test" },
  "annotations": { "summary": "Проверка формата", "description": "Ожидаемый текст без костылей" }
}]
EOF
curl -XPOST -H 'Content-Type: application/json' \
  --data @/tmp/test_alert.json \
  http://localhost:9093/api/v2/alerts
```
2) Проверить логи notifier:
```bash
/usr/bin/docker-compose logs --tail=40 notifier | grep -A5 "Request body"
```
3) Убедиться, что сообщение пришло в чат `ALERT_CHAT_ID`.

## Как протестировать боевой алерт (ServiceDown)

```bash
/usr/bin/docker-compose stop router      # дождаться ~1–2 минуты → FIRING
/usr/bin/docker-compose start router     # ещё ~1 минута → RESOLVED
```
Смотреть активные алерты:
```bash
curl -s http://localhost:9090/api/v1/alerts          # Prometheus view
curl -s http://localhost:9093/api/v2/alerts          # Alertmanager view
```

## Персистентность и отсутствие потерь

Чтобы дашборды/данные не терялись при пересборке:
- Прометеус: монтировать volume на `/prometheus`.
- Графана: монтировать `/var/lib/grafana` + включить provisioning дашбордов (JSON в репо, `dashboards.yml`).
- Alertmanager (если важны silences): монтировать `/alertmanager`.
- Конфиги (prometheus.yml, alert.rules.yml, alertmanager.yml) — монтировать read-only из репо (уже сделано).

Пример volumes для docker-compose:
```
prometheus:
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    - ./monitoring/alert.rules.yml:/etc/prometheus/alert.rules.yml:ro
    - prometheus-data:/prometheus

grafana:
  volumes:
    - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources:ro
    - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
    - grafana-data:/var/lib/grafana

alertmanager:
  volumes:
    - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
    - alertmanager-data:/alertmanager
```

## Обновления без даунтайма

- Пересборка отдельных сервисов: `docker-compose up -d --no-deps --build gateway` (аналогично router/notifier) — метрики/алерты не прерываются.
- Не пересобирать Prometheus/Grafana, если конфиг не менялся.
- Перед рестартом Prometheus/Alertmanager: `promtool check config/rules` (при необходимости), затем `docker-compose restart prometheus alertmanager`.
- Compose v2 (`docker compose`) предпочтительнее 1.29 для избежания багов с `ContainerConfig`.

## Частые вопросы

- **Почему RESOLVED пришёл позже?** Сумма `for` (1m) + `group_wait` + `group_interval` в Alertmanager. Сейчас при `group_interval: 1m` резолв прилетает ~1–2 мин после восстановления.
- **Можно ли быстрее?** Уменьшить `group_wait` и `group_interval` в `monitoring/alertmanager.yml`, но возможен шум при флаппинге.
- **ContainerConfig ошибки при up**: очистить старые контейнеры/образы `docker rm -f $(docker ps -aq --filter name=jira-pachka)` и `docker rmi -f $(docker images -q "pachkaservice_*")`, затем `docker-compose up -d --build`.
