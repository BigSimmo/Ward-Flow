// Fast checks on the files a Ward Flow PR changes: Prettier, ESLint (errors only) and the
// test-deletion guard. Each looks only at the PR's own diff, so pre-existing issues elsewhere in
// the tree never block an unrelated PR, and the whole run takes seconds.
//
//   WARD_BASE_SHA=<pr base> node scripts/ward-ci-public/changed-checks.mjs
//   node scripts/ward-ci-public/changed-checks.mjs --base origin/main   (locally)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  const files = existingChangedFiles(
    execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`], {
      cwd: root,
      encoding: "utf8",
    }),
  );
  console.log(`Changed-file checks: ${files.length} changed file(s) against ${base.slice(0, 12)}.`);

  const results = [];
  if (files.length > 0) {
    results.push(
      run("Prettier on changed files", process.execPath, [
        path.join(root, "node_modules/prettier/bin/prettier.cjs"),
        "--check",
        "--ignore-unknown",
        "--",
        ...files,
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
