#!/usr/bin/env node
// Full knip check against a ratchet baseline (knip-baseline.json).
//
// knip reports unused files, exports, types, dependencies and binaries. The entries that were already
// there on 16 October 2026 are listed in the baseline, so CI fails only on a NEW unused item. When an
// entry is fixed, the check also fails until it is removed from the baseline, so the list only shrinks.
// Run `npm run check:knip -- --write` to rewrite the baseline after deleting dead code; it refuses to
// add an entry. Never add one by hand to clear a new one: delete the dead code, or use it. CI also sets
// KNIP_BASE_SHA to the pull request's base commit, and the check then fails if the baseline holds any
// entry the base baseline did not, so the list cannot grow by being regenerated or edited.
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const BASELINE = join(process.cwd(), "knip-baseline.json");
const CATEGORIES = [
  "files",
  "dependencies",
  "devDependencies",
  "optionalPeerDependencies",
  "unlisted",
  "binaries",
  "unresolved",
  "exports",
  "types",
  "enumMembers",
  "namespaceMembers",
  "duplicates",
  "catalog",
  "catalogReferences",
];

export function entriesFromReport(report) {
  const entries = new Set();
  for (const issue of report.issues ?? []) {
    for (const category of CATEGORIES) {
      for (const item of issue[category] ?? []) {
        const name = Array.isArray(item) ? item.map((part) => part.name).join("|") : item.name;
        entries.add(name === issue.file ? `${category}:${name}` : `${category}:${issue.file}:${name}`);
      }
    }
  }
  return [...entries].sort();
}

export function compareToBaseline(current, baseline) {
  const known = new Set(baseline);
  const now = new Set(current);
  return {
    added: current.filter((entry) => !known.has(entry)),
    fixed: baseline.filter((entry) => !now.has(entry)),
  };
}

export function baselineGrowth(baseline, baseBaseline) {
  const known = new Set(baseBaseline);
  return baseline.filter((entry) => !known.has(entry));
}

// The baseline as it stood at the base commit, or null when there is none to compare with (no base
// given, or the baseline is being introduced by this very change). A base commit that cannot be read
// fails closed, so a shallow checkout cannot switch the growth check off.
function baseBaseline(sha) {
  if (!sha) return null;
  const commit = spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`]);
  if (commit.status !== 0) throw new Error(`Cannot read base commit ${sha} to compare knip-baseline.json`);
  const result = spawnSync("git", ["show", `${sha}:knip-baseline.json`], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return JSON.parse(result.stdout);
}

function runKnip() {
  const result = spawnSync(process.execPath, ["node_modules/knip/bin/knip.js", "--no-progress", "--reporter", "json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  try {
    return JSON.parse(result.stdout);
  } catch {
    process.stderr.write(result.stderr || result.stdout);
    throw new Error("knip did not return a JSON report");
  }
}

function main() {
  const current = entriesFromReport(runKnip());
  if (process.argv.includes("--write")) {
    const existing = JSON.parse(readFileSync(BASELINE, "utf8"));
    const { added } = compareToBaseline(current, existing);
    if (added.length) {
      for (const entry of added) console.error(`New unused item: ${entry}`);
      console.error("Not written: the baseline only shrinks. Delete or use the new unused items above.");
      process.exit(1);
    }
    writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`knip baseline written: ${current.length} entries`);
    return;
  }
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  const { added, fixed } = compareToBaseline(current, baseline);
  const grown = baselineGrowth(baseline, baseBaseline(process.env.KNIP_BASE_SHA) ?? baseline);
  for (const entry of grown) console.error(`Added to knip-baseline.json since the base commit: ${entry}`);
  if (grown.length) {
    console.error("The baseline may only shrink. Remove those entries by deleting or using the code.");
    process.exit(1);
  }
  for (const entry of added) console.error(`New unused item: ${entry}`);
  for (const entry of fixed) console.error(`No longer unused, remove from knip-baseline.json: ${entry}`);
  if (added.length || fixed.length) {
    console.error(
      added.length
        ? "Delete or use the new unused items above. Do not add them to the baseline."
        : "Run `npm run check:knip -- --write` to shrink the baseline.",
    );
    process.exit(1);
  }
  console.log(`knip: no new unused items (${baseline.length} baseline entries left)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main();
