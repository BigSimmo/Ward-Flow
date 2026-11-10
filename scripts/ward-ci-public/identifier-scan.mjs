// Hosted copy of the local pre-commit secret and patient-identifier scan (D-122 item 7).
// It reuses scanAddedLines from scripts/pre-commit-checks.mjs, so the Medicare, IHI and URN
// shapes live in one place. It reads only the lines the PR adds, exactly as the hook does,
// and needs no network: the base commit is already in the full-history checkout.
//
//   WARD_BASE_SHA=<pr base> node scripts/ward-ci-public/identifier-scan.mjs
//   node scripts/ward-ci-public/identifier-scan.mjs --base origin/main   (locally)
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAddedLines, scanAddedLines } from "../pre-commit-checks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Scan `git diff -U0` text the way the pre-commit hook scans the staged diff. */
export function scanDiffText(diffText) {
  return scanAddedLines(parseAddedLines(diffText));
}

/** Drop any quoted value (the URN finding quotes what it matched) before it reaches a log. */
export function redactFindingValue(why) {
  return why.replace(/"[^"]*"/gu, '"[redacted]"');
}

function rangeDiff(base) {
  return execFileSync(
    "git",
    [
      "diff",
      "-U0",
      "--no-color",
      "--no-ext-diff",
      "--diff-filter=ACMRT",
      "--src-prefix=a/",
      "--dst-prefix=b/",
      `${base}...HEAD`,
      "--",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: 60_000 },
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argBase = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : undefined;
  const base = argBase ?? process.env.WARD_BASE_SHA;
  if (!base) {
    console.log("No PR base (manual or main run): the identifier scan has no added lines to compare.");
    process.exit(0);
  }
  const findings = scanDiffText(rangeDiff(base));
  if (findings.length > 0) {
    console.error("Possible secret or real patient identifier in lines this change adds:");
    for (const finding of findings) {
      const { file, line } = finding;
      // CI logs are public: never echo the matched value itself.
      const why = redactFindingValue(finding.why);
      console.error(`  ${file}${line ? `:${line}` : ""}  ${why}`);
      if (process.env.GITHUB_ACTIONS === "true") console.log(`::error file=${file},line=${line || 1}::${why}`);
    }
    console.error('Use made-up data, or mark a deliberately fake line with "precommit-scan: allow".');
    process.exit(1);
  }
  console.log(`Identifier scan: no secret or real-looking patient identifier added since ${base.slice(0, 12)}.`);
}
