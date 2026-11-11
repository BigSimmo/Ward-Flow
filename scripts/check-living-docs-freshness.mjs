#!/usr/bin/env node
/**
 * check-living-docs-freshness — warn when a "living" doc has not been re-checked recently.
 *
 * Living docs describe the app as it is today (status, demo script, runbook, desk guides,
 * entry pages). They go wrong quietly as the app changes: STATUS.md stopped at 21 October
 * while about 120 changes merged after it. Each living doc carries one invisible marker near
 * the top:
 *
 *   <!-- last-checked: 2026-10-24 -->
 *
 * meaning "someone checked this page against current main on that date". This script compares
 * that date with the date of the HEAD commit (not the clock, so results are reproducible and it
 * works on shallow clones) and reports pages older than --days (default 14) or missing the
 * marker. A listed page that no longer exists, and a marker date that is not a real date or is
 * after HEAD, are reported too (audit F-49). Refresh a page by checking it against the app and
 * updating the date.
 *
 * Some pages carry a shorter limit of their own (PAGE_DAYS): the status page must be re-checked every
 * 7 days (documentation audit, approved by Josh 7 November 2026). A page's own limit applies when it
 * is shorter than --days.
 *
 * Blocking for the pages staff and the operator act on (audit A8-10): a problem on the operations
 * runbook or any desk guide (BLOCKING_DOCS, BLOCKING_DIRS) exits 1, so CI fails until the page is
 * re-checked. Every other page stays advisory: exit 0 unless --strict is passed, which makes every
 * problem exit 1. --advisory never fails, and nor does --json (the weekly reminder's report) without --strict.
 * --annotate also prints one GitHub Actions annotation per problem (an error for a blocking page,
 * a warning otherwise), so pull requests show it.
 *
 * Usage:
 *   node scripts/check-living-docs-freshness.mjs [--days 14] [--strict | --advisory] [--json] [--annotate]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_ROOT = fileURLToPath(new URL("..", import.meta.url));

// The pages that must stay true to the current app. Add a page here when it describes "now".
export const LIVING_DOCS = [
  "README.md",
  "docs/README.md",
  "docs/ward-flow/README.md",
  "docs/ward-flow/STATUS.md",
  "docs/ward-flow/DEMO-SCRIPT.md",
  "docs/ward-flow/OPERATIONS-RUNBOOK.md",
  "docs/ward-flow/STAFF-RELEASE-NOTES.md",
  "docs/ward-flow/DATABASE.md",
  "docs/ward-flow/LOCAL-FIRST-RUN.md",
];
// Pages that go stale fastest get a shorter limit than the default.
export const PAGE_DAYS = { "docs/ward-flow/STATUS.md": 7 };
// Every page in these folders is living too.
export const LIVING_DIRS = ["docs/ward-flow/desk-guides"];
// Pages whose problems fail the check by default (audit A8-10): the runbook and every desk guide.
export const BLOCKING_DOCS = ["docs/ward-flow/OPERATIONS-RUNBOOK.md"];
export const BLOCKING_DIRS = ["docs/ward-flow/desk-guides"];

/** True when a problem on this page fails the check without --strict. */
export function isBlocking(path) {
  return BLOCKING_DOCS.includes(path) || BLOCKING_DIRS.some((dir) => path.startsWith(`${dir}/`));
}

const MARKER = /<!--\s*last-checked:\s*(\d{4}-\d{2}-\d{2})\s*-->/u;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Return the YYYY-MM-DD in a page's last-checked marker, or null. */
export function readLastChecked(text) {
  const match = MARKER.exec(String(text));
  return match ? match[1] : null;
}

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30 and the like), as epoch ms, or NaN. */
function calendarDate(text) {
  const parsed = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === text ? parsed : Number.NaN;
}

/**
 * Classify one page: "ok", "stale", "missing" (no marker), or "invalid" (a marker date that is not a
 * real date, or is after the reference date). Audit F-49: an invalid or future date used to count
 * as fresh, so a typo kept a page out of the re-check list for good.
 */
export function assess({ lastChecked, reference, days }) {
  if (!lastChecked) return { status: "missing", ageDays: null };
  const checked = calendarDate(lastChecked);
  if (Number.isNaN(checked)) return { status: "invalid", ageDays: null };
  const ageDays = Math.floor((Date.parse(reference) - checked) / DAY_MS);
  if (ageDays < 0) return { status: "invalid", ageDays };
  return { status: ageDays > days ? "stale" : "ok", ageDays };
}

/** One line on what is wrong with a page, for the console, annotations and the weekly issue. */
export function problemDetail(result) {
  if (result.status === "absent") return "listed as a living page, but the file is gone";
  if (result.status === "missing") return "no <!-- last-checked: YYYY-MM-DD --> marker";
  if (result.status === "invalid")
    return `last-checked date ${result.lastChecked} is not a real date on or before the reference date`;
  return `last checked ${result.lastChecked} (${result.ageDays} days; limit ${result.limit})`;
}

/** Every living page, listed ones included even when missing: a listed page that is gone is reported. */
export function listLivingDocs(root) {
  const files = [...LIVING_DOCS];
  for (const dir of LIVING_DIRS) {
    if (!existsSync(join(root, dir))) continue;
    for (const name of readdirSync(join(root, dir)).sort()) {
      if (name.endsWith(".md")) files.push(`${dir}/${name}`);
    }
  }
  return files;
}

function headCommitDate(root) {
  try {
    return execFileSync("git", ["log", "-1", "--format=%cs"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function run({ root = DEFAULT_ROOT, days = 14, reference = headCommitDate(root) } = {}) {
  const results = listLivingDocs(root).map((path) => {
    const limit = Math.min(days, PAGE_DAYS[path] ?? days);
    if (!existsSync(join(root, path))) return { path, lastChecked: null, limit, status: "absent", ageDays: null };
    const lastChecked = readLastChecked(readFileSync(join(root, path), "utf8"));
    return { path, lastChecked, limit, ...assess({ lastChecked, reference, days: limit }) };
  });
  const problems = results
    .filter((r) => r.status !== "ok")
    .map((result) => ({ ...result, blocking: isBlocking(result.path), detail: problemDetail(result) }));
  return { reference, days, results, problems };
}

/** 1 when a blocking page has a problem (or any page, with strict); 0 in advisory mode. */
export function exitCodeFor(report, { strict = false, advisory = false } = {}) {
  if (advisory) return 0;
  const failing = strict ? report.problems : report.problems.filter((p) => p.blocking);
  return failing.length > 0 ? 1 : 0;
}

function main(argv) {
  const daysIndex = argv.indexOf("--days");
  const days = daysIndex >= 0 ? Number(argv[daysIndex + 1]) : 14;
  if (!Number.isFinite(days) || days < 0) {
    console.error("--days needs a non-negative number");
    return 2;
  }
  // --today measures age against the current date instead of the HEAD commit date. The weekly
  // reminder uses it so a quiet `main` cannot keep a stale page looking fresh.
  const report = run(argv.includes("--today") ? { days, reference: new Date().toISOString() } : { days });
  if (argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.problems.length === 0) {
    console.log(
      `living docs fresh: ${report.results.length} page(s) checked within ${days} days of ${report.reference}.`,
    );
  } else {
    console.log(`living docs needing a re-check (HEAD ${report.reference}, limit ${days} days):`);
    for (const p of report.problems) {
      const detail = p.detail;
      console.log(`  ${p.path}: ${detail}${p.blocking ? " (blocking)" : ""}`);
      if (argv.includes("--annotate")) {
        const level = p.blocking ? "error" : "warning";
        console.log(`::${level} file=${p.path},title=Living page needs a re-check::${p.path}: ${detail}`);
      }
    }
    console.log(
      "Check each page against the current app, then update its last-checked date. The runbook and desk guides block; other pages are advisory.",
    );
  }
  // --json is the weekly reminder's report, read by a shell step, so it fails only with --strict.
  const strict = argv.includes("--strict");
  return exitCodeFor(report, { strict, advisory: argv.includes("--advisory") || (argv.includes("--json") && !strict) });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = main(process.argv.slice(2));
}
