#!/usr/bin/env node
// Ward Flow targeted journeys: which browser journey specs a diff needs, or ALL of them.
//
//   node scripts/ward-flow/select-journeys.mjs [--base <ref>] [--head <ref>] [--json]
//
// Default base is the ward line, head is HEAD; the diff is base...head (your branch's own changes).
// Prints one spec file per line, "ALL", or "NONE", then the reasons (on stderr, or in --json).
//
// Rules (Josh, 25 September 2026: screen-only changes run only their specs; anything else, or when
// unsure, runs the full set):
//   - ALL: the engine or reducer (src/lib/**), the Ward Flow layout, error or loading files, app-wide
//     files (root layout, global CSS, next.config, middleware, package or lock files, Playwright
//     config or runner, shared spec helpers), a component used by more than MAX_ROUTES screens or by
//     a non-Ward route, or a changed screen no spec visits.
//   - A changed screen (page, its components, their CSS modules, followed through imports up to the
//     page) runs every spec that visits that screen's path, plus ui-ward-full-journey.spec.ts.
//   - A changed ui-ward spec runs itself.
//   - Docs, unit tests and tooling outside the list above run NONE.
// Run the full set with `npm run test:e2e:ward-journeys`; a selection with
//   node scripts/run-playwright.mjs --project=chromium-mockups <spec> [<spec> ...]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const LINE = "codex/task-ward-flow-live-state-20260831";
const WARD_APP = "src/app/mockups/ward-flow/";
const ALWAYS_WITH_SCREENS = "tests/ui-ward-full-journey.spec.ts";
const MAX_ROUTES = 6;
const APP_WIDE = [
  /^src\/lib\//,
  /^src\/app\/mockups\/ward-flow\/(layout|error|loading|template|not-found)\.tsx?$/,
  /^src\/app\/(layout|template|error|global-error|not-found)\.tsx?$/,
  /^src\/app\/[^/]+\.css$/,
  /^src\/styles\//,
  /^src\/middleware\./,
  /^middleware\./,
  /^next\.config\./,
  /^(package|package-lock)\.json$/,
  /^tsconfig.*\.json$/,
  /^playwright\.config\./,
  /^scripts\/run-playwright\.mjs$/,
  /^tests\/(?!ui-ward-)[^/]*\.spec\.ts$/,
  /^tests\/(e2e|playwright|fixtures|helpers|support)\//,
  /^public\//,
];

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const base = opt("--base", LINE);
const head = opt("--head", "HEAD");
const asJson = args.includes("--json");
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const changed = execFileSync("git", ["diff", "--name-only", `${base}...${head}`], { cwd: root, encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const reasons = [];
const all = (why) => {
  reasons.push(`ALL: ${why}`);
  return finish("ALL");
};

const specs = readdirSync(path.join(root, "tests"))
  .filter((name) => /^ui-ward-.*\.spec\.ts$/.test(name))
  .map((name) => ({ file: `tests/${name}`, text: readFileSync(path.join(root, "tests", name), "utf8") }));

// Reverse import graph over src/ (static and dynamic imports, "@/" alias and relative paths).
const sourceFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel);
    else if (/\.(tsx?|mjs|js|css)$/.test(entry.name)) sourceFiles.push(rel);
  }
})("src");
const resolveSpecifier = (from, specifier) => {
  let target;
  if (specifier.startsWith("@/")) target = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith("."))
    target = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  else return null;
  for (const candidate of [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`]) {
    const full = path.join(root, candidate);
    if (existsSync(full) && statSync(full).isFile()) return candidate;
  }
  return null;
};
const importers = new Map();
for (const file of sourceFiles) {
  if (file.endsWith(".css")) continue;
  const text = readFileSync(path.join(root, file), "utf8");
  for (const match of text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g)) {
    const target = resolveSpecifier(file, match[1]);
    if (!target) continue;
    if (!importers.has(target)) importers.set(target, new Set());
    importers.get(target).add(file);
  }
}

// Screens (route paths) a source file reaches, following importers up to Ward Flow pages.
function routesFor(file) {
  const routes = new Set();
  const seen = new Set([file]);
  const queue = [file];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.startsWith(WARD_APP) && /\/page\.tsx?$/.test(current)) {
      const segments = current.slice(WARD_APP.length).split("/").slice(0, -1);
      const dynamic = segments.findIndex((segment) => segment.startsWith("["));
      const kept = dynamic < 0 ? segments : segments.slice(0, dynamic);
      routes.add(`/mockups/ward-flow${kept.length ? `/${kept.join("/")}` : ""}${dynamic < 0 ? "" : "/"}`);
      continue;
    }
    if (current.startsWith("src/app/") && !current.startsWith(WARD_APP) && /\/(page|layout)\.tsx?$/.test(current)) {
      return null; // reaches a non-Ward route: treat as shared
    }
    for (const importer of importers.get(current) ?? []) {
      if (!seen.has(importer)) {
        seen.add(importer);
        queue.push(importer);
      }
    }
  }
  return routes;
}

const selected = new Set();
let screensChanged = false;
for (const file of changed) {
  if (APP_WIDE.some((pattern) => pattern.test(file))) all(`${file} is app-wide or engine`);
  if (/^tests\/ui-ward-.*\.spec\.ts$/.test(file)) {
    if (existsSync(path.join(root, file))) selected.add(file);
    reasons.push(`${file}: changed spec`);
    continue;
  }
  if (!file.startsWith("src/")) {
    reasons.push(`${file}: not app code, no journeys`);
    continue;
  }
  if (!existsSync(path.join(root, file))) all(`${file} was deleted or renamed`);
  const routes = routesFor(file);
  if (routes === null) all(`${file} is used outside Ward Flow`);
  if (routes.size === 0) {
    reasons.push(`${file}: reaches no Ward Flow screen, no journeys`);
    continue;
  }
  if (routes.size > MAX_ROUTES) all(`${file} reaches ${routes.size} screens (shared)`);
  screensChanged = true;
  for (const route of routes) {
    const hits = specs.filter((spec) =>
      route.endsWith("/")
        ? spec.text.includes(route)
        : new RegExp(`${route.replace(/[/-]/g, "\\$&")}(?![\\w-])`).test(spec.text),
    );
    if (hits.length === 0) all(`${file} changes ${route}, which no journey spec visits`);
    for (const spec of hits) selected.add(spec.file);
    reasons.push(`${file} -> ${route} -> ${hits.map((spec) => path.basename(spec.file)).join(", ")}`);
  }
}
if (screensChanged) selected.add(ALWAYS_WITH_SCREENS);
finish(selected.size ? [...selected].sort() : "NONE");

function finish(result) {
  if (asJson) console.log(JSON.stringify({ base, head, result, reasons }, null, 2));
  else {
    console.log(Array.isArray(result) ? result.join("\n") : result);
    for (const reason of reasons) console.error(`  ${reason}`);
  }
  process.exit(0);
}
