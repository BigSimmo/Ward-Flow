import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("client secret diagnostics", () => {
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
      rmSync(root, { recursive: true, force: true });
    }
  });
});
