# Настройка автоматизации в Jira

## Нужно ли настраивать автоматизацию в Jira?

**Да, нужно!** Jira должна отправлять webhook на ваш сервис при событиях.

## Варианты настройки

### Вариант 1: Jira Automation (рекомендуется)

Jira имеет встроенный механизм автоматизации, который может отправлять webhook.

#### Шаги:

1. **Открой Jira → Project Settings → Automation**

2. **Создай новое правило автоматизации:**
   - **Trigger**: "Issue created" / "Issue updated" / "Issue transitioned"
   - **Condition**: (опционально) фильтр по проекту, типу задачи и т.д.
   - **Action**: "Send web request"

3. **Настрой "Send web request":**

   ```
   Method: POST
   URL: http://your-server:3000/jira/webhook
   Headers:
     Content-Type: application/json
     X-Atlassian-Token: no-check
   Body:
   {
     "webhookEvent": "{{webhookEvent}}",
     "automationName": "test_pachka",
     "issue": {{issue}},
     "user": {{initiator}}
   }
   ```

   **КРИТИЧЕСКИ ВАЖНО:**
   - `automationName` - укажи **"test_pachka"** (должно совпадать с `routes.json`)
   - `{{issue}}` и `{{initiator}}` - это **переменные Jira Automation** (с двойными фигурными скобками!)
   - **НЕ пиши** `"issue": FLEX-1596` - это неправильно!
   - **Пиши** `"issue": {{issue}}` - Jira автоматически подставит JSON
   - Jira подставит полный JSON объект вместо `{{issue}}` и `{{initiator}}`

4. **Сохрани и активируй правило**

### Вариант 2: Jira Webhook (если есть доступ к админке)

Если у тебя есть доступ к Jira Administration:

1. **Jira Administration → System → Webhooks**

2. **Create webhook:**
   - **Name**: Jira to Pachka Router
   - **URL**: `http://your-server:3000/jira/webhook`
   - **Events**: выбери нужные события (Issue Created, Issue Updated, etc.)

3. **Настрой фильтры** (опционально):
   - По проекту
   - По типу задачи
   - И т.д.

## Формат payload от Jira

Jira отправляет payload в таком формате:

```json
{
  "webhookEvent": "jira:issue_created",
  "issue": {
    "key": "PROJ-123",
    "fields": {
      "project": {
        "key": "PROJ1"
      },
      "summary": "Issue summary",
      "status": {
        "name": "To Do"
      },
      "issuetype": {
        "name": "Bug"
      }
    }
  },
  "user": {
    "displayName": "User Name"
  }
}
```

Если используешь Jira Automation с `automationName`, добавь:

```json
{
  "webhookEvent": "jira:issue_created",
  "automationName": "My Automation Name",
  "issue": {{issue}},
  "user": {{initiator}}
}
```

## Проверка работы

### 1. Проверь что сервисы запущены

```bash
curl http://your-server:3000/health
```

### 2. Проверь логи

```bash
# Docker Compose
docker-compose logs -f gateway
docker-compose logs -f router
docker-compose logs -f notifier
```

### 3. Проверь Пачку

Открой чат в Пачке (ID из `routes.json`) и проверь что сообщение пришло.

## Troubleshooting

### Jira не отправляет webhook

1. Проверь что URL правильный
2. Проверь что сервис доступен из интернета
3. Проверь логи gateway: `docker-compose logs gateway`
4. Проверь что нет ошибок в Jira Automation

### Webhook приходит, но сообщение не отправляется в Пачку

1. Проверь токен в `.env`: `grep PACHKA_TOKEN .env`
2. Проверь что бот добавлен в чат в Пачке
3. Проверь chat_id в `routes.json`
4. Проверь логи notifier: `docker-compose logs notifier`

### "No route matched"

1. Проверь `routes.json` - должно быть правило для твоего `projectKey` или `automationName`
2. Проверь что payload содержит нужные поля
3. Проверь логи router: `docker-compose logs router`
