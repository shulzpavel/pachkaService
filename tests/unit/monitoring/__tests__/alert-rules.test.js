import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const rulesPath = path.join(repoRoot, "monitoring/alert.rules.yml");

describe("alert.rules.yml", () => {
  it("defines Http404Detected with clear context labels", () => {
    const content = readFileSync(rulesPath, "utf8");

    expect(content).toContain("alert: Http404Detected");
    expect(content).toContain('status="404"');
    expect(content).toContain('path="/jira/webhook"');
    expect(content).toContain(
      "summary: '404 на webhook: {{ $labels.method }} {{ $labels.path }}'"
    );
    expect(content).toContain(
      "service={{ $labels.service }}, method={{ $labels.method }}, path={{ $labels.path }}"
    );
  });
});
