#!/usr/bin/env node
// Choose the smallest fold gate that can see a regression from the changed files.
// This prints a plan; it never runs a check or treats a focused pass as a full-suite pass.
import { execFileSync } from "node:child_process";
import { classifyChanges } from "../ward-ci-public/plan.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LINE = "origin/main";
export function selectFoldGate(changes) {
  const entries = Array.isArray(changes)
    ? changes.map((change) =>
        typeof change === "string"
          ? { file: change.replace(/\\/g, "/"), status: "M" }
          : { file: change.path.replace(/\\/g, "/"), status: change.status },
      )
    : [];
  const scope = classifyChanges(entries);
  return {
    tier: scope.unit || scope.browser ? "full" : "static",
    typecheck: scope.unit,
    journeys: scope.browser,
    policy: Boolean(scope.policy),
    installation: scope.full,
    backend: entries.some(({ file }) => file.startsWith("backend/ward-flow/")),
    reason: scope.reason,
  };
}
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
if (process.argv[1] && same(process.argv[1], fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const base = opt("--base", LINE);
  const head = opt("--head", "HEAD");
  let raw;
  try {
    raw = execFileSync("git", ["diff", "--name-status", `${base}...${head}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    console.error(
      `Cannot compare Ward Flow refs ${base}...${head}. Verify the local refs or supply --base <ref> and --head <ref>. No gate selected.`,
    );
    process.exit(1);
  }
  const changes = raw
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [status, ...files] = line.split("\t");
      return { status, path: files.at(-1) };
    });
  const plan = selectFoldGate(changes);
  console.log(`WARD_FOLD_GATE=${plan.tier.toUpperCase()}`);
  console.log(`WARD_FOLD_TYPECHECK=${Number(plan.typecheck)}`);
  console.log(`WARD_FOLD_JOURNEYS=${Number(plan.journeys)}`);
  console.log(`WARD_FOLD_POLICY=${Number(plan.policy)}`);
  console.log(`WARD_FOLD_INSTALLATION=${Number(plan.installation)}`);
  console.log(`Reason: ${plan.reason}; ${changes.length} changed file(s).`);
}
