# Нагрузочные тесты

## Быстрый старт

```bash
# 1. Запустить сервисы
docker-compose up -d

# 2. Подождать запуска
sleep 10

# 3. Запустить базовый load test
npm run test:load
```

## Доступные тесты

### 1. Базовый Load Test (`runner.js`)

Стандартный нагрузочный тест с настраиваемыми параметрами.

```bash
npm run test:load
```

**Параметры:**

- `GATEWAY_URL` — URL gateway (по умолчанию: `http://localhost:3000`)
- `LOAD_TEST_DURATION` — Длительность в секундах (по умолчанию: `30`)
- `LOAD_TEST_CONNECTIONS` — Количество соединений (по умолчанию: `10`)
- `LOAD_TEST_PIPELINING` — Уровень pipelining (по умолчанию: `1`)

**Пример:**
```bash
LOAD_TEST_DURATION=60 \
LOAD_TEST_CONNECTIONS=25 \
npm run test:load
```

### 2. Stress Test (`stress.js`)

Постепенно увеличивает нагрузку до breaking point.

```bash
npm run test:stress
```

**Этапы:**

1. Warm-up: 1 connection, 10s
2. Light load: 5 connections, 10s
3. Medium load: 10 connections, 10s
4. Heavy load: 25 connections, 10s
5. Very heavy load: 50 connections, 10s
6. Extreme load: 100 connections, 10s

Тест останавливается если error rate > 5% или latency > 2s.

### 3. Endurance Test (`endurance.js`)

Длительная нагрузка для проверки стабильности и утечек памяти.

```bash
npm run test:endurance
```

**Параметры:**

- `ENDURANCE_DURATION` — Длительность в секундах (по умолчанию: `300` = 5 минут)

**Пример:**

```bash
ENDURANCE_DURATION=600 npm run test:endurance  # 10 минут
```

### 4. Benchmark Test (`benchmark.js`)

Сравнение производительности при разных конфигурациях.

```bash
npm run test:benchmark
```

Тестирует: 1, 5, 10, 25, 50 соединений и выводит сравнительную таблицу.

### 5. Все тесты (`run-all.sh`)

Запускает все нагрузочные тесты последовательно.

```bash
npm run test:load:all
# или
bash tests/load/run-all.sh
```

## Интерпретация результатов

### Хорошие показатели

- **Latency (p99)**: < 500ms
- **Throughput**: > 50 req/s
- **Error rate**: < 0.1%
- **Стабильность**: Нет деградации производительности со временем

### Плохие показатели

- **Latency (p99)**: > 1000ms
- **Throughput**: < 20 req/s
- **Error rate**: > 1%
- **Memory leaks**: Растущее использование памяти в endurance test

## Troubleshooting

### Высокий error rate

1. Проверь что все сервисы запущены: `docker-compose ps`
2. Проверь логи: `docker-compose logs -f`
3. Уменьши количество connections
4. Проверь ресурсы сервера (CPU, память, сеть)

### Высокая latency

1. Проверь что router и notifier доступны
2. Проверь сетевую задержку между сервисами
3. Проверь что нет rate limiting на уровне инфраструктуры
4. Увеличь ресурсы контейнеров в docker-compose.yml

### Тесты не запускаются

```bash
# Проверь что gateway доступен
curl http://localhost:3000/health

# Проверь что зависимости установлены
npm install

# Проверь что скрипт исполняемый
chmod +x tests/load/run-all.sh
```

## Рекомендации

1. **Перед деплоем**: Запусти все тесты
2. **После изменений**: Запусти stress test
3. **Регулярно**: Запускай endurance test для проверки утечек
4. **Мониторинг**: Используй результаты для настройки алертов
