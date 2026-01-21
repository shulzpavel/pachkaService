import autocannon from "autocannon";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3000";

// Stress test - постепенно увеличиваем нагрузку
const stressTest = async () => {
  console.log("🔥 Starting STRESS TEST");
  console.log("This test gradually increases load to find breaking point\n");

  const stages = [
    { connections: 1, duration: 10, name: "Warm-up" },
    { connections: 5, duration: 10, name: "Light load" },
    { connections: 10, duration: 10, name: "Medium load" },
    { connections: 25, duration: 10, name: "Heavy load" },
    { connections: 50, duration: 10, name: "Very heavy load" },
    { connections: 100, duration: 10, name: "Extreme load" },
  ];

  const webhookPayload = {
    webhookEvent: "jira:issue_created",
    automationName: "Stress Test",
    issue: {
      key: "PROJ-123",
      fields: {
        project: { key: "PROJ1" },
        summary: "Stress test",
      },
    },
  };

  for (const stage of stages) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 Stage: ${stage.name}`);
    console.log(`   Connections: ${stage.connections}`);
    console.log(`   Duration: ${stage.duration}s`);
    console.log("=".repeat(60));

    const result = await autocannon({
      url: `${GATEWAY_URL}/jira/webhook`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Atlassian-Token": "no-check",
      },
      body: JSON.stringify(webhookPayload),
      connections: stage.connections,
      duration: stage.duration,
    });

    const errorRate = (result.errors / result.requests.total) * 100;
    const avgLatency = result.latency.average;

    console.log(`\nResults:`);
    console.log(`  RPS: ${result.requests.average.toFixed(2)}`);
    console.log(`  Avg Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`  Error Rate: ${errorRate.toFixed(2)}%`);
    console.log(`  Status Codes:`, result.statusCodeStats);

    // Если ошибок больше 5% или latency > 2s, останавливаемся
    if (errorRate > 5 || avgLatency > 2000) {
      console.log(`\n⚠️  Breaking point reached at ${stage.name}`);
      console.log(`   Error rate: ${errorRate.toFixed(2)}%`);
      console.log(`   Latency: ${avgLatency.toFixed(2)}ms`);
      break;
    }

    // Пауза между этапами
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("\n✅ Stress test completed");
};

stressTest().catch((err) => {
  console.error("Stress test failed:", err);
  process.exit(1);
});
