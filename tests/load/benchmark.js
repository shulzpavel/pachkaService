import autocannon from "autocannon";
import { performance } from "perf_hooks";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3000";

// Benchmark - сравнение производительности разных конфигураций
const benchmark = async () => {
  console.log("📊 Starting BENCHMARK TEST");
  console.log("Comparing different configurations\n");

  const webhookPayload = {
    webhookEvent: "jira:issue_created",
    automationName: "Benchmark Test",
    issue: {
      key: "PROJ-123",
      fields: {
        project: { key: "PROJ1" },
        summary: "Benchmark test",
      },
    },
  };

  const configurations = [
    { connections: 1, name: "Single connection" },
    { connections: 5, name: "5 connections" },
    { connections: 10, name: "10 connections" },
    { connections: 25, name: "25 connections" },
    { connections: 50, name: "50 connections" },
  ];

  const results = [];

  for (const config of configurations) {
    console.log(`\nTesting: ${config.name}...`);

    const startTime = performance.now();
    const result = await autocannon({
      url: `${GATEWAY_URL}/jira/webhook`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Atlassian-Token": "no-check",
      },
      body: JSON.stringify(webhookPayload),
      connections: config.connections,
      duration: 10,
    });
    const endTime = performance.now();

    const metrics = {
      name: config.name,
      connections: config.connections,
      rps: result.requests.average,
      latency: {
        avg: result.latency.average,
        p50: result.latency.p50,
        p90: result.latency.p90,
        p99: result.latency.p99,
      },
      errors: result.errors,
      errorRate: (result.errors / result.requests.total) * 100,
      duration: (endTime - startTime) / 1000,
    };

    results.push(metrics);

    console.log(`  RPS: ${metrics.rps.toFixed(2)}`);
    console.log(`  Avg Latency: ${metrics.latency.avg.toFixed(2)}ms`);
    console.log(`  Error Rate: ${metrics.errorRate.toFixed(2)}%`);

    // Пауза между тестами
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Выводим сводную таблицу
  console.log("\n" + "=".repeat(80));
  console.log("📊 BENCHMARK RESULTS SUMMARY");
  console.log("=".repeat(80));
  console.log(
    "Configuration".padEnd(20) +
    "Connections".padEnd(12) +
    "RPS".padEnd(10) +
    "Latency(ms)".padEnd(15) +
    "Error Rate"
  );
  console.log("-".repeat(80));

  results.forEach((r) => {
    console.log(
      r.name.padEnd(20) +
      r.connections.toString().padEnd(12) +
      r.rps.toFixed(2).padEnd(10) +
      r.latency.avg.toFixed(2).padEnd(15) +
      `${r.errorRate.toFixed(2)}%`
    );
  });

  console.log("=".repeat(80));

  // Анализ результатов
  console.log("\n📈 Analysis:");
  const maxRPS = Math.max(...results.map((r) => r.rps));
  const maxRPSConfig = results.find((r) => r.rps === maxRPS);
  console.log(`  Best throughput: ${maxRPSConfig.name} (${maxRPS.toFixed(2)} RPS)`);

  const minLatency = Math.min(...results.map((r) => r.latency.avg));
  const minLatencyConfig = results.find((r) => r.latency.avg === minLatency);
  console.log(`  Best latency: ${minLatencyConfig.name} (${minLatency.toFixed(2)}ms)`);

  const allStable = results.every((r) => r.errorRate < 1);
  if (allStable) {
    console.log("  ✅ All configurations are stable (error rate < 1%)");
  } else {
    const unstable = results.filter((r) => r.errorRate >= 1);
    console.log(`  ⚠️  ${unstable.length} configuration(s) have high error rate`);
  }
};

benchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
