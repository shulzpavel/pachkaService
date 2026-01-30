# Alertmanager

## Конфигурация

- Файл: `monitoring/alertmanager.yml`
- Порт: `9093`
- Ресивер: `pachka-notifier` → webhook `http://notifier:3002/alert`

## Важные параметры

- `group_by`: группировка алертов
- `group_wait`: задержка перед первой отправкой
- `group_interval`: интервал между повторными уведомлениями
- `repeat_interval`: интервал повторных отправок одного и того же алерта

## Проверка статуса

```bash
curl http://localhost:9093/api/v2/status
```

## Ручная отправка тестового алерта

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
