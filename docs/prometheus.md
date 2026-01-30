# Prometheus

## Конфигурация

- Файл: `monitoring/prometheus.yml`
- Правила: `monitoring/alert.rules.yml`
- Порт: `9090`

## Проверка конфигов

```bash
promtool check config monitoring/prometheus.yml
promtool check rules monitoring/alert.rules.yml
```

## Примеры запросов

### 404 на webhook
```bash
rate(http_requests_total{status="404",path="/jira/webhook"}[5m])
```

### Доля 4xx (кроме 404) по сервису
```bash
sum by (service) (rate(http_requests_total{status=~"4..",status!~"404"}[5m]))
  / sum by (service) (rate(http_requests_total[5m]))
```

### Очередь gateway
```bash
gateway_queue_length
```

### Circuit breaker состояние
```bash
gateway_circuit_breaker_state
notifier_circuit_breaker_state
```

## Что логировать в changelog

При изменении правил/порогов добавляй запись в `docs/CHANGELOG.md`:
- дата изменения
- что изменилось
- почему изменилось
