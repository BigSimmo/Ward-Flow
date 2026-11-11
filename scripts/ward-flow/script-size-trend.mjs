#!/usr/bin/env node
// Audit M85 (10 November 2026): the monthly phone script size record. Turns one of CI's own
// measurements (the `script-budget-measured` artifact main's push run saves, kept 7 days) into one
// month's rows of a trend file, so a slow creep shows between raises and trims. It reads two local
// files and writes one; it downloads nothing (fetching the artifact from GitHub needs Josh's yes).
//   node scripts/ward-flow/script-size-trend.mjs --measured <measured.json> --sha <main commit>
//     --month YYYY-MM [--trend docs/ward-flow/evidence/script-size-trend.csv]
// Re-running a month replaces that month's rows, so a doubled run adds nothing.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const HEADER = "month,main_commit,route,measured_kb,budget_kb";
export const DEFAULT_TREND = "docs/ward-flow/evidence/script-size-trend.csv";

/** The trend file's text with `month` replaced by the measurement's rows, oldest month first. */
export function recordMonth(existing, { measured, budgets }, { month, sha }) {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(month)) throw new Error("Give the month as YYYY-MM.");
  if (!/^[0-9a-f]{40}$/u.test(sha)) throw new Error("Give main's full commit SHA.");
  if (!measured || typeof measured !== "object" || !Object.keys(measured).length)
    throw new Error("The measurement has no routes.");
  const kept = (existing ?? "")
    .split(/\r?\n/u)
    .filter((line) => line && line !== HEADER && !line.startsWith(`${month},`));
  const rows = Object.keys(measured)
    .sort()
    .map((route) => {
      const kb = Number(measured[route]);
      if (!Number.isFinite(kb) || kb <= 0) throw new Error(`${route} has no size.`);
      const budget = Number(budgets?.[route]);
      return `${month},${sha},${route},${kb.toFixed(1)},${Number.isFinite(budget) ? budget.toFixed(1) : ""}`;
    });
  return `${[HEADER, ...[...kept, ...rows].sort()].join("\n")}\n`;
}

function main(args) {
  const at = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const measuredFile = at("--measured");
  const trend = at("--trend") ?? DEFAULT_TREND;
  if (!measuredFile) {
    console.error("Usage: script-size-trend.mjs --measured <file> --sha <commit> --month YYYY-MM [--trend <csv>]");
    return 1;
  }
  try {
    const text = recordMonth(
      existsSync(trend) ? readFileSync(trend, "utf8") : "",
      JSON.parse(readFileSync(measuredFile, "utf8")),
      { month: at("--month") ?? "", sha: at("--sha") ?? "" },
    );
    writeFileSync(trend, text);
    console.log(`Recorded ${at("--month")} in ${trend}.`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = main(process.argv.slice(2));
