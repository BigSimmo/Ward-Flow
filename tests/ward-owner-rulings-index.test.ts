import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("Ward owner-rulings index", () => {
  it("includes the central decision log and detects later decisions while retaining question provenance", () => {
    const fixture = mkdtempSync(path.join(tmpdir(), "ward-rulings-index-"));
    const docs = path.join(fixture, "docs/ward-flow");
    const script = path.join(root, "scripts/ward-flow/owner-rulings-index.mjs");
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [script, ...args], { cwd: fixture, encoding: "utf8" });
    try {
      mkdirSync(docs, { recursive: true });
      writeFileSync(
        path.join(docs, "decisions.md"),
        "# Decisions\n\n## D-27. Dedicated repository\n\nRecorded decision.\n",
      );
      writeFileSync(path.join(docs, "owner-questions-2026-10-02.md"), "# Questions\n\n## Q-1. Pending answer\n");
      expect(run().status).toBe(0);
      const output = readFileSync(path.join(docs, "OWNER-RULINGS.md"), "utf8");
      expect(output).toContain("`decisions.md`:3");
      expect(output).toContain("D-27");
      expect(output).toContain("Question/proposal source");
      expect(run("--check").status).toBe(0);
      writeFileSync(
        path.join(docs, "decisions.md"),
        "# Decisions\n\n## D-27. Dedicated repository\n\n## D-28. Later recorded decision\n",
      );
      expect(run("--check").status).toBe(1);
    } finally {
      rmSync(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
