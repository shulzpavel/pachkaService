# Runbooks

## ServiceDown

Симптом: алерт `ServiceDown` на конкретный сервис.

Действия:
1) Проверить статус контейнера.
2) Посмотреть логи сервиса.
3) Проверить healthcheck и зависимости.

Команды:
```bash
docker compose ps
docker compose logs --tail=200 gateway
docker compose logs --tail=200 router
docker compose logs --tail=200 notifier
```

## Http404Detected (/jira/webhook)

Симптом: 404 на webhook.

Действия:
1) Проверить, что Jira шлёт на правильный URL.
2) Сравнить `method`/`path` в метриках.
3) Проверить rate‑limit/валидность payload.

Команды:
```bash
curl -G "http://localhost:9090/api/v1/query" \
  --data-urlencode 'query=rate(http_requests_total{status="404",path="/jira/webhook"}[5m])'
```

## GatewayQueueHigh / GatewayQueueOverflow

Симптом: рост очереди или overflow.

Действия:
1) Проверить нагрузку и лимиты `GATEWAY_CONCURRENCY/GATEWAY_MAX_QUEUE`.
2) Проверить доступность router/notifier.

Команды:
```bash
curl -s "http://localhost:3000/metrics" | grep gateway_queue
```

## BreakerOpen / BreakerHalfOpenTooLong

Симптом: circuit breaker открыт.

Действия:
1) Проверить доступность downstream.
2) Посмотреть ошибки в логах.

Команды:
```bash
curl -s "http://localhost:3000/metrics" | grep circuit_breaker_state
curl -s "http://localhost:3002/metrics" | grep circuit_breaker_state
```

## PachkaApiLatencyP95 / PachkaSendErrors

Симптом: задержки или ошибки при отправке в Пачку.

Действия:
1) Проверить сеть и лимиты Pachka.
2) Посмотреть логи notifier.

Команды:
```bash
docker compose logs --tail=200 notifier
```
