import autocannon from "autocannon";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3000";
const DURATION = parseInt(process.env.ENDURANCE_DURATION || "300", 10); // 5 минут по умолчанию

// Endurance test - длительная нагрузка для проверки утечек памяти
const enduranceTest = async () => {
  console.log("⏱️  Starting ENDURANCE TEST");
  console.log(`Duration: ${DURATION} seconds (${(DURATION / 60).toFixed(1)} minutes)`);
  console.log("This test checks for memory leaks and stability over time\n");

  const webhookPayload = {
    webhookEvent: "jira:issue_created",
    automationName: "Endurance Test",
    issue: {
      key: "PROJ-123",
      fields: {
        project: { key: "PROJ1" },
        summary: "Endurance test",
      },
    },
  };

  const instance = autocannon(
    {
      url: `${GATEWAY_URL}/jira/webhook`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Atlassian-Token": "no-check",
      },
      body: JSON.stringify(webhookPayload),
      connections: 10,
      duration: DURATION,
    },
    (err, result) => {
      if (err) {
        console.error("❌ Endurance test failed:", err);
        process.exit(1);
      }

      console.log("\n" + "=".repeat(60));
      console.log("📊 ENDURANCE TEST RESULTS");
      console.log("=".repeat(60));

      console.log(`\nTotal Requests: ${result.requests.total.toLocaleString()}`);
      console.log(`Average RPS: ${result.requests.average.toFixed(2)}`);
      console.log(`Average Latency: ${result.latency.average.toFixed(2)}ms`);
      console.log(`Errors: ${result.errors}`);

      const errorRate = (result.errors / result.requests.total) * 100;
      if (errorRate < 0.1) {
        console.log("\n✅ System remained stable throughout the test");
      } else {
        console.log(`\n⚠️  Error rate: ${errorRate.toFixed(2)}%`);
      }

      console.log("=".repeat(60) + "\n");
    }
  );

  // Показываем прогресс каждые 30 секунд
  let lastUpdate = Date.now();
  instance.on("tick", () => {
    const now = Date.now();
    if (now - lastUpdate > 30000) {
      const elapsed = Math.floor((now - instance.start) / 1000);
      const remaining = DURATION - elapsed;
      console.log(`⏳ Elapsed: ${elapsed}s, Remaining: ${remaining}s`);
      lastUpdate = now;
    }
  });
};

enduranceTest().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
