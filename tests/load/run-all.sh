#!/bin/bash

# Скрипт для запуска всех нагрузочных тестов

set -e

GATEWAY_URL=${GATEWAY_URL:-"http://localhost:3000"}

echo "🚀 Running all load tests"
echo "Gateway URL: $GATEWAY_URL"
echo ""

# Проверяем что gateway доступен
echo "Checking gateway availability..."
if ! curl -s -f "$GATEWAY_URL/health" > /dev/null; then
  echo "❌ Gateway is not available at $GATEWAY_URL"
  echo "Please start services first: docker-compose up -d"
  exit 1
fi

echo "✅ Gateway is available"
echo ""

# 1. Базовый load test
echo "=" | head -c 60; echo ""
echo "1. Running basic load test..."
echo "=" | head -c 60; echo ""
npm run test:load || node tests/load/runner.js

echo ""
sleep 5

# 2. Stress test
echo "=" | head -c 60; echo ""
echo "2. Running stress test..."
echo "=" | head -c 60; echo ""
node tests/load/stress.js

echo ""
sleep 5

# 3. Endurance test (короткий для демо)
echo "=" | head -c 60; echo ""
echo "3. Running endurance test (60 seconds)..."
echo "=" | head -c 60; echo ""
ENDURANCE_DURATION=60 node tests/load/endurance.js

echo ""
echo "✅ All load tests completed!"
