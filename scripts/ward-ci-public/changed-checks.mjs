// Fast checks on the files a Ward Flow PR changes: Prettier, ESLint (errors only) and the
// test-deletion guard. Source/lint checks use the PR diff. Formatting policy changes (including
// removals) require a whole-tree read-only check because they affect existing files too.
//
//   WARD_BASE_SHA=<pr base> node scripts/ward-ci-public/changed-checks.mjs
//   node scripts/ward-ci-public/changed-checks.mjs --base origin/main   (locally)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatPolicyChanged } from "../check-format-changed.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LINTABLE = /\.(?:[cm]?[jt]sx?)$/u;

/** Changed files that still exist, from `git diff --name-only` output. */
export function existingChangedFiles(nameOnlyOutput, exists = (file) => existsSync(path.join(root, file))) {
  return nameOnlyOutput
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(exists);
}

/** The subset ESLint should see: script and source files only. */
export function lintableFiles(files) {
  return files.filter((file) => LINTABLE.test(file));
}

export function prettierCheckArguments(changedPaths, { projectRoot = root, base = "origin/main" } = {}) {
  return formatPolicyChanged(changedPaths, projectRoot, base)
    ? ["--check", "--ignore-unknown", "."]
    : ["--check", "--ignore-unknown", "--", ...changedPaths.filter((file) => existsSync(path.join(projectRoot, file)))];
}

function run(label, command, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  const ok = result.status === 0;
  console.log(ok ? `✔ ${label}` : `✖ ${label} (exit ${result.status ?? result.signal})`);
  return ok;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argBase = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : undefined;
  const base = argBase ?? process.env.WARD_BASE_SHA;
  if (!base) {
    console.log("No PR base (merge group or manual run): changed-file checks have nothing to compare.");
    process.exit(0);
  }
  const changedPaths = execFileSync("git", ["diff", "--name-only", "-z", `${base}...HEAD`, "--"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  })
    .split("\0")
    .filter(Boolean);
  const files = changedPaths.filter((file) => existsSync(path.join(root, file)));
  console.log(`Changed-file checks: ${files.length} changed file(s) against ${base.slice(0, 12)}.`);

  const results = [];
  if (files.length > 0 || formatPolicyChanged(changedPaths, root, base)) {
    results.push(
      run("Prettier on changed files (whole-tree check if formatting policy changed)", process.execPath, [
        path.join(root, "node_modules/prettier/bin/prettier.cjs"),
        ...prettierCheckArguments(changedPaths, { projectRoot: root, base }),
      ]),
    );
  }
  const lintable = lintableFiles(files);
  if (lintable.length > 0) {
    results.push(
      run("ESLint (errors) on changed files", process.execPath, [
        "--max-old-space-size=8192",
        path.join(root, "node_modules/eslint/bin/eslint.js"),
        "--quiet",
        "--no-warn-ignored",
        "--no-error-on-unmatched-pattern",
        ...lintable,
      ]),
    );
  }
  results.push(run("Test-deletion guard", process.execPath, ["scripts/check-diff-integrity.mjs", "--base", base]));
  process.exit(results.every(Boolean) ? 0 : 1);
}
