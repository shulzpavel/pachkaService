# Grafana

## Provisioning

- Datasource: `monitoring/grafana/datasources`
- Dashboards: `monitoring/grafana/dashboards`
- JSON дашбордов: `monitoring/grafana/dashboards/json`

## Базовый дашборд

- UID: `pachka-overview`
- Файл: `monitoring/grafana/dashboards/json/pachka-overview.json`

## Важно

- Админ‑пароль задаётся через `GRAFANA_ADMIN_PASSWORD` в `.env`.
- Для сохранения настроек нужен volume `grafana-data`.
