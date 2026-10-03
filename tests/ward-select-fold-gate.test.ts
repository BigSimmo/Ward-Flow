import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { removePathSync } from "../scripts/retryable-fs.mjs";
import { selectFoldGate } from "../scripts/ward-flow/select-fold-gate.mjs";
describe("Ward fold gate follows public scope contracts", () => {
  it("does not approve READY or run a fake FULL from related tests on a merged source snapshot", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ward-ready-proof-"));
    const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
    try {
      git("init", "-q", "-b", "main");
      git("config", "user.name", "Synthetic fixture");
      git("config", "user.email", "fixture@example.invalid");
      writeFileSync(path.join(root, "README.md"), "synthetic base");
      git("add", "README.md");
      git("commit", "-q", "-m", "fixture base");
      git("checkout", "-q", "-b", "fixture-source");
      writeFileSync(path.join(root, "source.ts"), "export const fixture=1;");
      git("add", "source.ts");
      git("commit", "-q", "-m", "fixture source");
      const result = spawnSync(
        process.execPath,
        [path.resolve("scripts/ward-flow/ready-check.mjs"), "--onto", "main"],
        { cwd: root, encoding: "utf8", env: { ...process.env, WARD_FOLD_TEST_FIXTURE: "1" }, timeout: 10000 },
      );
      expect(result.status).toBe(75);
      expect(result.stdout + result.stderr).toContain("Related tests cannot satisfy it");
      expect(result.stdout + result.stderr).toContain("RETIRED broad READY route");
      expect(result.stdout + result.stderr).toContain("npm run verify:pr-local");
      expect(result.stdout + result.stderr).not.toContain("PASSED");
    } finally {
      removePathSync(root, { recursive: true });
    }
  });
  it("requires maintained policy contracts without engine/browser work", () =>
    expect(selectFoldGate(["AGENTS.md", "docs/ward-flow/README.md"])).toMatchObject({
      tier: "static",
      policy: true,
      installation: true,
      typecheck: false,
      journeys: false,
    }));
  it("keeps known Ward prose static without pretending unknown policy is prose", () => {
    expect(selectFoldGate(["docs/ward-flow/README.md"])).toMatchObject({
      tier: "static",
      policy: false,
      installation: false,
    });
    expect(selectFoldGate(["src/components/ward-management/CLAUDE.md"])).toMatchObject({
      tier: "full",
      journeys: true,
    });
  });
  it("keeps tooling and configuration conservative", () =>
    expect(selectFoldGate(["scripts/ward-flow/trial-merge.mjs", "tests/ward-trial-merge.test.ts"])).toMatchObject({
      tier: "full",
      typecheck: true,
      journeys: true,
    }));
  it("requires source/browser scope for a Ward screen", () =>
    expect(selectFoldGate(["src/components/ward-management/alerts/alerts-screen.tsx"])).toMatchObject({
      tier: "full",
      typecheck: true,
      journeys: true,
    }));
  it("does not claim screen CSS is globally isolated", () =>
    expect(selectFoldGate(["src/components/ward-management/alerts/alerts-screen.module.css"])).toMatchObject({
      tier: "full",
      journeys: true,
    }));
  it("requires FULL for shared engine and discovery", () => {
    for (const file of [
      "src/components/ward-management/ward-flow-reducer.ts",
      "vitest.config.mts",
      "scripts/check-ward-expected-reds.mjs",
      "src/unknown.ts",
    ])
      expect(selectFoldGate([file]).tier).toBe("full");
  });
  it("keeps a mixed maintained policy/tooling batch broad", () =>
    expect(selectFoldGate(["AGENTS.md", "scripts/ward-flow/ready-check.mjs"])).toMatchObject({
      tier: "full",
      policy: false,
      journeys: true,
    }));
  it("fails closed for deletion, rename and empty/unknown changes", () => {
    for (const changes of [
      [{ status: "D", path: "docs/ward-flow/old.md" }],
      [{ status: "R100", path: "README.md" }],
      [],
    ])
      expect(selectFoldGate(changes)).toMatchObject({ tier: "full", typecheck: true, journeys: true });
  });
  it("keeps backend and isolated unit test coverage aligned with public jobs", () => {
    expect(selectFoldGate(["backend/ward-flow/backend.test.mjs"])).toMatchObject({
      tier: "static",
      backend: true,
      installation: true,
      typecheck: false,
      journeys: false,
    });
    expect(selectFoldGate(["tests/ward-trial-merge.test.ts"])).toMatchObject({
      tier: "full",
      typecheck: true,
      journeys: false,
    });
  });
});
