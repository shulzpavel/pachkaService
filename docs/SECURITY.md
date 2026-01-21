# Безопасность

## Критические исправления

### ✅ Токен удален из репозитория

- Реальный `PACHKA_TOKEN` удален из `env.example` (заменен на `<fill-me>`)
- **ВАЖНО**: Если токен был в истории Git — **срочно ротируй токен в Пачке**
- Используй `git filter-branch` или `git filter-repo` для удаления из истории
- См. раздел "Удаление токена из Git истории" ниже

### ✅ Аутентификация webhook

#### HMAC подпись (рекомендуется)

Настрой в Jira webhook секрет и укажи в `.env`:

```bash
JIRA_WEBHOOK_SECRET=your_secret_here
```

Jira будет отправлять подпись в заголовке (формат зависит от версии Jira).

#### IP Allowlist (альтернатива/дополнение)

```bash
JIRA_ALLOWED_IPS=192.168.1.1,10.0.0.0/8
```

### ✅ Правильные HTTP коды

- **200 OK** — успешная обработка или игнорирование (нет маршрута)
- **503 Service Unavailable** — временные ошибки (5xx, 429), Jira повторит
- **200 OK** с `retryable: false` — постоянные ошибки (4xx), не ретраить
- **401 Unauthorized** — неверная подпись/токен
- **403 Forbidden** — IP не в allowlist
- **429 Too Many Requests** — rate limit

### ✅ Защита административных endpoints

#### `/reload` endpoint

- Требует `ADMIN_API_KEY` в production
- Если ключ не настроен в production — endpoint отключен (404)
- Использование: `X-Admin-API-Key: your_key`
- Rate limited: 10 запросов/минуту

### ✅ Retry логика

- **НЕ ретраирует** 4xx ошибки (400, 401, 403, 404)
- **Ретраирует** только 5xx и 429 (rate limit)
- Экспоненциальная задержка с джиттером (до 30% случайности)
- Максимум 3 попытки

### ✅ Rate Limiting

- Webhook endpoint: 100 запросов/минуту
- Admin endpoints: 10 запросов/минуту
- IP allowlist пропускает rate limit

### ✅ Улучшенный defaultChatId

- Не отправляет полный JSON payload
- Только минимальная информация: issue key, summary, project, status

### ✅ Исправлен boardId

- Убрана заглушка `customfield_xxx`
- Проверяет `payload.board?.id` и другие возможные места

## Дополнительные улучшения

### ✅ Валидация payload

- Добавлена валидация структуры входящего payload
- Проверка обязательных полей (issue или automationName)
- Логирование структуры payload для отладки (без чувствительных данных)

### ✅ Улучшенное логирование

- Структурированное логирование ключевых полей
- Разделение retryable и non-retryable ошибок
- Логирование IP адресов для аудита

### ✅ Оптимизация размера тела

- Уменьшен лимит body с 10MB до 1MB (достаточно для Jira webhooks)
- Защита от DoS через большие payloads

### ✅ Улучшенная обработка boardId

- Убрана заглушка `customfield_xxx`
- Проверка нескольких возможных мест для boardId
- Поддержка Agile board ID

## Рекомендации

### Мониторинг
- Настрой алерты на ошибки доставки (5xx, 4xx)
- Логируй все попытки аутентификации
- Отслеживай rate limit срабатывания
- Мониторь валидационные ошибки (400)

### Ротация токенов

1. Создай новый токен в Пачке
2. Обнови `.env` на сервере
3. Перезапусти сервис: `docker-compose restart notifier`
4. Удали старый токен

### Удаление токена из Git истории

```bash
# Используй git filter-repo (рекомендуется)
git filter-repo --path env.example --invert-paths

# Или git filter-branch (старый способ)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch env.example" \
  --prune-empty --tag-name-filter cat -- --all
```

После этого:

1. Force push: `git push --force --all`
2. Уведоми всех разработчиков о пересоздании репозитория
3. Ротируй токен в Пачке

## Проверка безопасности

### Тест HMAC

```bash
# С правильной подписью
curl -X POST http://your-server:3000/jira/webhook \
  -H "Content-Type: application/json" \
  -H "X-Jira-Webhook-Signature: $(echo -n '{"test":true}' | openssl dgst -sha256 -hmac 'secret' -hex | cut -d' ' -f2)" \
  -d '{"test":true}'

# С неправильной подписью (должен вернуть 401)
curl -X POST http://your-server:3000/jira/webhook \
  -H "Content-Type: application/json" \
  -H "X-Jira-Webhook-Signature: wrong_signature" \
  -d '{"test":true}'
```

### Тест /reload

```bash
# Без ключа (должен вернуть 401 или 404 в production)
curl -X POST http://your-server:3000/reload

# С правильным ключом
curl -X POST http://your-server:3000/reload \
  -H "X-Admin-API-Key: your_admin_key"
```
