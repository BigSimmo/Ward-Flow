import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// H-0322: the tsc cache seed and the screenshot folder used to default to a literal
// "D:/Repos/ward-flow-logs" path, so a Mac or Linux checkout made a folder named "D:" in its
// working directory. Both now take the platform-aware default from `logs-root.mjs`, which
// `tests/ward-logs-root.test.ts` pins.
const scripts = ["scripts/ward-flow/gate-tsc.mjs", "scripts/ward-flow/shots.mjs"];

describe("Ward Flow logs folder defaults", () => {
  it.each(scripts)("%s takes its default from wardFlowLogsRoot, never a literal D: path", (file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    expect(source).toMatch(/import \{ wardFlowLogsRoot \} from "\.\/logs-root\.mjs";/);
    expect(source).toContain("wardFlowLogsRoot()");
    expect(source).not.toContain("D:/Repos");
  });
});
