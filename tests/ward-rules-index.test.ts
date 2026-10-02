import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("historical Ward rules index", () => {
  it("uses repository lessons without a private Database store and detects changed or missing inputs", () => {
    const fixture = mkdtempSync(path.join(tmpdir(), "ward-rules-index-"));
    const docs = path.join(fixture, "docs/ward-flow");
    const lessons = path.join(docs, "lessons");
    const script = path.join(root, "scripts/ward-flow/rules-index.mjs");
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [script, ...args], {
        cwd: fixture,
        encoding: "utf8",
        env: { ...process.env, USERPROFILE: fixture, HOME: fixture },
      });
    try {
      // No private store exists. Missing committed input must fail closed.
      expect(run("--check").status).toBe(2);
      mkdirSync(lessons, { recursive: true });
      writeFileSync(path.join(lessons, "README.md"), "# Historical source instructions\n");
      writeFileSync(path.join(lessons, "MEMORY.md"), "# Historical directory index\n");
      writeFileSync(
        path.join(lessons, "lesson.md"),
        "---\ndescription: A stale branch instruction\ntype: lesson\n---\n",
      );
      writeFileSync(
        path.join(lessons, "unclassified.md"),
        "---\ndescription: Unmatched fixture fact\ntype: lesson\n---\n",
      );
      expect(run().status).toBe(0);
      const output = readFileSync(path.join(docs, "RULES.md"), "utf8");
      expect(output).toContain("2 historical lessons");
      expect(output).toContain("not current operational authority");
      expect(output).toContain("docs/ward-flow/lessons");
      expect(output).toContain("Unfiled — 1");
      expect(output).not.toContain("D--Repos-Database/memory");
      expect(run("--check").status).toBe(0);
      writeFileSync(path.join(lessons, "lesson.md"), "---\ndescription: Changed lesson\n---\n");
      expect(run("--check").status).toBe(1);
    } finally {
      rmSync(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
