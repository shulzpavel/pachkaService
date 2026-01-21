import autocannon from "autocannon";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3000";
const DURATION = parseInt(process.env.LOAD_TEST_DURATION || "30", 10); // секунды
const CONNECTIONS = parseInt(process.env.LOAD_TEST_CONNECTIONS || "10", 10);
const PIPELINING = parseInt(process.env.LOAD_TEST_PIPELINING || "1", 10);

// Тестовый payload
const webhookPayload = {
  webhookEvent: "jira:issue_created",
  automationName: "Load Test Automation",
  issue: {
    key: "PROJ-123",
    fields: {
      project: { key: "PROJ1" },
      summary: "Load test issue",
      status: { name: "To Do" },
      issuetype: { name: "Bug" },
    },
  },
  user: {
    displayName: "Load Test User",
  },
};

async function runLoadTest() {
  console.log("🚀 Starting load test...");
  console.log(`Target: ${GATEWAY_URL}`);
  console.log(`Duration: ${DURATION}s`);
  console.log(`Connections: ${CONNECTIONS}`);
  console.log(`Pipelining: ${PIPELINING}`);
  console.log("");

  const instance = autocannon(
    {
      url: `${GATEWAY_URL}/jira/webhook`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Atlassian-Token": "no-check",
      },
      body: JSON.stringify(webhookPayload),
      connections: CONNECTIONS,
      pipelining: PIPELINING,
      duration: DURATION,
    },
    (err, result) => {
      if (err) {
        console.error("❌ Load test failed:", err);
        process.exit(1);
      }

      printResults(result);
    }
  );

  // Отображаем прогресс
  autocannon.track(instance, {
    outputStream: process.stdout,
  });

  // Обработка завершения
  instance.on("done", (result) => {
    printResults(result);
  });
}

function printResults(result) {
  console.log("\n" + "=".repeat(60));
  console.log("📊 LOAD TEST RESULTS");
  console.log("=".repeat(60));

  console.log("\n📈 Requests:");
  console.log(`  Total: ${result.requests.total.toLocaleString()}`);
  console.log(`  Average: ${result.requests.average.toFixed(2)}/sec`);
  console.log(`  Min: ${result.requests.min.toLocaleString()}/sec`);
  console.log(`  Max: ${result.requests.max.toLocaleString()}/sec`);

  console.log("\n⏱️  Latency:");
  console.log(`  Average: ${result.latency.average.toFixed(2)}ms`);
  console.log(`  Min: ${result.latency.min.toFixed(2)}ms`);
  console.log(`  Max: ${result.latency.max.toFixed(2)}ms`);
  console.log(`  p50: ${result.latency.p50.toFixed(2)}ms`);
  console.log(`  p90: ${result.latency.p90.toFixed(2)}ms`);
  console.log(`  p99: ${result.latency.p99.toFixed(2)}ms`);

  console.log("\n✅ Throughput:");
  console.log(`  Average: ${(result.throughput.average / 1024).toFixed(2)} KB/s`);
  console.log(`  Total: ${(result.throughput.total / 1024 / 1024).toFixed(2)} MB`);

  console.log("\n📊 Status Codes:");
  Object.entries(result.statusCodeStats).forEach(([code, count]) => {
    const percentage = ((count / result.requests.total) * 100).toFixed(2);
    console.log(`  ${code}: ${count.toLocaleString()} (${percentage}%)`);
  });

  console.log("\n⚠️  Errors:");
  if (result.errors === 0) {
    console.log("  ✅ No errors!");
  } else {
    console.log(`  ❌ Total errors: ${result.errors}`);
    if (result["2xx"] !== result.requests.total) {
      console.log("  ⚠️  Some requests returned non-2xx status codes");
    }
  }

  console.log("\n" + "=".repeat(60));

  // Оценка производительности
  const avgLatency = result.latency.average;
  const avgRPS = result.requests.average;
  const errorRate = (result.errors / result.requests.total) * 100;

  console.log("\n🎯 Performance Assessment:");
  if (avgLatency < 100) {
    console.log("  ✅ Excellent latency (< 100ms)");
  } else if (avgLatency < 500) {
    console.log("  ✅ Good latency (< 500ms)");
  } else if (avgLatency < 1000) {
    console.log("  ⚠️  Acceptable latency (< 1s)");
  } else {
    console.log("  ❌ High latency (> 1s) - needs optimization");
  }

  if (avgRPS > 100) {
    console.log("  ✅ High throughput (> 100 req/s)");
  } else if (avgRPS > 50) {
    console.log("  ✅ Good throughput (> 50 req/s)");
  } else {
    console.log("  ⚠️  Low throughput (< 50 req/s)");
  }

  if (errorRate < 0.1) {
    console.log("  ✅ Very low error rate (< 0.1%)");
  } else if (errorRate < 1) {
    console.log("  ⚠️  Low error rate (< 1%)");
  } else {
    console.log("  ❌ High error rate (> 1%) - needs investigation");
  }

  console.log("=".repeat(60) + "\n");
}

// Запуск теста
runLoadTest().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
