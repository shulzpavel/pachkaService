# Микросервисная архитектура

Проект разбит на три независимых микросервиса:

## Архитектура

```
┌─────────────┐
│   Jira     │
│  Webhook   │
└─────┬───────┘
      │
      ▼
┌─────────────────────────────────┐
│      Gateway Service            │
│  (Port 3000)                    │
│  - Валидация                    │
│  - Аутентификация (HMAC/IP)     │
│  - Rate limiting                │
└─────┬───────────────────────────┘
      │
      ├─────────────────┐
      ▼                 ▼
┌─────────────┐  ┌──────────────┐
│   Router    │  │  Notifier   │
│  Service    │  │  Service    │
│ (Port 3001) │  │ (Port 3002)  │
│             │  │              │
│ - Роутинг   │  │ - Отправка   │
│ - Шаблоны   │  │   в Пачку    │
│ - Правила   │  │ - Retry      │
└─────────────┘  └──────────────┘
```

## Сервисы

### 1. Gateway Service (Порт 3000)

**Роль**: Единая точка входа, валидация и аутентификация

**Функции**:
- Приём webhooks от Jira
- Валидация payload
- HMAC проверка подписи
- IP allowlist
- Rate limiting (100 req/min)
- Форвардинг в Router Service
- Форвардинг в Notifier Service

**Endpoints**:
- `GET /health` - health check
- `GET /health/services` - проверка доступности всех сервисов
- `POST /jira/webhook` - приём webhook от Jira

**Переменные окружения**:
- `GATEWAY_PORT` - порт (по умолчанию: 3000)
- `ROUTER_SERVICE_URL` - URL Router Service
- `NOTIFIER_SERVICE_URL` - URL Notifier Service
- `JIRA_WEBHOOK_SECRET` - секрет для HMAC
- `JIRA_ALLOWED_IPS` - IP allowlist

### 2. Router Service (Порт 3001)

**Роль**: Определение маршрута для сообщений

**Функции**:
- Загрузка правил из `routes.json`
- Сопоставление payload с правилами
- Рендеринг шаблонов сообщений
- Hot reload конфигурации

**Endpoints**:
- `GET /health` - health check
- `GET /status` - статус и количество правил
- `POST /reload` - перезагрузка конфигурации
- `POST /route` - определение маршрута (внутренний API)

**Переменные окружения**:
- `ROUTER_PORT` - порт (по умолчанию: 3001)

**Volumes**:
- `./routes.json` - конфигурация правил (read-only)

### 3. Notifier Service (Порт 3002)

**Роль**: Отправка уведомлений в Пачку

**Функции**:
- Отправка сообщений через API Пачки
- Retry логика (только для 5xx/429)
- Обработка ошибок

**Endpoints**:
- `GET /health` - health check
- `POST /notify` - отправка уведомления (внутренний API)

**Переменные окружения**:
- `NOTIFIER_PORT` - порт (по умолчанию: 3002)
- `PACHKA_TOKEN` - токен бота Пачки
- `PACHKA_API_BASE` - базовый URL API Пачки

## Запуск

### Docker Compose (рекомендуется)

```bash
# Запуск всех сервисов
docker compose up -d

# Просмотр логов
docker compose logs -f

# Остановка
docker compose down
```

## Преимущества микросервисной архитектуры

1. **Масштабируемость**: Каждый сервис можно масштабировать независимо
2. **Изоляция**: Сбой одного сервиса не влияет на другие
3. **Независимое развертывание**: Обновления без остановки всей системы
4. **Технологическая гибкость**: Можно использовать разные технологии для разных сервисов
5. **Мониторинг**: Легче отслеживать производительность каждого сервиса

## Масштабирование

### Горизонтальное масштабирование

```yaml
# docker-compose.yml
services:
  gateway:
    deploy:
      replicas: 2
  router:
    deploy:
      replicas: 3
  notifier:
    deploy:
      replicas: 2
```

### Вертикальное масштабирование

Настройка ресурсов в `docker-compose.yml`:

```yaml
services:
  gateway:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

## Мониторинг

### Health Checks

Все сервисы имеют health check endpoints:
- `GET /health` - проверка состояния сервиса

Gateway также предоставляет:
- `GET /health/services` - проверка доступности всех сервисов

### Логирование

Каждый сервис логирует с префиксом `[service-name]`:
```
2024-01-01 12:00:00 [gateway] [info]: Gateway service started
2024-01-01 12:00:01 [router] [info]: Router service started
2024-01-01 12:00:02 [notifier] [info]: Notifier service started
```

## Сетевая изоляция

Все сервисы находятся в одной Docker сети `jira-pachka-network`:
- Внутренняя коммуникация через имена сервисов (gateway, router, notifier)
- Gateway доступен извне на порту 3000
- Router и Notifier доступны только внутри сети

## Обновление конфигурации

Router Service поддерживает hot reload:

```bash
curl -X POST http://localhost:3001/reload \
  -H "X-Admin-API-Key: your_admin_key"
```

После изменения `routes.json` перезагрузи конфигурацию без перезапуска сервиса. Требуется `ADMIN_API_KEY` в production.
