import { mkdtempSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { afterEach, expect, it } from "vitest";
import { removePathSync } from "../scripts/retryable-fs.mjs";
import {
  changedFormatFiles,
  changedFormatPaths,
  formatPolicyChanged,
  partialStagedFiles,
  validateFormatPaths,
  isPrettierPolicyFile,
  main,
} from "../scripts/check-format-changed.mjs";
import { prettierCheckArguments } from "../scripts/ward-ci-public/changed-checks.mjs";
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) removePathSync(root, { recursive: true });
});
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "ward-format-"));
  roots.push(root);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  git("init");
  git("config", "user.email", "synthetic@example.invalid");
  git("config", "user.name", "Synthetic");
  writeFileSync(path.join(root, "space name.md"), "first\n");
  git("add", "space name.md");
  git("-c", "core.hooksPath=", "commit", "-m", "fixture");
  return { root, git };
}
it("rejects absolute, traversal and option paths", () => {
  for (const file of ["../other.md", "C:/outside.md", "--config", "a\0b"])
    expect(() => validateFormatPaths([file])).toThrow();
});
it("preserves spaces, includes new candidates and excludes deletions", () => {
  const { root, git } = fixture();
  writeFileSync(path.join(root, "space name.md"), "second\n");
  writeFileSync(path.join(root, "new note.md"), "new\n");
  expect(changedFormatFiles(root, "HEAD").sort()).toEqual(["new note.md", "space name.md"]);
  git("rm", "-f", "space name.md");
  expect(changedFormatFiles(root, "HEAD")).toEqual(["new note.md"]);
});
it("detects partially staged input before rewriting it", () => {
  const { root, git } = fixture();
  writeFileSync(path.join(root, "space name.md"), "staged\n");
  git("add", "space name.md");
  writeFileSync(path.join(root, "space name.md"), "unstaged\n");
  expect(partialStagedFiles(root, ["space name.md"])).toEqual(["space name.md"]);
  return expect(main(["--write", "--files", "space name.md"], root)).rejects.toThrow("partially staged");
});
it("requires explicit file ownership scope for write mode", () =>
  expect(main(["--write"])).rejects.toThrow("exact owned paths"));
it("checks all verdicts on formatter config drift without granting directory writes", () => {
  const { root } = fixture();
  writeFileSync(path.join(root, "package.json"), '{"prettier":{"semi":true}}');
  expect(isPrettierPolicyFile("package.json", root)).toBe(true);
  expect(() => validateFormatPaths(["."], root)).toThrow();
});
it("keeps deleted config as policy impact in local and CI checks", () => {
  const { root, git } = fixture();
  writeFileSync(path.join(root, ".prettierrc"), '{"tabWidth":4}');
  git("add", ".prettierrc");
  git("-c", "core.hooksPath=", "commit", "-m", "policy");
  git("rm", ".prettierrc");
  expect(changedFormatFiles(root, "HEAD")).toEqual([]);
  expect(changedFormatPaths(root, "HEAD")).toEqual([".prettierrc"]);
  expect(formatPolicyChanged(changedFormatPaths(root, "HEAD"), root, "HEAD")).toBe(true);
  expect(prettierCheckArguments([".prettierrc"], { projectRoot: root, base: "HEAD" })).toEqual([
    "--check",
    "--ignore-unknown",
    ".",
  ]);
});
it("checks existing files when package formatting policy is removed", () => {
  const { root, git } = fixture();
  writeFileSync(path.join(root, "package.json"), '{"prettier":{"semi":false}}');
  git("add", "package.json");
  git("-c", "core.hooksPath=", "commit", "-m", "package policy");
  writeFileSync(path.join(root, "package.json"), "{}");
  expect(isPrettierPolicyFile("package.json", root)).toBe(false);
  expect(formatPolicyChanged(["package.json"], root, "HEAD")).toBe(true);
  expect(prettierCheckArguments(["package.json"], { projectRoot: root, base: "HEAD" })).toEqual([
    "--check",
    "--ignore-unknown",
    ".",
  ]);
});
