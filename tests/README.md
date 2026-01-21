# Тестирование

## Структура тестов

```
tests/
├── unit/              # Unit тесты для отдельных модулей
│   └── shared/        # Тесты общих модулей
├── integration/       # Integration тесты для сервисов
└── load/              # Нагрузочные тесты
    ├── runner.js      # Основной load test
    ├── stress.js      # Stress test (постепенное увеличение нагрузки)
    └── endurance.js   # Endurance test (длительная нагрузка)
```

## Запуск тестов

### Unit тесты
```bash
npm run test:unit
```

### Integration тесты
```bash
npm run test:integration
```

### Все тесты
```bash
npm run test:all
```

### Нагрузочные тесты

**Базовый load test:**
```bash
npm run test:load
```

**С параметрами:**

```bash
GATEWAY_URL=http://localhost:3000 \
LOAD_TEST_DURATION=60 \
LOAD_TEST_CONNECTIONS=20 \
LOAD_TEST_PIPELINING=2 \
npm run test:load
```

**Stress test (постепенное увеличение нагрузки):**

```bash
npm run test:stress
```

**Endurance test (длительная нагрузка):**

```bash
ENDURANCE_DURATION=600 npm run test:endurance
```

## Параметры нагрузочных тестов

- `GATEWAY_URL` — URL gateway сервиса (по умолчанию: `http://localhost:3000`)
- `LOAD_TEST_DURATION` — Длительность теста в секундах (по умолчанию: `30`)
- `LOAD_TEST_CONNECTIONS` — Количество одновременных соединений (по умолчанию: `10`)
- `LOAD_TEST_PIPELINING` — Уровень pipelining (по умолчанию: `1`)
- `ENDURANCE_DURATION` — Длительность endurance теста в секундах (по умолчанию: `300`)

## Ожидаемые результаты

### Unit тесты

- ✅ Все тесты должны проходить
- Coverage: > 80%

### Load test

- Latency: < 500ms (p99)
- Throughput: > 50 req/s
- Error rate: < 0.1%

### Stress test

- Система должна выдерживать минимум 25 одновременных соединений
- Breaking point должен быть > 50 connections

### Endurance test

- Система должна работать стабильно в течение всего теста
- Нет утечек памяти
- Error rate остается низким

## Запуск тестов в CI/CD

```yaml
# Пример для GitHub Actions
- name: Run tests
  run: |
    npm install
    npm run test:all
    
- name: Load test
  run: |
    docker-compose up -d
    sleep 10  # Ждем запуска сервисов
    npm run test:load
```
