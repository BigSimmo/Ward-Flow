// D-123 item 3 / audit M131: a removed or loosened assertion in a protected safety test fails CI
// unless the pull request carries Josh's approval line.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  APPROVAL_PREFIX,
  LIST_PATH,
  assessProtectedFile,
  evaluate,
  findApproval,
  measureTestSource,
  parseProtectedList,
} from "../scripts/ward-flow/check-protected-safety-tests.mjs";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..");

const SAFETY_SPEC = [
  'import { describe, expect, it } from "vitest";',
  'describe("guard", () => {',
  '  it("keeps the bed on the right patient", () => {',
  "    expect(1).toBe(1);",
  "    expect(2).toBe(2);",
  "  });",
  '  it("refuses a stale save", () => {',
  "    expect(3).toBe(3);",
  "  });",
  "});",
  "",
].join("\n");

describe("measureTestSource", () => {
  it("counts cases, assertions and disabling markers from the AST", () => {
    expect(measureTestSource(SAFETY_SPEC)).toEqual({ cases: 2, assertions: 3, disabled: 0 });
  });

  it("treats a commented-out assertion as removed", () => {
    const loosened = SAFETY_SPEC.replace("    expect(2).toBe(2);", "    // expect(2).toBe(2);");
    expect(measureTestSource(loosened).assertions).toBe(2);
  });

  it("counts assert calls and a newly skipped case", () => {
    const source = 'import assert from "node:assert";\nit.skip("a", () => { assert.equal(1, 1); });';
    expect(measureTestSource(source)).toEqual({ cases: 1, assertions: 1, disabled: 1 });
  });
});

describe("assessProtectedFile", () => {
  const before = { cases: 2, assertions: 3, disabled: 0 };

  it("passes an unchanged or strengthened file", () => {
    expect(assessProtectedFile("tests/a.test.ts", before, before)).toEqual([]);
    expect(assessProtectedFile("tests/a.test.ts", before, { cases: 3, assertions: 5, disabled: 0 })).toEqual([]);
  });

  it("fails a removed assertion, a removed case, a new skip and a deletion", () => {
    expect(assessProtectedFile("tests/a.test.ts", before, { ...before, assertions: 2 })).toHaveLength(1);
    expect(assessProtectedFile("tests/a.test.ts", before, { ...before, cases: 1 })).toHaveLength(1);
    expect(assessProtectedFile("tests/a.test.ts", before, { ...before, disabled: 1 })).toHaveLength(1);
    expect(assessProtectedFile("tests/a.test.ts", before, null)).toHaveLength(1);
  });
});

describe("findApproval", () => {
  it("accepts Josh's approval line with a reason, in a commit message or PR body", () => {
    expect(findApproval([`fix(ward): x\n\n${APPROVAL_PREFIX} retired with the old bed board`])).toBe(
      "retired with the old bed board",
    );
    expect(findApproval(["", `- ${APPROVAL_PREFIX}: duplicate of the matrix test`])).toBe(
      "duplicate of the matrix test",
    );
  });

  it("refuses a bare marker, another approver or no marker", () => {
    expect(findApproval([APPROVAL_PREFIX])).toBeNull();
    expect(findApproval(["Protected-test-change: approved by Jane because she said so"])).toBeNull();
    expect(findApproval(["test: tidy assertions"])).toBeNull();
  });
});

describe("the committed protected list", () => {
  it("names existing safety test files", () => {
    const files = parseProtectedList(readFileSync(path.join(REPOSITORY_ROOT, LIST_PATH), "utf8"));
    expect(files.length).toBeGreaterThanOrEqual(12);
    for (const file of files) expect(existsSync(path.join(REPOSITORY_ROOT, file)), file).toBe(true);
  });
});

describe("evaluate against a real git history", () => {
  let root = "";
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "user.name=Synthetic", "-c", "user.email=synthetic@example.invalid", ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const write = (file: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  };
  const list = (...files: string[]) => JSON.stringify({ files: files.map((file) => ({ path: file })) });

  function seed() {
    root = mkdtempSync(path.join(os.tmpdir(), "ward-protected-tests-"));
    git("init", "--quiet", "--initial-branch=main");
    write(LIST_PATH, list("tests/ward-guard.test.ts", "tests/ward-other.test.ts"));
    write("tests/ward-guard.test.ts", SAFETY_SPEC);
    write("tests/ward-other.test.ts", SAFETY_SPEC);
    git("add", "--", LIST_PATH, "tests/ward-guard.test.ts", "tests/ward-other.test.ts");
    git("commit", "--quiet", "-m", "base");
    return git("rev-parse", "HEAD");
  }

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = "";
  });

  it("passes an untouched protected list", () => {
    const base = seed();
    expect(evaluate({ base, root }).problems).toEqual([]);
  });

  it("fails a loosened assertion until the approval line is committed", () => {
    const base = seed();
    write("tests/ward-guard.test.ts", SAFETY_SPEC.replace("    expect(2).toBe(2);\n", ""));
    git("commit", "--quiet", "-am", "test: tidy");

    const blocked = evaluate({ base, root });
    expect(blocked.problems).toEqual(["tests/ward-guard.test.ts: assertions 3 -> 2"]);
    expect(blocked.approval).toBeNull();

    git(
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      `chore: record approval\n\n${APPROVAL_PREFIX} merged into one check`,
    );
    expect(evaluate({ base, root }).approval).toBe("merged into one check");
  });

  it("still guards a file dropped from the list in the same change", () => {
    const base = seed();
    write(LIST_PATH, list("tests/ward-guard.test.ts"));
    write("tests/ward-other.test.ts", SAFETY_SPEC.replace(/ {2}it\("refuses[\s\S]*?\n {2}\}\);\n/u, ""));
    git("commit", "--quiet", "-am", "test: drop");

    const { problems } = evaluate({ base, root });
    expect(problems).toContain(`tests/ward-other.test.ts: dropped from ${LIST_PATH}`);
    expect(problems).toContain("tests/ward-other.test.ts: test cases 2 -> 1");
  });

  it("accepts the approval line from the pull request body", () => {
    const base = seed();
    rmSync(path.join(root, "tests/ward-other.test.ts"));
    const result = evaluate({ base, root, extraTexts: [`Why:\n${APPROVAL_PREFIX} replaced by ward-guard`] });
    expect(result.problems).toEqual(["tests/ward-other.test.ts: protected test file deleted or renamed away"]);
    expect(result.approval).toBe("replaced by ward-guard");
  });
});
