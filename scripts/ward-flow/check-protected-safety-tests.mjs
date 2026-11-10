#!/usr/bin/env node
/**
 * Protected safety tests (D-123 item 3, audit M131).
 *
 * The test-deletion guard (scripts/check-diff-integrity.mjs) is advisory under prototype mode.
 * For the named files in scripts/ward-flow/protected-safety-tests.json this check is not: it
 * fails when a pull request, against its base,
 *
 *   - deletes a protected file or renames it away,
 *   - lowers its test-case count,
 *   - lowers its assertion count (`expect…` / `assert…` calls, counted from the AST, so a
 *     commented-out assertion counts as removed),
 *   - adds a skip, todo or fixme (`test.skip`, `it.todo`, `describe.skipIf`, …), or
 *   - drops a file from the protected list,
 *
 * unless a commit message in the pull request, or the pull request body, carries a line
 *
 *   Protected-test-change: approved by Josh <reason>
 *
 * A PR body edit does not start a new CI run, so put the line in a commit message (or re-run
 * the job after editing the body). Counts cannot see a weakened matcher (`toBe(3)` changed to
 * `toBeDefined()`); review still owns that.
 *
 *   node scripts/ward-flow/check-protected-safety-tests.mjs [--base <ref>]
 *
 * Exit 0 = nothing protected was loosened, or the change carries the approval line.
 * Exit 1 = an unapproved loosening, or the base could not be read (fails closed).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { countTestCases } from "../check-diff-integrity.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const LIST_PATH = "scripts/ward-flow/protected-safety-tests.json";
export const APPROVAL_PREFIX = "Protected-test-change: approved by Josh";
const APPROVAL_LINE = /^[ \t>*-]*Protected-test-change:\s*approved by Josh\b[\s:,;–—-]*(\S.{7,})$/imu;

const ASSERTION_ROOTS = new Set(["expect", "assert"]);
const CASE_OR_SUITE_ROOTS = new Set(["test", "it", "describe"]);
const DISABLING_MEMBERS = new Set(["skip", "todo", "fixme", "skipIf"]);

/** @param {ts.Expression} expression */
function calleeChain(expression) {
  const chain = [];
  let current = expression;
  while (ts.isPropertyAccessExpression(current)) {
    chain.unshift(current.name.text);
    current = current.expression;
  }
  if (!ts.isIdentifier(current)) return null;
  chain.unshift(current.text);
  return chain;
}

/**
 * Test cases, assertion calls and disabling markers in one test source.
 *
 * @param {string} source
 * @param {string} [fileName]
 * @returns {{ cases: number, assertions: number, disabled: number }}
 */
export function measureTestSource(source, fileName = "spec.ts") {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let assertions = 0;
  let disabled = 0;
  /** @param {ts.Node} node */
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const chain = calleeChain(node.expression);
      if (chain && ASSERTION_ROOTS.has(chain[0])) assertions += 1;
      if (chain && CASE_OR_SUITE_ROOTS.has(chain[0]) && chain.slice(1).some((m) => DISABLING_MEMBERS.has(m))) {
        disabled += 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { cases: countTestCases(source, fileName), assertions, disabled };
}

/**
 * Compare one protected file. `after === null` means deleted or renamed away.
 *
 * @param {string} file
 * @param {{ cases: number, assertions: number, disabled: number }} before
 * @param {{ cases: number, assertions: number, disabled: number } | null} after
 * @returns {string[]} problems (empty when nothing was loosened)
 */
export function assessProtectedFile(file, before, after) {
  if (after === null) return [`${file}: protected test file deleted or renamed away`];
  const problems = [];
  if (after.cases < before.cases) problems.push(`${file}: test cases ${before.cases} -> ${after.cases}`);
  if (after.assertions < before.assertions) {
    problems.push(`${file}: assertions ${before.assertions} -> ${after.assertions}`);
  }
  if (after.disabled > before.disabled) {
    problems.push(`${file}: skipped/todo/fixme markers ${before.disabled} -> ${after.disabled}`);
  }
  return problems;
}

/**
 * The approval reason from commit messages or a PR body, or null.
 *
 * @param {string[]} texts
 * @returns {string | null}
 */
export function findApproval(texts) {
  for (const text of texts) {
    const match = APPROVAL_LINE.exec(text ?? "");
    if (match) return match[1].trim();
  }
  return null;
}

/** @param {string} raw */
export function parseProtectedList(raw) {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.files) || parsed.files.length === 0) throw new Error("files must be a non-empty array");
  return parsed.files.map((entry) => {
    if (typeof entry?.path !== "string" || !/^tests\/.+\.(?:test|spec)\.tsx?$/u.test(entry.path)) {
      throw new Error(`each entry needs a tests/…test.ts(x) path: ${JSON.stringify(entry)}`);
    }
    return entry.path;
  });
}

/**
 * @param {{ base: string, root?: string, git?: (args: string[]) => string, extraTexts?: string[] }} input
 * @returns {{ problems: string[], checked: string[], approval: string | null }}
 */
export function evaluate({ base, root = ROOT, git, extraTexts = [] }) {
  const run =
    git ??
    ((args) =>
      execFileSync("git", args, {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 256 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      }));
  const show = (file) => {
    try {
      return run(["show", `${base}:${file}`]);
    } catch {
      return null;
    }
  };
  const readAfter = (file) => {
    const absolute = path.join(root, file);
    return existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
  };

  const afterListRaw = readAfter(LIST_PATH);
  if (afterListRaw === null) throw new Error(`${LIST_PATH} is missing`);
  const afterList = parseProtectedList(afterListRaw);
  const beforeListRaw = show(LIST_PATH);
  const beforeList = beforeListRaw === null ? [] : parseProtectedList(beforeListRaw);

  const problems = [];
  for (const file of beforeList) {
    if (!afterList.includes(file)) problems.push(`${file}: dropped from ${LIST_PATH}`);
  }
  const checked = [...new Set([...beforeList, ...afterList])];
  for (const file of checked) {
    const beforeSource = show(file);
    // Not on the base yet: newly protected, nothing to loosen.
    if (beforeSource === null) continue;
    const afterSource = readAfter(file);
    problems.push(
      ...assessProtectedFile(
        file,
        measureTestSource(beforeSource, file),
        afterSource === null ? null : measureTestSource(afterSource, file),
      ),
    );
  }

  let approval = null;
  if (problems.length > 0) {
    let messages = "";
    try {
      messages = run(["log", "--format=%B%x00", `${base}..HEAD`]);
    } catch {
      messages = "";
    }
    approval = findApproval([...messages.split("\0"), ...extraTexts]);
  }
  return { problems, checked, approval };
}

/** The pull request body from the GitHub event payload, when CI provides one. */
export function pullRequestBody(env = process.env) {
  const eventPath = env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return "";
  try {
    return JSON.parse(readFileSync(eventPath, "utf8"))?.pull_request?.body ?? "";
  } catch {
    return "";
  }
}

function resolveBase(argv, env) {
  const index = argv.indexOf("--base");
  const requested = index >= 0 ? argv[index + 1] : env.WARD_BASE_SHA;
  if (requested) return requested;
  return execFileSync("git", ["merge-base", "HEAD", "refs/remotes/origin/main"], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
}

export function main(argv = process.argv.slice(2), env = process.env) {
  let result;
  let base;
  try {
    base = resolveBase(argv, env);
    execFileSync("git", ["rev-parse", "--verify", "--end-of-options", `${base}^{commit}`], {
      cwd: ROOT,
      stdio: "ignore",
    });
    result = evaluate({ base, extraTexts: [pullRequestBody(env)] });
  } catch (error) {
    console.error(`[protected-tests] FAIL — cannot reach a verdict: ${String(error).split("\n")[0]}`);
    return 1;
  }
  const where = `against ${base.slice(0, 12)}`;
  if (result.problems.length === 0) {
    console.log(
      `[protected-tests] PASS — ${result.checked.length} protected safety test file(s) not loosened ${where}.`,
    );
    return 0;
  }
  for (const problem of result.problems) console.log(`  ${result.approval ? "APPROVED" : "FAIL    "}  ${problem}`);
  if (result.approval) {
    console.log(`[protected-tests] PASS (approved) — reason: ${result.approval}`);
    return 0;
  }
  console.error(
    `[protected-tests] FAIL — a protected safety test was removed or loosened ${where} (D-123 item 3). ` +
      `If Josh approved it, add a line "${APPROVAL_PREFIX} <reason>" to a commit message in this pull request.`,
  );
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
