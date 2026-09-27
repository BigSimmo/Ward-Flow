#!/usr/bin/env node
// Ward Flow baseline compare: which failing test files are new, and which baseline failures are fixed.
//
//   node scripts/check-ward-expected-reds.mjs > <log> 2>&1      (the full ward suite, once)
//   node scripts/ward-flow/baseline-diff.mjs <log> [--commit <sha>] [--baseline <file>]
//
// The log is the suite's output, or a Vitest JSON report (--reporter=json). The baseline is
// docs/ward-flow/test-baseline.md: every `- \`<file>.test.ts(x)\`` bullet is a known failure.
// Known flakes (fail under full-suite load, pass alone) are listed separately, never as new.
//
// The result is keyed to the commit (default: HEAD of the current folder) and written outside every
// worktree, to D:/Repos/ward-flow-logs/baseline-diff/<commit>.md.
// Exit 0 = no new failures; 1 = new failures (rerun only that file once to check a flake); 2 = usage.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const KNOWN_FLAKES = ["design-system-adoption.test.ts", "pre-commit-ward-flow-main-guard.test.ts"];
const OUT_DIR = process.env.WARD_BASELINE_DIFF_DIR ?? "D:/Repos/ward-flow-logs/baseline-diff";

const args = process.argv.slice(2);
let logPath;
const opts = {};
for (let i = 0; i < args.length; i++) {
  if (["--commit", "--baseline"].includes(args[i]) && args[i + 1]) opts[args[i].slice(2)] = args[++i];
  else if (!args[i].startsWith("--") && !logPath) logPath = args[i];
  else logPath = undefined;
}
if (!logPath) {
  console.log("Usage: baseline-diff.mjs <suite log or vitest json> [--commit <sha>] [--baseline <file>]");
  process.exit(2);
}

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const commit = execFileSync("git", ["rev-parse", opts.commit ?? "HEAD"], { encoding: "utf8" }).trim();
const baselinePath = opts.baseline ?? path.join(root, "docs/ward-flow/test-baseline.md");
const TEST_FILE = /[\w.-]+\.test\.tsx?/;

const baseline = new Set(
  readFileSync(baselinePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.startsWith("- `"))
    .map((line) => line.match(TEST_FILE)?.[0])
    .filter(Boolean),
);
if (baseline.size === 0) {
  console.log(`No failing files found in ${baselinePath}; refusing to compare against an empty baseline.`);
  process.exit(2);
}

// Failing files from the run: a Vitest JSON report, or the text the suite prints under
// "are failing and are NOT in the manifest:" (indented paths, one per line).
const raw = readFileSync(logPath, "utf8");
let failing;
let ran;
try {
  const report = JSON.parse(raw);
  ran = report.testResults.length;
  failing = report.testResults
    .filter((result) => result.status === "failed")
    .map((result) => path.basename(result.name));
} catch {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => /are failing and are NOT in the manifest:/.test(line));
  failing = [];
  if (start >= 0) {
    for (const line of lines.slice(start + 1)) {
      const file = line.match(/^\s+(\S*\.test\.tsx?)\s*$/)?.[1];
      if (!file) break;
      failing.push(path.basename(file));
    }
  }
  const summary = lines.find((line) => /files?\b.*\b(ran|executed|discovered)|Test Files/i.test(line));
  ran = summary ?? "unknown (no summary line found in the log)";
  if (start < 0 && !/check:ward-expected-reds OK/.test(raw)) {
    console.log(
      "Could not find the failing-file list in the log. Pass the full output of check-ward-expected-reds, or a Vitest JSON report.",
    );
    process.exit(2);
  }
}
const failingSet = new Set(failing);

const flakes = [...failingSet].filter((file) => KNOWN_FLAKES.includes(file)).sort();
const newFailures = [...failingSet].filter((file) => !baseline.has(file) && !KNOWN_FLAKES.includes(file)).sort();
const fixed = [...baseline].filter((file) => !failingSet.has(file)).sort();
const stillFailing = [...baseline].filter((file) => failingSet.has(file)).sort();

const report = [
  `# Ward baseline compare — ${commit.slice(0, 10)}`,
  "",
  `- Commit: ${commit}`,
  `- Run log: ${path.resolve(logPath)}`,
  `- Baseline: ${baselinePath} (${baseline.size} known failing files)`,
  `- Files run: ${ran}`,
  `- Failing in this run: ${failingSet.size}`,
  "",
  `## New failures (${newFailures.length}) — yours unless proved otherwise`,
  ...newFailures.map((file) => `- ${file}`),
  "",
  `## Fixed since the baseline (${fixed.length})`,
  ...fixed.map((file) => `- ${file}`),
  "",
  `## Known flakes seen (${flakes.length}) — rerun alone once to confirm`,
  ...flakes.map((file) => `- ${file}`),
  "",
  `## Still failing, on the baseline (${stillFailing.length})`,
  ...stillFailing.map((file) => `- ${file}`),
  "",
  "Note: a new failing test inside a baseline file you touched is also yours; this compare works by file.",
  "",
].join("\n");

mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, `${commit.slice(0, 12)}.md`);
writeFileSync(outPath, report);
console.log(
  `Baseline compare at ${commit.slice(0, 10)}: ${newFailures.length} new, ${fixed.length} fixed, ${flakes.length} known flake(s), ${stillFailing.length} still failing. Written to ${outPath}`,
);
for (const file of newFailures) console.log(`  NEW  ${file}`);
process.exit(newFailures.length > 0 ? 1 : 0);
