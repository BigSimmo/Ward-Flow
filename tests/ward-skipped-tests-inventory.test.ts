import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findSkips } from "../scripts/ward-flow/skipped-tests-inventory.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/ward-flow/skipped-tests-inventory.mjs");

type Skip = { kind: string; title: string; reason: string };

describe("skipped-tests inventory (audit F-54)", () => {
  it("is current: regenerate docs/skipped-tests-inventory.md when a skip, todo or gate changes", () => {
    const result = spawnSync(process.execPath, [script, "--check"], { cwd: root, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
  });

  it("finds real calls and ignores ones written in strings or comments", () => {
    // Written with a SKIP placeholder so this file's own fixture is not read as a retired suite by
    // the guards that scan tests/ for skip calls.
    const source = [
      '// it.SKIP("in a comment", () => {});',
      "const fixture = 'describe.SKIP(\"in a string\", () => {});';",
      'it.todo("a to-do");',
      'it.SKIPIf(process.platform === "win32")("a gate", () => {});',
      'test("x", async ({ page }) => { test.SKIP(isPhone(page), "phone differs"); });',
      'test.describe.SKIP("retired suite", () => {});',
    ]
      .join("\n")
      .replaceAll("SKIP", "skip");
    const found = findSkips("tests/example.test.ts", source) as Skip[];
    expect(found.map((entry) => `${entry.kind}|${entry.title}|${entry.reason}`)).toEqual([
      "it.todo|a to-do|",
      'it.skipIf|a gate|skipped when `process.platform === "win32"`',
      "test.skip at run time||when `isPhone(page)`: phone differs",
      "test.describe.skip|retired suite|",
    ]);
  });
});
