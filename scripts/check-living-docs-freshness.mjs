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
 * marker. Refresh a page by checking it against the app and updating the date.
 *
 * Advisory: exit 0 unless --strict is passed, then exit 1 when anything is stale or missing.
 *
 * Usage:
 *   node scripts/check-living-docs-freshness.mjs [--days 14] [--strict] [--json]
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
// Every page in these folders is living too.
export const LIVING_DIRS = ["docs/ward-flow/desk-guides"];

const MARKER = /<!--\s*last-checked:\s*(\d{4}-\d{2}-\d{2})\s*-->/u;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Return the YYYY-MM-DD in a page's last-checked marker, or null. */
export function readLastChecked(text) {
  const match = MARKER.exec(String(text));
  return match ? match[1] : null;
}

/** Classify one page: "ok", "stale" or "missing". */
export function assess({ lastChecked, reference, days }) {
  if (!lastChecked) return { status: "missing", ageDays: null };
  const ageDays = Math.floor((Date.parse(reference) - Date.parse(lastChecked)) / DAY_MS);
  return { status: ageDays > days ? "stale" : "ok", ageDays };
}

export function listLivingDocs(root) {
  const files = LIVING_DOCS.filter((path) => existsSync(join(root, path)));
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
    const lastChecked = readLastChecked(readFileSync(join(root, path), "utf8"));
    return { path, lastChecked, ...assess({ lastChecked, reference, days }) };
  });
  return { reference, days, results, problems: results.filter((r) => r.status !== "ok") };
}

function main(argv) {
  const daysIndex = argv.indexOf("--days");
  const days = daysIndex >= 0 ? Number(argv[daysIndex + 1]) : 14;
  if (!Number.isFinite(days) || days < 0) {
    console.error("--days needs a non-negative number");
    return 2;
  }
  const report = run({ days });
  if (argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.problems.length === 0) {
    console.log(
      `living docs fresh: ${report.results.length} page(s) checked within ${days} days of ${report.reference}.`,
    );
  } else {
    console.log(`living docs needing a re-check (HEAD ${report.reference}, limit ${days} days):`);
    for (const p of report.problems) {
      const detail =
        p.status === "missing"
          ? "no <!-- last-checked: YYYY-MM-DD --> marker"
          : `last checked ${p.lastChecked} (${p.ageDays} days)`;
      console.log(`  ${p.path}: ${detail}`);
    }
    console.log("Check each page against the current app, then update its last-checked date. (advisory)");
  }
  return argv.includes("--strict") && report.problems.length > 0 ? 1 : 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = main(process.argv.slice(2));
}
