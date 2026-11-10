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
      "test.skip at run time|x|when `isPhone(page)`: phone differs",
      "test.describe.skip|retired suite|",
    ]);
  });

  it("names the real suite, the enclosing test and indirect registrations", () => {
    const source = [
      "function gated(name: string, body: () => void) {",
      '  describe.SKIPIf(process.platform === "win32")(name, body);',
      "}",
      'gated("hook suite", () => {});',
      'test("light", async ({ page }) => { test.SKIP(isPhone(page), "phone differs"); });',
      'test("dark", async ({ page }) => { test.SKIP(isPhone(page), "phone differs"); });',
      '(slow ? it.SKIP : it)("a slow case", () => {});',
      "function helper(name: string, options: { SKIP?: boolean }) {",
      "  (options.SKIP ? it.SKIP : it)(name, () => {});",
      "}",
      'helper("one", {});',
      'helper("two", { SKIP: true });',
    ]
      .join("\n")
      .replaceAll("SKIP", "skip");
    const found = findSkips("tests/example.test.ts", source) as Skip[];
    expect(found.map((entry) => `${entry.kind}|${entry.title}|${entry.reason}`)).toEqual([
      'describe.skipIf|hook suite (via gated)|skipped when `process.platform === "win32"`',
      "test.skip at run time|light|when `isPhone(page)`: phone differs",
      "test.skip at run time|dark|when `isPhone(page)`: phone differs",
      "it.skip by condition|a slow case|when `slow`",
      "it.skip by condition|`name` of each helper(…) call (2 in this file)|when `options.skip`",
    ]);
  });

  it("parses a .ts file as TypeScript, not TSX, so an angle-bracket cast does not hide a skip", () => {
    const source = ["const value = <string>raw;", 'it.todo("after a cast");'].join("\n");
    const found = findSkips("tests/example.test.ts", source) as Skip[];
    expect(found.map((entry) => `${entry.kind}|${entry.title}`)).toEqual(["it.todo|after a cast"]);
  });
});
