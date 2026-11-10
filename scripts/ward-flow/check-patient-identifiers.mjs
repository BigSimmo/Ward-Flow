#!/usr/bin/env node
/**
 * Patient-identifier scan on a pull request's added lines (audit M132).
 *
 * The local pre-commit hook blocks checksum-valid Medicare numbers and IHIs, and labelled
 * URN/UMRN/MRN values outside the synthetic UMnnnnnn format. A commit made without the hook
 * (GitHub's web editor, another machine, a bot) skipped that scan. This runs the same rules
 * (`scanPatientIdentifierLine` in scripts/pre-commit-checks.mjs) on every line the pull request
 * adds, with the same exemptions: test and fixture paths, and lines carrying the allow marker.
 *
 * It reads only the diff, so mockups committed before this check are not re-judged here.
 * Dependency-free, so it runs before the install step and on documentation-only pull requests.
 *
 *   WARD_BASE_SHA=<pr base> node scripts/ward-flow/check-patient-identifiers.mjs
 *   node scripts/ward-flow/check-patient-identifiers.mjs --base origin/main   (locally)
 *
 * Exit 0 = no finding (or no base to compare, such as a push to main). Exit 1 = a finding, or
 * the diff could not be read.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { ALLOW_MARKER, isFixturePath, parseAddedLines, scanPatientIdentifierLine } from "../pre-commit-checks.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Identifier findings in a unified diff's added lines.
 *
 * @param {string} diffText unified diff (`git diff -U0`)
 * @returns {{ file: string, line: number, why: string }[]}
 */
export function scanDiffForPatientIdentifiers(diffText) {
  const findings = [];
  for (const [file, lines] of parseAddedLines(diffText)) {
    if (isFixturePath(file)) continue;
    for (const { line, text } of lines) {
      if (text.includes(ALLOW_MARKER)) continue;
      findings.push(...scanPatientIdentifierLine(file, line, text));
    }
  }
  return findings;
}

/**
 * The pull request's diff against its base. Three dots: only what the branch added.
 *
 * @param {string} base
 * @param {string} [root]
 */
export function pullRequestDiff(base, root = ROOT) {
  return execFileSync(
    "git",
    [
      "diff",
      "-U0",
      "--no-color",
      "--no-ext-diff",
      "--no-textconv",
      "--diff-filter=ACMRT",
      "--src-prefix=a/",
      "--dst-prefix=b/",
      `${base}...HEAD`,
      "--",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 512 * 1024 * 1024, timeout: 60_000 },
  );
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const index = argv.indexOf("--base");
  const base = index >= 0 ? argv[index + 1] : env.WARD_BASE_SHA;
  if (!base) {
    console.log("[patient-identifiers] No pull-request base (push or manual run): nothing to compare.");
    return 0;
  }
  let diff;
  try {
    diff = pullRequestDiff(base);
  } catch (error) {
    console.error(`[patient-identifiers] FAIL — cannot read the diff against ${base}: ${String(error).split("\n")[0]}`);
    return 1;
  }
  const findings = scanDiffForPatientIdentifiers(diff);
  if (findings.length === 0) {
    console.log(`[patient-identifiers] PASS — no real-looking patient identifier added against ${base.slice(0, 12)}.`);
    return 0;
  }
  console.error("[patient-identifiers] FAIL — possible real patient identifier added in this pull request:");
  // Location and rule only: the value itself is never echoed into CI logs.
  for (const { file, line, why } of findings) console.error(`  ${file}:${line}  ${why.replace(/ "[^"]*"/u, "")}`);
  console.error(
    `  Use made-up data (synthetic URNs are UM plus six digits). If the value is deliberately fake, add "${ALLOW_MARKER}" on that line.`,
  );
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
