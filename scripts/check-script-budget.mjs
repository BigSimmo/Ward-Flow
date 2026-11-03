#!/usr/bin/env node
// Phone script budget. Run after `next build`: it starts the built app on a spare local port, loads
// each route in script-budget.json with a phone user agent and adds up the gzipped size of every
// `<script src>` the page names. Nothing leaves the machine. On 16 October 2026 Home had crept from
// 500 KB (after #334) to 588 KB unnoticed, which is why this exists.
// Each route has a baseline (its size after the last size tidy) and a ceiling (the hard limit,
// normally baseline + 10 KB). The check fails only above a ceiling, and warns without failing when a
// route has grown more than 3 KB since its baseline or is within 2 KB of its ceiling (D-96). A
// normal PR never edits script-budget.json; rules: docs/ward-flow/HOW-WE-WORK.md section 6.
import { spawn } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { parse } from "parse5";

const PHONE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const JAVASCRIPT_TYPES = new Set([
  "application/ecmascript",
  "application/javascript",
  "application/x-ecmascript",
  "application/x-javascript",
  "text/ecmascript",
  "text/javascript",
  "text/javascript1.0",
  "text/javascript1.1",
  "text/javascript1.2",
  "text/javascript1.3",
  "text/javascript1.4",
  "text/javascript1.5",
  "text/jscript",
  "text/livescript",
  "text/x-ecmascript",
  "text/x-javascript",
]);

function fetchWithDeadline(url, options, startupSignal) {
  const deadline = AbortSignal.timeout(10_000);
  return fetch(url, { ...options, signal: startupSignal ? AbortSignal.any([deadline, startupSignal]) : deadline });
}

export function scriptSources(html) {
  const sources = [];
  const pending = [parse(html)];
  while (pending.length) {
    const node = pending.pop();
    const children = node.childNodes ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]);
    if (node.tagName !== "script" || node.namespaceURI !== "http://www.w3.org/1999/xhtml") continue;
    const attributes = new Map(node.attrs.map(({ name, value }) => [name, value]));
    const type = attributes.has("type")
      ? attributes.get("type").trim().toLowerCase()
      : attributes.get("language")?.trim()
        ? `text/${attributes.get("language").trim().toLowerCase()}`
        : "";
    if (type !== "module" && type !== "" && !JAVASCRIPT_TYPES.has(type)) continue;
    // A `nomodule` script runs only in browsers without ES modules (Next's polyfills). Modern phones
    // never download it, so counting it overstated every route by about 39 KB until 24 October 2026.
    if (type !== "module" && attributes.has("nomodule")) continue;
    const src = attributes.get("src") ?? "";
    if (!src.startsWith("/_next/static/")) continue;
    const url = new URL(src, "http://local.invalid");
    // Fragments do not change the fetched resource; count and deduplicate its actual request URL.
    if (url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js"))
      sources.push(url.pathname + url.search);
  }
  return [...new Set(sources)];
}

// Warn when a route has grown more than this many KB since its baseline (the last size tidy).
export const GROWTH_WARNING_KB = 3;
// Warn when a route is within this many KB of its ceiling.
export const NEAR_CEILING_WARNING_KB = 2;

function positiveFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// Returns { route: { baseline, ceiling } }. A bare number is the older single-limit shape, read as a
// route whose baseline and ceiling are both that limit, so a branch cut before D-96 still checks.
export function validateBudgets(budgets) {
  if (!budgets || typeof budgets !== "object" || Array.isArray(budgets) || Object.keys(budgets).length === 0) {
    throw new Error("Script budgets must be a non-empty route map");
  }
  const normalised = {};
  for (const [route, entry] of Object.entries(budgets)) {
    const url = new URL(route, "http://local.invalid");
    if (!route.startsWith("/") || url.origin !== "http://local.invalid" || url.pathname !== route) {
      throw new Error(`Invalid script budget route: ${route}`);
    }
    if (typeof entry === "number") {
      if (!positiveFinite(entry)) {
        throw new Error(`Invalid script budget for ${route}: expected a positive finite number`);
      }
      normalised[route] = { baseline: entry, ceiling: entry };
      continue;
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Invalid script budget for ${route}: expected { baseline, ceiling }`);
    }
    const keys = Object.keys(entry).sort().join(",");
    if (keys !== "baseline,ceiling") {
      throw new Error(`Invalid script budget for ${route}: expected exactly baseline and ceiling`);
    }
    const { baseline, ceiling } = entry;
    if (!positiveFinite(baseline) || !positiveFinite(ceiling)) {
      throw new Error(`Invalid script budget for ${route}: baseline and ceiling must be positive finite numbers`);
    }
    if (baseline > ceiling) {
      throw new Error(`Invalid script budget for ${route}: baseline ${baseline} KB is above ceiling ${ceiling} KB`);
    }
    normalised[route] = { baseline, ceiling };
  }
  return normalised;
}

function checkedMeasurements(measured, budgets) {
  const normalised = validateBudgets(budgets);
  if (!measured || typeof measured !== "object" || Array.isArray(measured)) {
    throw new Error("Script measurements must be a route map");
  }
  for (const route of Object.keys(normalised)) {
    if (!Object.hasOwn(measured, route) || !positiveFinite(measured[route])) {
      throw new Error(`Invalid or missing script measurement for ${route}`);
    }
  }
  if (Object.keys(measured).some((route) => !Object.hasOwn(normalised, route))) {
    throw new Error("Script measurements include an unconfigured route");
  }
  return normalised;
}

// Routes over their ceiling. These fail the check.
export function overBudget(measured, budgets) {
  const normalised = checkedMeasurements(measured, budgets);
  return Object.entries(normalised)
    .filter(([route, { ceiling }]) => measured[route] > ceiling)
    .map(([route, { ceiling }]) => ({ route, kb: measured[route], limit: ceiling }));
}

// Routes under their ceiling that have grown since the last tidy or are close to the ceiling. These
// warn but never fail. A route over its ceiling is reported by overBudget instead.
export function budgetWarnings(measured, budgets) {
  const normalised = checkedMeasurements(measured, budgets);
  const warnings = [];
  for (const [route, { baseline, ceiling }] of Object.entries(normalised)) {
    const kb = measured[route];
    if (kb > ceiling) continue;
    const grown = kb - baseline;
    const headroom = ceiling - kb;
    if (grown > GROWTH_WARNING_KB) {
      warnings.push({
        route,
        kind: "grown",
        kb,
        baseline,
        ceiling,
        message: `${route} has grown ${grown.toFixed(1)} KB since the last tidy (${kb.toFixed(1)} KB, baseline ${baseline} KB). Say in the PR body why, in one line.`,
      });
    }
    if (headroom <= NEAR_CEILING_WARNING_KB) {
      warnings.push({
        route,
        kind: "near-ceiling",
        kb,
        baseline,
        ceiling,
        message: `${route} is ${headroom.toFixed(1)} KB under its ceiling (${kb.toFixed(1)} KB, ceiling ${ceiling} KB). A size tidy is due soon.`,
      });
    }
  }
  return warnings;
}

// One line per route: measured, baseline, ceiling and headroom, so every run shows where each stands.
export function budgetTable(measured, budgets) {
  const normalised = checkedMeasurements(measured, budgets);
  const width = Math.max(5, ...Object.keys(normalised).map((route) => route.length));
  const cell = (value) => String(value).padStart(9);
  const lines = [
    `${"Route".padEnd(width)} ${cell("Measured")} ${cell("Baseline")} ${cell("Ceiling")} ${cell("Headroom")}`,
  ];
  for (const [route, { baseline, ceiling }] of Object.entries(normalised)) {
    const kb = measured[route];
    lines.push(
      `${route.padEnd(width)} ${cell(kb.toFixed(1))} ${cell(baseline.toFixed(1))} ${cell(ceiling.toFixed(1))} ${cell((ceiling - kb).toFixed(1))}`,
    );
  }
  return lines.join("\n");
}

// Prints the table, warnings and failures, and returns the exit code (1 only when over a ceiling).
export function reportBudgets(measured, budgets, { log = console.log, error = console.error, annotate = false } = {}) {
  log("Phone first-load scripts, KB gzipped:");
  log(budgetTable(measured, budgets));
  for (const { message } of budgetWarnings(measured, budgets)) {
    if (annotate) log(`::warning title=Phone script size::${message}`);
    log(`Warning: ${message}`);
  }
  const over = overBudget(measured, budgets);
  for (const { route, kb, limit } of over) {
    const message = `${route} is ${kb.toFixed(1)} KB, over its ${limit} KB ceiling. Do not raise the ceiling: trim in this PR, run a size tidy, or ask Josh.`;
    if (annotate) error(`::error title=Phone script size::${message}`);
    error(`Over ceiling: ${message}`);
  }
  return over.length ? 1 : 0;
}

// Asks the operating system for a free port, so a busy local port cannot make the check fail.
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(base, attempts = 60) {
  const startupSignal = AbortSignal.timeout(30_000);
  for (let i = 0; i < attempts && !startupSignal.aborted; i += 1) {
    try {
      const response = await fetchWithDeadline(base, { redirect: "manual" }, startupSignal);
      if (response.status > 0) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The built app did not start");
}

// D-39's one configured legacy movement link redirects to this exact record-address code.
// Keep this paired with movementHref("WF-001") (tests/ward-script-budget.test.ts checks it), rather
// than accepting any same-origin redirect.
export const LEGACY_MOVEMENT_REDIRECT = Object.freeze({
  route: "/ward-flow/movements/WF-001",
  destination: "/ward-flow/movements/1nfzcp26wc0g",
});

export async function routeKb(base, route) {
  const options = { headers: { "user-agent": PHONE_UA }, redirect: "manual" };
  let response = await fetchWithDeadline(base + route, options);
  if ((response.status === 307 || response.status === 308) && route === LEGACY_MOVEMENT_REDIRECT.route) {
    const location = response.headers.get("location");
    const destination = location && new URL(location, base + route);
    if (!destination || destination.href !== `${base}${LEGACY_MOVEMENT_REDIRECT.destination}`) {
      throw new Error(`${route}: unexpected redirect destination`);
    }
    response = await fetchWithDeadline(destination, options);
  }
  if (!response.ok) throw new Error(`${route} answered ${response.status}`);
  if (!/^text\/html(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) {
    throw new Error(`${route}: expected an HTML page`);
  }
  const sources = scriptSources(await response.text());
  if (sources.length === 0) throw new Error(`${route}: no Next static scripts found`);
  let bytes = 0;
  for (const src of sources) {
    const script = await fetchWithDeadline(base + src, { redirect: "manual" });
    if (!script.ok) throw new Error(`${route}: ${src} answered ${script.status}, so its size cannot be counted`);
    if (!/^(?:text|application)\/(?:javascript|ecmascript)(?:\s*;|$)/i.test(script.headers.get("content-type") ?? "")) {
      throw new Error(`${route}: ${src} did not return JavaScript`);
    }
    const body = Buffer.from(await script.arrayBuffer());
    if (body.length === 0) throw new Error(`${route}: ${src} was empty`);
    bytes += gzipSync(body, { level: 9 }).length;
  }
  return bytes / 1024;
}

async function main() {
  const { budgets } = JSON.parse(readFileSync(join(process.cwd(), "script-budget.json"), "utf8"));
  const routes = Object.keys(validateBudgets(budgets));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "127.0.0.1"],
    {
      env: { ...process.env, NEXT_PUBLIC_MOCKUPS_ENABLED: "true" },
      stdio: "ignore",
    },
  );
  try {
    await waitForServer(base);
    const measured = {};
    for (const route of routes) measured[route] = await routeKb(base, route);
    process.exitCode = reportBudgets(measured, budgets, { annotate: process.env.GITHUB_ACTIONS === "true" });
  } finally {
    server.kill();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
