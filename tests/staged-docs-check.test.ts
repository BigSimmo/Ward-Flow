import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { checkStagedDocs, selectedDocChecks } from "../scripts/check-staged-docs.mjs";
import { removePathSync } from "../scripts/retryable-fs.mjs";
const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) removePathSync(root, { recursive: true });
});
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "ward-staged-docs-"));
  roots.push(root);
  execFileSync("git", ["init"], { cwd: root });
  mkdirSync(path.join(root, "scripts"));
  mkdirSync(path.join(root, "docs"));
  writeFileSync(path.join(root, "scripts/update-docs-inventory.mjs"), "process.exit(0);");
  writeFileSync(path.join(root, "docs/scripts-index.md"), "staged output");
  execFileSync("git", ["add", "scripts/update-docs-inventory.mjs", "docs/scripts-index.md"], { cwd: root });
  return root;
}
it("triggers lessons only from lessons, output or generator inputs", () => {
  expect(selectedDocChecks(["docs/ward-flow/lessons/a.md"], true)).toContain("scripts/ward-flow/rules-index.mjs");
  expect(selectedDocChecks(["src/components/ward-management/board.tsx"], true)).toEqual([]);
});
it("checks each mandatory generator and its shared input helper", () => {
  for (const name of ["screen-map", "rules-index", "owner-rulings-index", "mockup-manifest", "screen-verification"]) {
    expect(selectedDocChecks([`scripts/ward-flow/${name}.mjs`], true)).toContain(`scripts/ward-flow/${name}.mjs`);
  }
  expect(selectedDocChecks(["scripts/ward-flow/screen-verification-lib.mjs"], true)).toContain(
    "scripts/ward-flow/screen-verification.mjs",
  );
});
it("selects maintained architecture checks for the checker and tracked design roots", () => {
  for (const file of ["scripts/check-codebase-index-coverage.mjs", ".design/brief.md", "design/figma/tokens.json"])
    expect(selectedDocChecks([file])).toContain("scripts/check-codebase-index-coverage.mjs");
});
it("checks staged generation inputs and leaves dirty output untouched", () => {
  const root = fixture();
  writeFileSync(path.join(root, "scripts/update-docs-inventory.mjs"), "process.exit(9);");
  writeFileSync(path.join(root, "docs/scripts-index.md"), "other session's dirty output");
  expect(checkStagedDocs({ root, strict: true })).toBe(0);
  expect(readFileSync(path.join(root, "docs/scripts-index.md"), "utf8")).toBe("other session's dirty output");
});
it("reports failed generation as advisory or blocked, never synchronized", () => {
  const root = fixture();
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const run = () => ({ status: 1, stderr: "fixture failure", stdout: "" });
  expect(checkStagedDocs({ root, strict: false, run })).toBe(0);
  expect(checkStagedDocs({ root, strict: true, run })).toBe(1);
  expect(log.mock.calls.flat().join(" ")).not.toContain("passed");
});
