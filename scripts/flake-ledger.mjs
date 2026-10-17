#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ledgerPath = path.join(projectRoot, "tests", "flake-ledger.json");
const requiredFields = [
  "id",
  "title",
  "spec",
  "reason",
  "owner",
  "reproduction",
  "firstSeen",
  "lastSeen",
  "expires",
  "tracking",
];
const dayMs = 24 * 60 * 60 * 1000;

function dateValue(value, field, id) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${id}: ${field} must be YYYY-MM-DD`);
  const parsed = Date.parse(`${value}T23:59:59Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new Error(`${id}: ${field} is not a valid date`);
  }
  return parsed;
}

// --list collects the real configured test identities without starting a server or browser.
// A source-string or AST declaration alone could still name an unreachable/unselected test.
export function collectedPlaywrightTitles(spec, root = projectRoot) {
  const result = spawnSync(
    process.execPath,
    [
      path.join(projectRoot, "node_modules/playwright/cli.js"),
      "test",
      "--list",
      "--reporter=json",
      "--config",
      path.join(root, root === projectRoot ? "playwright.config.ts" : "playwright.config.mjs"),
      spec,
    ],
    { cwd: root, encoding: "utf8", timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
  );
  if (result.status !== 0 || result.error) throw new Error(`flake-ledger: Playwright collection failed for ${spec}`);
  const report = JSON.parse(result.stdout);
  if (report.errors?.length) throw new Error(`flake-ledger: Playwright collection errors for ${spec}`);
  const titles = [];
  function walk(suite, parents = []) {
    const nested = suite.line > 0 && suite.title ? [...parents, suite.title] : parents;
    for (const test of suite.specs ?? []) {
      const file = test.file ?? suite.file;
      if (file && path.resolve(report.config?.rootDir ?? root, file) === path.resolve(root, spec))
        titles.push([...nested, test.title].join(" "));
    }
    for (const child of suite.suites ?? []) walk(child, nested);
  }
  for (const suite of report.suites ?? []) walk(suite);
  return titles;
}

export function validateFlakeLedgerEntries(flakes, { root = projectRoot, now = Date.now() } = {}) {
  const ids = new Set();
  const collected = new Map();
  const today = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`);
  const latestAllowedExpiry = today + 31 * dayMs - 1;
  for (const flake of flakes) {
    const missing = requiredFields.filter((field) => typeof flake[field] !== "string" || !flake[field].trim());
    if (missing.length) throw new Error(`flake-ledger ${flake.id ?? "entry"} missing: ${missing.join(", ")}`);
    if (ids.has(flake.id)) throw new Error(`duplicate flake-ledger id: ${flake.id}`);
    ids.add(flake.id);

    const firstSeen = dateValue(flake.firstSeen, "firstSeen", flake.id);
    const lastSeen = dateValue(flake.lastSeen, "lastSeen", flake.id);
    const expires = dateValue(flake.expires, "expires", flake.id);
    if (firstSeen > lastSeen) throw new Error(`${flake.id}: firstSeen cannot be after lastSeen`);
    if (lastSeen > expires) throw new Error(`${flake.id}: lastSeen cannot be after expires`);
    if (expires < now) throw new Error(`${flake.id}: ledger entry expired ${flake.expires}`);
    if (expires > latestAllowedExpiry) throw new Error(`${flake.id}: expiry must be within 30 days`);
    if (!flake.title.includes("@quarantine")) throw new Error(`${flake.id}: exact title must include @quarantine`);
    if (flake.title.includes("@critical"))
      throw new Error(`${flake.id}: a test cannot be both @quarantine and @critical`);

    if (!collected.has(flake.spec)) collected.set(flake.spec, collectedPlaywrightTitles(flake.spec, root));
    if (!collected.get(flake.spec).includes(flake.title))
      throw new Error(`${flake.id}: exact title is not present in collected tests from ${flake.spec}`);
  }
  return flakes;
}

export function loadFlakeLedger(sourcePath = ledgerPath) {
  const raw = JSON.parse(readFileSync(sourcePath, "utf8"));
  return validateFlakeLedgerEntries(Array.isArray(raw.flakes) ? raw.flakes : []);
}

function normalizeSpec(spec) {
  return String(spec ?? "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .toLowerCase();
}

export function matchFlake(spec, testTitle, flakes = loadFlakeLedger()) {
  const normalizedSpec = normalizeSpec(spec);
  const title = String(testTitle ?? "")
    .trim()
    .toLowerCase();
  if (!normalizedSpec || !title) return null;
  return (
    flakes.find(
      (flake) => normalizeSpec(flake.spec) === normalizedSpec && flake.title.trim().toLowerCase() === title,
    ) ?? null
  );
}

function selfTest() {
  const flakes = loadFlakeLedger();
  if (new Set(flakes.map((flake) => flake.id)).size !== flakes.length) throw new Error("flake ids are not unique");
  const sample = [{ spec: "tests/example.spec.ts", title: "exact quarantined title @quarantine", id: "sample" }];
  if (matchFlake("tests/example.spec.ts", "EXACT QUARANTINED TITLE @QUARANTINE", sample)?.id !== "sample")
    throw new Error("exact title did not match");
  if (matchFlake("tests/example.spec.ts", "prefix exact quarantined title @quarantine", sample))
    throw new Error("partial title unexpectedly matched");
  if (matchFlake("tests/other.spec.ts", "exact quarantined title @quarantine", sample))
    throw new Error("cross-spec title unexpectedly matched");
  console.error(`[flake-ledger] self-test passed (${flakes.length} active entries)`);
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  if (process.argv.includes("--list")) {
    for (const flake of loadFlakeLedger()) console.log(`${flake.id}\t${flake.spec}\t${flake.title}`);
    return;
  }
  const matchIndex = process.argv.indexOf("--match");
  if (matchIndex >= 0) {
    console.log(matchFlake(process.argv[matchIndex + 1], process.argv[matchIndex + 2])?.id ?? "none");
    return;
  }
  console.error('usage: flake-ledger.mjs [--list | --self-test | --match "<exact spec>" "<exact title>"]');
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
