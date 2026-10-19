import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("client secret diagnostics", () => {
  it("fails when a tracked source cannot be read instead of reporting a clean scan", () => {
    const root = mkdtempSync(join(tmpdir(), "ward-secret-unreadable-"));
    try {
      mkdirSync(join(root, "scripts"));
      mkdirSync(join(root, "src"));
      cpSync("scripts/check-client-bundle-secrets.mjs", join(root, "scripts/check-client-bundle-secrets.mjs"));
      writeFileSync(join(root, "src/missing.ts"), "export const safe = true;\n");
      execFileSync("git", ["init", "--quiet"], { cwd: root });
      execFileSync("git", ["add", "src/missing.ts"], { cwd: root });
      rmSync(join(root, "src/missing.ts"));
      const result = spawnSync(process.execPath, ["scripts/check-client-bundle-secrets.mjs"], {
        cwd: root,
        encoding: "utf8",
        timeout: 10_000,
      });
      expect(result.status).toBe(1);
      expect(result.stdout).not.toContain("Clean:");
      expect(result.stderr).toContain("src/missing.ts [unable to read tracked source]");
      expect(result.stderr).toContain("1 tracked source files unreadable");
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("reports source-pattern coverage and retains deliberate synthetic exceptions", () => {
    const root = mkdtempSync(join(tmpdir(), "ward-secret-scope-"));
    const invented = "sk-" + "inventedScopeFixture1234567890";
    try {
      mkdirSync(join(root, "scripts"));
      mkdirSync(join(root, "src"));
      cpSync("scripts/check-client-bundle-secrets.mjs", join(root, "scripts/check-client-bundle-secrets.mjs"));
      writeFileSync(join(root, "src/safe.ts"), `export const safe = "${invented}"; // synthetic-only\n`);
      writeFileSync(join(root, "src/synthetic-data-guard.ts"), `export const pattern = "${invented}";\n`);
      writeFileSync(join(root, "src/secret-guard.ts"), `export const pattern = "${invented}";\n`);
      execFileSync("git", ["init", "--quiet"], { cwd: root });
      execFileSync("git", ["add", "src"], { cwd: root });
      const result = spawnSync(process.execPath, ["scripts/check-client-bundle-secrets.mjs"], {
        cwd: root,
        encoding: "utf8",
        timeout: 10_000,
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(
        "1 tracked source files scanned for known credential patterns; 2 synthetic guard files excluded",
      );
      expect(result.stdout).toContain("Built bundles were not scanned");
      expect(result.stdout).not.toContain("Zero exposed secrets");
      expect(result.stdout + result.stderr).not.toContain(invented);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("rejects an invented credential without repeating its value in either output stream", () => {
    const root = mkdtempSync(join(tmpdir(), "ward-secret-redaction-"));
    const invented = "sk-" + "inventedRedactionFixture1234567890";
    try {
      mkdirSync(join(root, "scripts"));
      mkdirSync(join(root, "src"));
      cpSync("scripts/check-client-bundle-secrets.mjs", join(root, "scripts/check-client-bundle-secrets.mjs"));
      writeFileSync(join(root, "src/leak.ts"), `export const accidentallyExposed = "${invented}";\n`);
      execFileSync("git", ["init", "--quiet"], { cwd: root });
      execFileSync("git", ["add", "src/leak.ts"], { cwd: root });
      const result = spawnSync(process.execPath, ["scripts/check-client-bundle-secrets.mjs"], {
        cwd: root,
        encoding: "utf8",
        timeout: 10_000,
      });
      expect(result.status).toBe(1);
      const output = result.stdout + result.stderr;
      expect(output).toContain("src/leak.ts:1");
      expect(output).toContain("OpenAI Secret Key");
      expect(output).not.toContain(invented);
      expect(output).not.toContain("inventedRedactionFixture");
      expect(output).not.toContain("accidentallyExposed");
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
