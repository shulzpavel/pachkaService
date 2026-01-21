#!/usr/bin/env node

/**
 * Скрипт для валидации структуры тестов без запуска
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

let errors = [];
let warnings = [];

function checkFileExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    errors.push(`❌ Missing: ${description} (${filePath})`);
    return false;
  }
  return true;
}

function checkFileContent(filePath, description, checks) {
  if (!fs.existsSync(filePath)) {
    errors.push(`❌ Missing: ${description}`);
    return;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    checks.forEach((check) => {
      if (!check.test(content)) {
        errors.push(`❌ ${description}: ${check.message}`);
      }
    });
  } catch (error) {
    errors.push(`❌ Error reading ${description}: ${error.message}`);
  }
}

console.log("🔍 Validating test structure...\n");

// Проверка структуры директорий
const testDirs = [
  "tests/unit/shared",
  "tests/integration",
  "tests/load",
  "tests/performance",
];

testDirs.forEach((dir) => {
  const fullPath = path.join(rootDir, dir);
  if (!fs.existsSync(fullPath)) {
    errors.push(`❌ Missing directory: ${dir}`);
  }
});

// Проверка unit тестов
console.log("📋 Checking unit tests...");
const unitTests = [
  "tests/unit/shared/security.test.js",
  "tests/unit/shared/validator.test.js",
  "tests/unit/shared/validate-routes-schema.test.js",
  "tests/unit/shared/fetch-with-timeout.test.js",
];

unitTests.forEach((test) => {
  checkFileExists(path.join(rootDir, test), `Unit test: ${test}`);
});

// Проверка integration тестов
console.log("📋 Checking integration tests...");
const integrationTests = [
  "tests/integration/gateway.test.js",
  "tests/integration/router.test.js",
  "tests/integration/full-flow.test.js",
];

integrationTests.forEach((test) => {
  checkFileExists(path.join(rootDir, test), `Integration test: ${test}`);
});

// Проверка нагрузочных тестов
console.log("📋 Checking load tests...");
const loadTests = [
  "tests/load/runner.js",
  "tests/load/stress.js",
  "tests/load/endurance.js",
  "tests/load/benchmark.js",
  "tests/load/run-all.sh",
];

loadTests.forEach((test) => {
  checkFileExists(path.join(rootDir, test), `Load test: ${test}`);
});

// Проверка конфигурации
console.log("📋 Checking configuration...");
checkFileExists(path.join(rootDir, "jest.config.js"), "Jest configuration");
checkFileExists(path.join(rootDir, "package.json"), "package.json");

// Проверка package.json на наличие тестовых скриптов
checkFileContent(
  path.join(rootDir, "package.json"),
  "package.json",
  [
    {
      test: /"test":/,
      message: "Missing 'test' script",
    },
    {
      test: /"test:unit":/,
      message: "Missing 'test:unit' script",
    },
    {
      test: /"test:load":/,
      message: "Missing 'test:load' script",
    },
  ]
);

// Проверка наличия devDependencies
checkFileContent(
  path.join(rootDir, "package.json"),
  "package.json devDependencies",
  [
    {
      test: /"jest":/,
      message: "Missing 'jest' in devDependencies",
    },
    {
      test: /"autocannon":/,
      message: "Missing 'autocannon' in devDependencies",
    },
  ]
);

// Проверка shared модулей (которые тестируются)
console.log("📋 Checking shared modules...");
const sharedModules = [
  "shared/security.js",
  "shared/validator.js",
  "shared/validate-routes-schema.js",
  "shared/fetch-with-timeout.js",
  "shared/logger.js",
];

sharedModules.forEach((module) => {
  checkFileExists(path.join(rootDir, module), `Shared module: ${module}`);
});

// Проверка routes.json
console.log("📋 Checking routes.json...");
const routesPath = path.join(rootDir, "routes.json");
if (fs.existsSync(routesPath)) {
  try {
    const routes = JSON.parse(fs.readFileSync(routesPath, "utf8"));
    if (!routes.rules || !Array.isArray(routes.rules)) {
      errors.push("❌ routes.json: missing or invalid 'rules' array");
    } else if (routes.rules.length === 0) {
      warnings.push("⚠️  routes.json: 'rules' array is empty");
    } else {
      console.log(`   ✅ routes.json: ${routes.rules.length} rule(s) found`);
    }
  } catch (error) {
    errors.push(`❌ routes.json: invalid JSON - ${error.message}`);
  }
} else {
  warnings.push("⚠️  routes.json not found (will be created at runtime)");
}

// Итоги
console.log("\n" + "=".repeat(60));
console.log("📊 VALIDATION RESULTS");
console.log("=".repeat(60));

if (errors.length === 0 && warnings.length === 0) {
  console.log("\n✅ All checks passed!");
  console.log("\n📝 Next steps:");
  console.log("   1. Install dependencies: npm install");
  console.log("   2. Run unit tests: npm run test:unit");
  console.log("   3. Start services: docker-compose up -d");
  console.log("   4. Run load tests: npm run test:load");
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(`\n❌ Found ${errors.length} error(s):`);
    errors.forEach((error) => console.log(`   ${error}`));
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  Found ${warnings.length} warning(s):`);
    warnings.forEach((warning) => console.log(`   ${warning}`));
  }

  console.log("\n💡 Fix errors before running tests");
  process.exit(errors.length > 0 ? 1 : 0);
}
