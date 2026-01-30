# Monitoring Overview

## Цепочка доставки

Цепочка: `metrics` → `Prometheus` → `Alertmanager` → `notifier` → `Пачка`.

1) Сервисы экспонируют `/metrics`.
2) Prometheus собирает метрики и вычисляет правила.
3) Alertmanager группирует/дебаунсит алерты.
4) notifier принимает `/alert` и отправляет сообщение в Пачку.

## Порты

- gateway: `3000` (наружу)
- router: `3001` (внутренняя сеть)
- notifier: `3002` (внутренняя сеть)
- Prometheus: `9090`
- Alertmanager: `9093`
- Grafana: `3003` (внутри контейнера `3000`)

## Жизненный цикл алерта

1) **Pending**: правило стало true, но выдерживается `for` (обычно 1–2 минуты).
2) **Firing**: после `for` алерт отправляется в Alertmanager.
3) **Grouping**: Alertmanager ждёт `group_wait`, затем шлёт нотификации.
4) **Resolved**: когда правило стало false и выдержался `for`, отправляется RESOLVED.

## Тестовые команды

### Быстрый smoke‑тест доставки
```bash
./scripts/check-notifications.sh
```
Ожидается 4 FIRING и 4 RESOLVED сообщения.

### Ручной тест через Alertmanager
```bash
cat >/tmp/test_alert.json <<'EOF'
[{
  "labels": { "alertname": "FormatCheck", "severity": "warning", "service": "prom-test" },
  "annotations": { "summary": "Проверка формата", "description": "Ожидаемый текст" }
}]
EOF
curl -XPOST -H 'Content-Type: application/json' \
  --data @/tmp/test_alert.json \
  http://localhost:9093/api/v2/alerts
```

### Проверка активных алертов
```bash
curl -s http://localhost:9090/api/v1/alerts
curl -s http://localhost:9093/api/v2/alerts
```
