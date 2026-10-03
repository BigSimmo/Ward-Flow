import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, expect, it } from "vitest";
import { stagedSourceTree } from "../scripts/staged-source-tree.mjs";
import { removePathSync } from "../scripts/retryable-fs.mjs";
import { runTypecheck } from "../scripts/pre-commit-checks.mjs";
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) removePathSync(root, { recursive: true });
});
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "ward-index-fixture-"));
  roots.push(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  git("init");
  git("config", "user.email", "synthetic@example.invalid");
  git("config", "user.name", "Synthetic");
  for (const file of ["root.ts", "dependency.ts", "tsconfig.json"])
    writeFileSync(path.join(root, file), "staged version");
  git("add", "root.ts", "dependency.ts", "tsconfig.json");
  return { root, git };
}
it("takes imported sources and config from index, excluding working fixes and scratch", () => {
  const { root } = fixture();
  writeFileSync(path.join(root, "dependency.ts"), "unstaged fix");
  writeFileSync(path.join(root, "tsconfig.json"), "unstaged config");
  writeFileSync(path.join(root, "scratch.ts"), "untracked fix");
  const tree = stagedSourceTree(root);
  try {
    expect(readFileSync(path.join(tree.root, "dependency.ts"), "utf8")).toBe("staged version");
    expect(readFileSync(path.join(tree.root, "tsconfig.json"), "utf8")).toBe("staged version");
    expect(existsSync(path.join(tree.root, "scratch.ts"))).toBe(false);
  } finally {
    tree.cleanup();
  }
  expect(existsSync(tree.root)).toBe(false);
});
it("does not resurrect staged deletions even if recreated on disk", () => {
  const { root, git } = fixture();
  git("rm", "--cached", "-f", "dependency.ts");
  const tree = stagedSourceTree(root);
  try {
    expect(existsSync(path.join(tree.root, "dependency.ts"))).toBe(false);
  } finally {
    tree.cleanup();
  }
});
function compilerFixture(dependency: string) {
  const { root, git } = fixture();
  symlinkSync(path.join(process.cwd(), "node_modules"), path.join(root, "node_modules"), "junction");
  writeFileSync(
    path.join(root, "root.ts"),
    'import { value } from "./dependency"; const result: string = value; export {result};',
  );
  writeFileSync(path.join(root, "dependency.ts"), dependency);
  writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { strict: true, skipLibCheck: true, types: [], ignoreDeprecations: "6.0" },
      include: ["*.ts"],
    }),
  );
  git("add", "root.ts", "dependency.ts", "tsconfig.json");
  return { root, git };
}
it("rejects index-broken dependencies even when disk fixes them", async () => {
  const { root } = compilerFixture("export const value = 1;");
  writeFileSync(path.join(root, "dependency.ts"), 'export const value = "disk fix";');
  const result = await runTypecheck(root, ["root.ts"]);
  expect(result.problems?.some((problem: string) => problem.includes("TS2322"))).toBe(true);
});
it("accepts index-good dependencies even when disk breaks them", async () => {
  const { root } = compilerFixture('export const value = "staged";');
  writeFileSync(path.join(root, "dependency.ts"), "export const value = 1;");
  expect((await runTypecheck(root, ["root.ts"])).problems).toEqual([]);
});
it("rejects a missing staged import even if an untracked rescue exists", async () => {
  const { root, git } = compilerFixture('export const value = "staged";');
  git("rm", "--cached", "-f", "dependency.ts");
  expect((await runTypecheck(root, ["root.ts"])).problems?.some((problem: string) => problem.includes("TS2307"))).toBe(
    true,
  );
});
it("uses staged aliases and ambient declarations", async () => {
  const { root, git } = compilerFixture('export const value: WardValue = "staged";');
  writeFileSync(path.join(root, "globals.d.ts"), "type WardValue = string;");
  writeFileSync(
    path.join(root, "root.ts"),
    'import { value } from "@ward/dependency"; export const result: string = value;',
  );
  writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { strict: true, skipLibCheck: true, types: [], paths: { "@ward/*": ["./*"] } },
      include: ["*.ts"],
    }),
  );
  git("add", "root.ts", "globals.d.ts", "tsconfig.json");
  writeFileSync(path.join(root, "tsconfig.json"), "broken disk config");
  expect((await runTypecheck(root, ["root.ts"])).problems).toEqual([]);
});
it("rejects broken staged config even when disk replaces it", async () => {
  const { root, git } = compilerFixture('export const value = "staged";');
  writeFileSync(path.join(root, "tsconfig.json"), "{ malformed");
  git("add", "tsconfig.json");
  writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { types: [] }, include: ["*.ts"] }),
  );
  expect((await runTypecheck(root, ["root.ts"])).problems?.length).toBeGreaterThan(0);
});
