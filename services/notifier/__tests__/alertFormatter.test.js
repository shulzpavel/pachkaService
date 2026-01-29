import { formatDate, formatAlertMessage } from "../alertFormatter.js";

describe("alertFormatter", () => {
  test("formatDate valid iso", () => {
    expect(formatDate("2026-01-23T18:17:26.701Z")).toBe("23.01.26 21:17"); // MSK
  });

  test("formatDate uses Moscow timezone", () => {
    expect(formatDate("2026-01-23T00:30:00.000Z")).toBe("23.01.26 03:30");
  });

  test("formatDate invalid or empty", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate("0001-01-01T00:00:00.000Z")).toBe("-");
    expect(formatDate("not-a-date")).toBe("-");
  });

  test("formatAlertMessage firing", () => {
    const msg = formatAlertMessage({
      status: "firing",
      labels: { alertname: "ServiceDown", severity: "critical", instance: "router:3001" },
      annotations: { summary: "Сервис router:3001 недоступен >1м", description: "Тест" },
      startsAt: "2026-01-23T18:17:26.701Z",
    });
    expect(msg).toContain("Status");
    expect(msg).toContain("FIRING");
    expect(msg.startsWith("🟥")).toBe(true);
    expect(msg).toContain("23.01.26 21:17"); // MSK
  });

  test("formatAlertMessage resolved", () => {
    const msg = formatAlertMessage({
      status: "resolved",
      labels: { alertname: "ServiceDown", severity: "critical", instance: "router:3001" },
      annotations: { summary: "Сервис router:3001 недоступен >1м", description: "Тест" },
      startsAt: "2026-01-23T18:17:26.701Z",
      endsAt: "2026-01-23T18:19:41.701Z",
    });
    expect(msg).toContain("RESOLVED ✅");
    expect(msg).toContain("23.01.26 21:19");
  });
});
