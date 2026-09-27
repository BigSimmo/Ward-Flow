import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Exercise the real CLI on synthetic staged content, with sentinels for costly tool startup.
const checker = path.resolve(__dirname, "../scripts/pre-commit-checks.mjs");
function runHook(block: "secret" | "overlap" | "unsigned" | "none" | "lint") {
  const root = mkdtempSync(path.join(tmpdir(), "ward-precommit-fast-"));
  const write = (file: string, content: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  };
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, timeout: 10000, stdio: "pipe" });
  git("init", "--quiet", "--initial-branch=ward/fixture");
  git(
    "-c",
    "core.hooksPath=.git/hooks",
    "-c",
    "user.name=Ward Test",
    "-c",
    "user.email=ward@example.invalid",
    "commit",
    "--allow-empty",
    "--quiet",
    "-m",
    "fixture",
  );
  write("package.json", '{"type":"module"}');
  copyFileSync(checker, path.join(root, "checker.mjs"));
  const blocked = !["none", "lint"].includes(block);
  const source = block === "unsigned" ? "tests/ward-fixture.ts" : blocked ? "source.ts" : "source.js";
  write(source, block === "lint" ? "// lint rejection\n" : "export const fixture = 1;\n");
  if (block === "secret") write(".env", ""); // No real credential is needed to exercise the path guard.
  git("add", "--", source, ...(block === "secret" ? [".env"] : []));
  // A clean working copy must not hide the error in the staged snapshot.
  if (block === "lint") write(source, "export const fixture = 1;\n");
  write(
    "sign-out.md",
    "## Active sign-outs\n" +
      (block === "overlap" ? `- 2026-09-27 | Other owner | ward/other | D:/fixture-other | ${source}\n` : ""),
  );
  write("node_modules/eslint/package.json", '{"main":"index.cjs"}');
  write(
    "node_modules/eslint/index.cjs",
    `
    require("node:fs").writeFileSync("lint-started", "yes");
    exports.ESLint = class {
      async isPathIgnored() { return false; }
      async lintText(text) { return [{ messages: text.includes("lint rejection")
        ? [{severity: 2, line: 1, column: 1, message: "staged lint rejection", ruleId: "fixture"}] : [] }]; }
    };
  `,
  );
  write("node_modules/typescript/package.json", '{"main":"index.cjs"}');
  write(
    "node_modules/typescript/index.cjs",
    `
    require("node:fs").writeFileSync("types-started", "yes");
    throw new Error("type checker must not start for a rejected commit");
  `,
  );
  const result = spawnSync(process.execPath, ["checker.mjs"], {
    cwd: root,
    encoding: "utf8",
    timeout: 15000,
    env: {
      ...process.env,
      WARD_SIGNOUT_FILE: path.join(root, "sign-out.md"),
      SKIP_SIGNOUT_GUARD: "0",
      SKIP_PRECOMMIT_LINT: "0",
      SKIP_PRECOMMIT_TYPECHECK: "0",
    },
  });
  expect(result.error).toBeUndefined();
  return {
    code: result.status,
    output: result.stderr,
    lintStarted: existsSync(path.join(root, "lint-started")),
    typesStarted: existsSync(path.join(root, "types-started")),
  };
}

describe("pre-commit fail-fast admission", () => {
  it.each(["secret", "overlap", "unsigned"] as const)("stops before costly checks after %s rejection", (reason) => {
    const result = runHook(reason);
    expect(result.code).toBe(1);
    expect(result.output).toContain("BLOCKED:");
    expect(result.lintStarted).toBe(false);
    expect(result.typesStarted).toBe(false);
    expect(result.output).toContain("lint and typecheck not run");
  });
  it("still lints and accepts a clean staged change", () => {
    const result = runHook("none");
    expect(result.lintStarted).toBe(true);
    expect(result.code, result.output).toBe(0);
  });
  it("still rejects staged lint errors when the working file is clean", () => {
    const result = runHook("lint");
    expect(result.lintStarted).toBe(true);
    expect(result.code).toBe(1);
    expect(result.output).toContain("staged lint rejection");
  });
});
