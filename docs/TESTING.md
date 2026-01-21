# Руководство по тестированию

## Установка зависимостей

```bash
npm install
```

## Типы тестов

### 1. Unit тесты

Тестируют отдельные модули изолированно.

```bash
npm run test:unit
```

**Покрытие:**
- `shared/security.js` - проверка IP, CIDR, HMAC, API keys
- `shared/validator.js` - валидация Jira payload
- `shared/validate-routes-schema.js` - валидация routes.json

### 2. Integration тесты

Тестируют взаимодействие между компонентами.

```bash
npm run test:integration
```

**Требования:**
- Запущенные сервисы (или моки)
- Валидный `routes.json`

### 3. Нагрузочные тесты

#### Базовый Load Test

```bash
npm run test:load
```

Параметры:
- Длительность: 30 секунд
- Соединения: 10
- Показывает: RPS, latency, throughput, error rate

#### Stress Test

Постепенно увеличивает нагрузку до breaking point.

```bash
npm run test:stress
```

Этапы:
1. Warm-up (1 connection)
2. Light load (5 connections)
3. Medium load (10 connections)
4. Heavy load (25 connections)
5. Very heavy load (50 connections)
6. Extreme load (100 connections)

#### Endurance Test

Длительная нагрузка для проверки стабильности и утечек памяти.

```bash
npm run test:endurance
```

По умолчанию: 5 минут (300 секунд)

```bash
ENDURANCE_DURATION=600 npm run test:endurance  # 10 минут
```

#### Benchmark Test

Сравнение производительности при разных конфигурациях.

```bash
npm run test:benchmark
```

Тестирует: 1, 5, 10, 25, 50 соединений

#### Все нагрузочные тесты

```bash
npm run test:load:all
```

Запускает все тесты последовательно.

## Настройка тестов

### Переменные окружения

```bash
# Gateway URL
GATEWAY_URL=http://localhost:3000

# Load test параметры
LOAD_TEST_DURATION=60        # секунды
LOAD_TEST_CONNECTIONS=20     # одновременных соединений
LOAD_TEST_PIPELINING=2      # уровень pipelining

# Endurance test
ENDURANCE_DURATION=300       # секунды

# Пропустить integration тесты если сервисы не запущены
SKIP_INTEGRATION_TESTS=true
```

## Запуск тестов перед деплоем

```bash
# 1. Запустить сервисы
docker-compose up -d

# 2. Подождать запуска
sleep 10

# 3. Проверить health
curl http://localhost:3000/health

# 4. Запустить все тесты
npm run test:all

# 5. Нагрузочные тесты
npm run test:load
```

## Ожидаемые результаты

### Unit тесты
- ✅ Все тесты проходят
- Coverage > 80%

### Load test
- **Latency (p99)**: < 500ms
- **Throughput**: > 50 req/s
- **Error rate**: < 0.1%

### Stress test
- Система выдерживает минимум 25 connections
- Breaking point > 50 connections

### Endurance test
- Стабильная работа в течение всего теста
- Нет утечек памяти
- Error rate остается низким

## CI/CD Integration

Тесты можно интегрировать в CI/CD pipeline:

```yaml
# Пример для GitHub Actions
- name: Run tests
  run: |
    docker-compose up -d
    sleep 10
    npm run test:all
```

## Troubleshooting

### Тесты не запускаются

```bash
# Проверь что зависимости установлены
npm install

# Проверь что сервисы запущены
docker-compose ps
curl http://localhost:3000/health
```

### Load test показывает высокий error rate

1. Проверь что все сервисы запущены
2. Проверь логи: `docker-compose logs`
3. Уменьши количество connections
4. Проверь ресурсы сервера (CPU, память)

### Integration тесты падают

```bash
# Пропусти их если сервисы не запущены
SKIP_INTEGRATION_TESTS=true npm run test:integration
```

## Метрики производительности

После запуска load test проверь:

1. **Latency percentiles**:
   - p50 (медиана) - должен быть < 200ms
   - p90 - должен быть < 500ms
   - p99 - должен быть < 1000ms

2. **Throughput**:
   - Минимум: 50 req/s
   - Цель: 100+ req/s

3. **Error rate**:
   - Должен быть < 0.1%
   - Если выше - проверь логи и конфигурацию
