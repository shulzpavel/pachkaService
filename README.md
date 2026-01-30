# Jira → Pachka Router

Микросервисная система для автоматизации уведомлений из Jira в Пачку с маршрутизацией в разные чаты. **Один бот, разные чаты** через API Пачки.

## 🏗️ Архитектура

Проект состоит из трёх микросервисов:
- **Gateway** (порт 3000) - валидация, аутентификация, единая точка входа
- **Router** (порт 3001) - маршрутизация по правилам из `routes.json`
- **Notifier** (порт 3002) - отправка уведомлений в Пачку через API

Подробнее: [MICROSERVICES.md](./docs/MICROSERVICES.md)

## 🚀 Быстрый старт

```bash
# 1. Настрой окружение
cp env.example .env
# Отредактируй .env, заполни все переменные

# 2. Запуск всех микросервисов
docker compose up -d

# 3. Просмотр логов
docker compose logs -f

# 4. Проверка
curl http://localhost:3000/health
```

Подробнее: [DEPLOY.md](./docs/DEPLOY.md)

## 📋 Основные возможности

- ✅ Маршрутизация по проекту, типу задачи, тегам, автоматизациям
- ✅ Гибкие шаблоны сообщений с переменными
- ✅ Поддержка тегов и ссылок на задачи
- ✅ Безопасность: IP allowlist, HMAC подпись (опционально)
- ✅ Retry механизм для надежной доставки
- ✅ Health checks и мониторинг

## 📝 Конфигурация

### routes.json

Определяет правила маршрутизации:

```json
{
  "rules": [
    {
      "name": "FLEX Bug Created",
      "conditions": {
        "projectKey": "FLEX",
        "issueType": "Bug"
      },
      "chatId": "33379012",
      "template": "🎉 Создана задача с типом {issue.fields.issuetype.name}\n\nТеги: {labels}\nНазвание: {issue.fields.summary}\n📎Link: {issue.url}"
    }
  ]
}
```

Доступные переменные для шаблонов: [TEMPLATE_VARIABLES.md](./docs/TEMPLATE_VARIABLES.md)

### env.example

Пример конфигурации окружения. Скопируй в `.env` и заполни:

- `PACHKA_TOKEN` - токен бота (обязательно)
- `PACHKA_BOT_USER_ID` - ID бота (обязательно)
- `JIRA_BASE_URL` - базовый URL Jira для ссылок
- `JIRA_WEBHOOK_SECRET` - секрет для HMAC (опционально)
- `JIRA_ALLOWED_IPS` - IP allowlist для Jira (опционально)

## 🔧 Настройка Jira

1. **Jira → Project Settings → Automation**
2. **Create rule:**
   - Trigger: Issue created / Issue updated
   - Action: Send web request
3. **Web request:**
   ```
   Method: POST
   URL: http://your-server:3000/jira/webhook
   Headers:
     Content-Type: application/json
     X-Atlassian-Token: no-check
   Body:
   {
     "webhookEvent": "{{webhookEvent}}",
     "issue": {{issue}},
     "user": {{initiator}}
   }
   ```

Подробнее: [JIRA_SETUP.md](./docs/JIRA_SETUP.md)

## 📚 Документация

- [DEPLOY.md](./docs/DEPLOY.md) — Инструкция по деплою на сервер
- [MICROSERVICES.md](./docs/MICROSERVICES.md) — Архитектура микросервисов
- [overview.md](./docs/overview.md) — Обзор мониторинга и алертинга
- [prometheus.md](./docs/prometheus.md) — Конфиг Prometheus и правила
- [alertmanager.md](./docs/alertmanager.md) — Маршрутизация алертов
- [notifier.md](./docs/notifier.md) — Обработка алертов
- [grafana.md](./docs/grafana.md) — Дашборды и provisioning
- [runbooks.md](./docs/runbooks.md) — Типовые инциденты
- [JIRA_SETUP.md](./docs/JIRA_SETUP.md) — Настройка автоматизации в Jira
- [TEMPLATE_VARIABLES.md](./docs/TEMPLATE_VARIABLES.md) — Переменные для шаблонов
- [PRODUCTION_CHECKLIST.md](./docs/PRODUCTION_CHECKLIST.md) — Чеклист перед деплоем
- [SECURITY.md](./docs/SECURITY.md) — Безопасность
- [TESTING.md](./docs/TESTING.md) — Тестирование
- [CHANGELOG.md](./docs/CHANGELOG.md) — История изменений

## 🔒 Безопасность

- IP блокировки опциональны (можно включить через env)
- Поддержка HMAC подписи для webhook
- Внутренние сервисы изолированы в Docker network
- `.env` файл в `.gitignore`

## 🧪 Тестирование

```bash
# Unit тесты
npm test

# Integration тесты
npm run test:integration

# Load тесты
npm run test:load
```

Подробнее: [TESTING.md](./docs/TESTING.md)

## 📞 Поддержка

При проблемах проверь:
1. Логи: `docker compose logs -f`
2. Health checks: `curl http://localhost:3000/health/services`
3. Конфигурацию: `.env` и `routes.json`
4. Бот добавлен в чаты в Pachka

## 📄 Лицензия

MIT
