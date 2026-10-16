#!/usr/bin/env node
// Full knip check against a ratchet baseline (knip-baseline.json).
//
// knip reports unused files, exports, types, dependencies and binaries. The entries that were already
// there on 16 October 2026 are listed in the baseline, so CI fails only on a NEW unused item. When an
// entry is fixed, the check also fails until it is removed from the baseline, so the list only shrinks.
// Run `npm run check:knip -- --write` to rewrite the baseline after deleting dead code. Never add an
// entry by hand to clear a new one: delete the dead code, or use it.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
    writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`knip baseline written: ${current.length} entries`);
    return;
  }
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  const { added, fixed } = compareToBaseline(current, baseline);
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

if (import.meta.url === `file://${process.argv[1]}`) main();
