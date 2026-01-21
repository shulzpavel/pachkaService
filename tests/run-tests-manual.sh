#!/bin/bash

# Скрипт для ручного запуска тестов с проверками

set -e

echo "🧪 Test Runner for Jira-Pachka Router"
echo "======================================"
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка зависимостей
echo "1️⃣  Checking dependencies..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}⚠️  npm not found, but tests can still be validated${NC}"
else
    echo -e "${GREEN}✅ npm found${NC}"
fi

echo ""

# Валидация структуры тестов
echo "2️⃣  Validating test structure..."
node tests/validate-tests.js
VALIDATION_EXIT=$?

if [ $VALIDATION_EXIT -ne 0 ]; then
    echo -e "${RED}❌ Test structure validation failed${NC}"
    exit 1
fi

echo ""

# Проверка наличия node_modules
echo "3️⃣  Checking test dependencies..."
if [ -d "node_modules/jest" ]; then
    echo -e "${GREEN}✅ Jest installed${NC}"
    JEST_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  Jest not installed (run: npm install)${NC}"
    JEST_AVAILABLE=false
fi

if [ -d "node_modules/autocannon" ]; then
    echo -e "${GREEN}✅ Autocannon installed${NC}"
    AUTOCANNON_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  Autocannon not installed (run: npm install)${NC}"
    AUTOCANNON_AVAILABLE=false
fi

echo ""

# Проверка сервисов
echo "4️⃣  Checking services..."
if command -v docker-compose &> /dev/null; then
    if docker-compose ps 2>/dev/null | grep -q "Up"; then
        echo -e "${GREEN}✅ Services are running${NC}"
        SERVICES_RUNNING=true
    else
        echo -e "${YELLOW}⚠️  Services not running (start with: docker-compose up -d)${NC}"
        SERVICES_RUNNING=false
    fi
else
    echo -e "${YELLOW}⚠️  docker-compose not found${NC}"
    SERVICES_RUNNING=false
fi

# Проверка gateway
if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Gateway is accessible${NC}"
    GATEWAY_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  Gateway not accessible at http://localhost:3000${NC}"
    GATEWAY_AVAILABLE=false
fi

echo ""

# Резюме
echo "======================================"
echo "📊 SUMMARY"
echo "======================================"
echo ""

if [ "$JEST_AVAILABLE" = true ]; then
    echo -e "${GREEN}✅ Unit tests: Ready to run${NC}"
    echo "   Run: npm run test:unit"
else
    echo -e "${YELLOW}⚠️  Unit tests: Install dependencies first${NC}"
    echo "   Run: npm install"
fi

if [ "$AUTOCANNON_AVAILABLE" = true ] && [ "$GATEWAY_AVAILABLE" = true ]; then
    echo -e "${GREEN}✅ Load tests: Ready to run${NC}"
    echo "   Run: npm run test:load"
elif [ "$AUTOCANNON_AVAILABLE" = false ]; then
    echo -e "${YELLOW}⚠️  Load tests: Install dependencies first${NC}"
    echo "   Run: npm install"
elif [ "$GATEWAY_AVAILABLE" = false ]; then
    echo -e "${YELLOW}⚠️  Load tests: Start services first${NC}"
    echo "   Run: docker-compose up -d"
else
    echo -e "${YELLOW}⚠️  Load tests: Install dependencies and start services${NC}"
fi

echo ""

# Попытка запустить unit тесты если jest доступен
if [ "$JEST_AVAILABLE" = true ]; then
    echo "5️⃣  Running unit tests..."
    echo ""
    
    if npm run test:unit 2>&1; then
        echo ""
        echo -e "${GREEN}✅ Unit tests passed!${NC}"
    else
        echo ""
        echo -e "${RED}❌ Unit tests failed${NC}"
        exit 1
    fi
else
    echo "5️⃣  Skipping unit tests (Jest not installed)"
    echo "   Install dependencies: npm install"
fi

echo ""
echo "======================================"
echo -e "${GREEN}✅ Test validation complete!${NC}"
echo "======================================"
