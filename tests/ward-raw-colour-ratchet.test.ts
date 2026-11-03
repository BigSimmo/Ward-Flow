import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Q375 (3 Nov 2026): docs/design/DESIGN-SYSTEM.md is the design system of record and colour values
 * live only in src/app/ward-flow-v9-tokens.css. This keeps the raw-colour ratchet running in CI, so
 * no screen stylesheet can gain a raw hex, rgb() or hsl() colour.
 */
const SCRIPT = join(process.cwd(), "scripts/ward-flow/check-raw-colour.mjs");

describe("the raw-colour ratchet", () => {
  it("runs and finds no screen stylesheet with more raw colours than its baseline", () => {
    let status = 0;
    let output = "";
    try {
      output = execFileSync(process.execPath, [SCRIPT], { encoding: "utf8" });
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      status = failure.status ?? -1;
      output = `${failure.stdout ?? ""}${failure.stderr ?? ""}`;
    }
    expect(status, output).toBe(0);
    expect(output).toContain("Not risen in any file");
  });
});
