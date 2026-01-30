# Структура проекта

## Основные файлы

```
pachkaService/
├── docs/                  # Документация
│   ├── overview.md         # Общий обзор мониторинга
│   ├── prometheus.md       # Конфиг Prometheus и правила
│   ├── alertmanager.md     # Маршрутизация алертов
│   ├── notifier.md         # Обработка алертов в notifier
│   ├── grafana.md          # Дашборды и provisioning
│   ├── runbooks.md         # Типовые инциденты и действия
│   ├── DEPLOY.md          # Инструкция по деплою
│   ├── ALERTING.md        # Оглавление по мониторингу
│   ├── MICROSERVICES.md   # Архитектура микросервисов
│   ├── JIRA_SETUP.md      # Настройка Jira
│   ├── TEMPLATE_VARIABLES.md  # Переменные для шаблонов
│   ├── PRODUCTION_CHECKLIST.md # Чеклист перед деплоем
│   ├── SECURITY.md        # Безопасность
│   ├── TESTING.md         # Тестирование
│   ├── CHANGELOG.md       # История изменений
│   └── PROJECT_STRUCTURE.md # Структура проекта
├── services/              # Микросервисы
│   ├── gateway/           # Gateway сервис (порт 3000)
│   ├── router/            # Router сервис (порт 3001)
│   └── notifier/          # Notifier сервис (порт 3002)
├── shared/                # Общие модули
├── scripts/               # Операционные скрипты
├── tests/                 # Тесты
├── docker-compose.yml     # Docker Compose конфигурация
├── routes.json            # Правила маршрутизации
├── env.example            # Пример конфигурации
├── package.json           # Зависимости и скрипты
├── jest.config.js         # Конфигурация тестов
└── README.md              # Основная документация
```

## Документация

- `README.md` — Основная документация (в корне проекта)
- `docs/DEPLOY.md` — Инструкция по деплою
- `docs/MICROSERVICES.md` — Архитектура микросервисов
- `docs/ALERTING.md` — Оглавление по мониторингу
- `docs/JIRA_SETUP.md` — Настройка Jira
- `docs/overview.md` — Общий обзор мониторинга
- `docs/prometheus.md` — Конфигурация Prometheus
- `docs/alertmanager.md` — Конфигурация Alertmanager
- `docs/notifier.md` — Обработка алертов и формат сообщений
- `docs/grafana.md` — Дашборды и provisioning
- `docs/runbooks.md` — Типовые инциденты и действия
- `docs/TEMPLATE_VARIABLES.md` — Переменные для шаблонов
- `docs/PRODUCTION_CHECKLIST.md` — Чеклист перед деплоем
- `docs/SECURITY.md` — Безопасность
- `docs/TESTING.md` — Тестирование
- `docs/CHANGELOG.md` — История изменений

## Конфигурация

- `routes.json` — Правила маршрутизации (можно обновлять без перезапуска через `/reload`)
- `env.example` — Пример переменных окружения
- `.env` — Реальные переменные (не в Git)
