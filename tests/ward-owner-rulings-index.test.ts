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

  it("keeps hyphen-numbered IDs whole, parses numbered questions, and separates within-file repeats", () => {
    const fixture = mkdtempSync(path.join(tmpdir(), "ward-rulings-index-"));
    const docs = path.join(fixture, "docs/ward-flow");
    const script = path.join(root, "scripts/ward-flow/owner-rulings-index.mjs");
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [script, ...args], { cwd: fixture, encoding: "utf8" });
    try {
      mkdirSync(docs, { recursive: true });
      writeFileSync(
        path.join(docs, "decisions.md"),
        "# Decisions\n\n## D9-1 — First\n\n## D9-2 — Second\n\n## Q-8 — Item\n\n## Q-8 scope limit\n",
      );
      writeFileSync(path.join(docs, "owner-rulings-a.md"), "# A\n\n## Z-1 — Shared token\n");
      writeFileSync(path.join(docs, "owner-rulings-b.md"), "# B\n\n## Z-1 — Shared token again\n");
      writeFileSync(
        path.join(docs, "owner-open-questions-x.md"),
        "# Open\n\n| # | Question |\n| --- | --- |\n| 1 | First question |\n| 2 | Second question |\n",
      );
      writeFileSync(path.join(docs, "owner-question-y.md"), "# Letter\n\n**1. Should it exist?** Prose.\n");
      const result = run();
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("(0 unparsed)");
      const output = readFileSync(path.join(docs, "OWNER-RULINGS.md"), "utf8");
      expect(output).toContain("`D9-1` — line 3");
      expect(output).toContain("`D9-2` — line 5");
      expect(output).not.toContain("`D9` ");
      expect(output).toContain("more than one file for 1 ID(s)");
      expect(output).toContain("A further 1 ID(s) recur inside a single file only");
      expect(output).toContain("#2 (no owner-issued ID, this file's own numbering) — line 6, table row");
      expect(output).toContain('numbered paragraph: "Should it exist?"');
      expect(run("--check").status).toBe(0);
    } finally {
      rmSync(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
