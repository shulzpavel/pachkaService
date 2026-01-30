# Деплой на сервер

## Подготовка

### 1. Настройка окружения

Скопируй `env.example` в `.env` и заполни:

```bash
cp env.example .env
nano .env  # или vi/vim
```

**Обязательные переменные:**

```bash
# Pachka API
PACHKA_TOKEN=your_pachka_bot_token
PACHKA_BOT_USER_ID=your_bot_user_id
PACHKA_API_BASE=https://api.pachca.com/api/shared/v1

# Jira Base URL (для ссылок в сообщениях)
JIRA_BASE_URL=https://your-company.atlassian.net
```

**Опциональные (для production):**

```bash
# Jira Webhook Security
JIRA_WEBHOOK_SECRET=your_shared_secret  # Рекомендуется для production
JIRA_ALLOWED_IPS=ip1,ip2,ip3  # IP адреса Jira серверов (CIDR нотация)

# Internal Services Security
INTERNAL_ALLOWED_IPS=gateway,127.0.0.1  # Для production

# Admin API
ADMIN_API_KEY=your_admin_key  # Для /reload endpoint
```

### 2. Настройка routes.json

Отредактируй `routes.json` - укажи правильные `chatId` для твоих чатов:

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

## Деплой через Docker Compose

### 1. Установка зависимостей

```bash
# Убедись что Docker и Docker Compose v2 установлены
docker --version
docker compose version
```

> Примечание: проект использует Docker Compose v2 формат (без поля `version:`).
> Команда — `docker compose` (без дефиса).

### 2. Запуск

```bash
# Запуск всех сервисов
docker compose up -d

# Просмотр логов
docker compose logs -f

# Проверка статуса
docker compose ps
```

### 3. Проверка работоспособности

```bash
# Health check Gateway
curl http://localhost:3000/health

# Health check всех сервисов
curl http://localhost:3000/health/services
```

## Настройка Jira Webhook

### Где взять URL?

**URL для webhook** - это адрес **твоего сервера**, где запущен Gateway:

```
http://your-server-ip:3000/jira/webhook
```

Или если используешь домен:
```
https://your-domain.com/jira/webhook
```

### Как узнать IP сервера?

```bash
# На сервере выполни:
curl ifconfig.me
# Или
hostname -I
```

### Настройка в Jira Automation:

1. **Jira → Project Settings → Automation**
2. **Create rule:**
   - **Trigger**: Issue created / Issue updated
   - **Action**: Send web request
3. **Web request settings:**
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

## Безопасность

### Для production рекомендуется:

1. **Включить IP allowlist:**
   ```bash
   JIRA_ALLOWED_IPS=ip1,ip2,ip3
   ```

2. **Включить HMAC подпись:**
   ```bash
   JIRA_WEBHOOK_SECRET=your_secret
   ```
   И настрой в Jira webhook заголовок `X-Jira-Webhook-Signature`

3. **Включить внутренние IP блокировки:**
   ```bash
   INTERNAL_ALLOWED_IPS=gateway,127.0.0.1
   ```

4. **Использовать reverse proxy (nginx/traefik):**
   - SSL/TLS
   - Rate limiting
   - Дополнительная аутентификация

## Мониторинг

### Логи

```bash
# Все сервисы
docker compose logs -f

# Конкретный сервис
docker compose logs -f gateway
docker compose logs -f router
docker compose logs -f notifier
```

### Health checks

```bash
# Gateway
curl http://localhost:3000/health

# Все сервисы
curl http://localhost:3000/health/services
```

## Обновление

### Обновление routes.json

```bash
# 1. Отредактируй routes.json
nano routes.json

# 2. Перезагрузи конфигурацию роутера (internal endpoint)
curl -X POST http://localhost:3001/reload \
  -H "X-Admin-API-Key: your_admin_key"

В production `ADMIN_API_KEY` обязателен, иначе endpoint может быть недоступен.

# Или перезапусти роутер
docker compose restart router
```

### Обновление кода

```bash
# 1. Получи последние изменения
git pull

# 2. Пересобери и перезапусти
docker compose up -d --build
```

## Troubleshooting

### Сервисы не запускаются

```bash
# Проверь логи
docker compose logs

# Проверь .env файл
cat .env

# Проверь что порты свободны
netstat -tuln | grep 3000
```

### Сообщения не отправляются

1. Проверь токен Pachka в `.env`
2. Убедись что бот добавлен в чаты
3. Проверь логи notifier: `docker compose logs notifier`
4. Проверь что `routes.json` правильный

### Webhook не приходит

1. Проверь что Gateway доступен извне
2. Проверь firewall/iptables
3. Проверь логи gateway: `docker compose logs gateway`
4. Проверь IP allowlist (если включен)

## Важно

- **Не коммить `.env` в Git** - он уже в `.gitignore`
- **Добавь бота во все чаты** перед использованием
- **Настрой IP allowlist** для production
- **Используй HTTPS** через reverse proxy для production
