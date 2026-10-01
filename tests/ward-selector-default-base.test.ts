import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("Ward selectors use the dedicated repository base", () => {
  for (const name of ["select-fold-gate.mjs", "select-journeys.mjs"]) {
    it(`${name} uses origin/main, preserves an explicit base and fails on a missing base`, () => {
      const fixture = mkdtempSync(path.join(tmpdir(), "ward-selector-base-"));
      const git = (...args: string[]) =>
        execFileSync("git", ["-c", "core.hooksPath=", ...args], { cwd: fixture, stdio: "pipe" });
      try {
        mkdirSync(path.join(fixture, "scripts/ward-flow"), { recursive: true });
        mkdirSync(path.join(fixture, "src"));
        mkdirSync(path.join(fixture, "tests"));
        const script = path.join(fixture, "scripts/ward-flow", name);
        writeFileSync(script, readFileSync(path.join(root, "scripts/ward-flow", name)));
        writeFileSync(path.join(fixture, "README.md"), "Synthetic fixture\n");
        git("init", "-b", "main");
        git("add", "--", "scripts", "README.md");
        git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture base");
        git("update-ref", "refs/remotes/origin/main", "HEAD");
        git("switch", "-c", "codex/fixture");
        writeFileSync(path.join(fixture, "README.md"), "Synthetic fixture changed\n");
        git("add", "--", "README.md");
        git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture docs");
        const run = (...args: string[]) =>
          spawnSync(process.execPath, [script, ...args], { cwd: fixture, encoding: "utf8" });
        const defaultRun = run();
        const explicitRun = run("--base", "origin/main");
        expect(defaultRun.status, defaultRun.stderr).toBe(0);
        expect(defaultRun.stdout).toBe(explicitRun.stdout);
        expect(run("--base", "main").status).toBe(0);
        const missing = run("--base", "missing-base");
        expect(missing.status).not.toBe(0);
        expect(missing.stderr).toContain("Cannot compare Ward Flow refs");
      } finally {
        rmSync(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    });
  }
});
