#!/usr/bin/env node
// Choose the smallest fold gate that can see a regression from the changed files.
// This prints a plan; it never runs a check or treats a focused pass as a full-suite pass.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LINE = "origin/main";
const TEST_RUNNER =
  /^(vitest\.config\.|tests\/setup\/|scripts\/(check-ward-expected-reds|run-vitest|test-runner-safety)\.mjs$|scripts\/ward-flow\/related-tests\.mjs$)/;
const APP_WIDE =
  /^(package(-lock)?\.json$|next\.config\.|tsconfig[^/]*\.json$|src\/components\/ward-management\/(?:[^/]+\.[jt]sx?$|(?:engine|state|shell|reference)\/)|src\/lib\/ward-flow-|src\/app\/layout\.|src\/(?:proxy|middleware)\.)/;
const DOC = /^(docs\/|README\.md$|\.agents\/skills\/)|(?:^|\/)(?:AGENTS|CLAUDE|GEMINI)\.md$/;
const TOOL = /^(scripts\/|\.githooks\/|\.claude\/hooks\/|\.github\/)/;
const TEST = /^tests\/.*\.(?:test|spec)\.[cm]?[jt]sx?$/;
const WARD_UI = /^src\/(?:components\/ward-management\/|app\/mockups\/ward-flow\/)/;

export function selectFoldGate(changes) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return { tier: "none", typecheck: false, journeys: false, reason: "no changed files" };
  }
  const entries = changes.map((change) => (typeof change === "string" ? { path: change, status: "M" } : change));
  const paths = entries.map(({ path: file }) => file.replace(/\\/g, "/"));
  const browserScope = paths.some(
    (file) => !DOC.test(file) && (file.startsWith("src/") || /^(package(-lock)?\.json|next\.config\.)/.test(file)),
  );
  if (entries.some(({ status, path: file }) => status.startsWith("D") && !DOC.test(file))) {
    return { tier: "full", typecheck: true, journeys: browserScope, reason: "executable or test deletion" };
  }
  if (paths.some((file) => TEST_RUNNER.test(file) || APP_WIDE.test(file))) {
    return {
      tier: "full",
      typecheck: true,
      journeys: browserScope,
      reason: "test infrastructure or shared app behaviour",
    };
  }
  if (paths.some((file) => !DOC.test(file) && !TOOL.test(file) && !TEST.test(file) && !WARD_UI.test(file))) {
    return { tier: "full", typecheck: true, journeys: browserScope, reason: "unrecognised scope" };
  }
  const hasUi = paths.some((file) => WARD_UI.test(file) && !DOC.test(file));
  const hasTool = paths.some((file) => TOOL.test(file));
  const hasTest = paths.some((file) => TEST.test(file));
  if (hasUi || hasTool || hasTest) {
    return {
      tier: "focused",
      typecheck: paths.some((file) => WARD_UI.test(file) && /\.tsx?$/.test(file)),
      journeys: hasUi,
      reason: hasUi ? "Ward screen or route" : hasTool ? "local tooling contract" : "changed tests",
    };
  }
  return { tier: "static", typecheck: false, journeys: false, reason: "documentation or policy only" };
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
  console.log(`Reason: ${plan.reason}; ${changes.length} changed file(s).`);
}
