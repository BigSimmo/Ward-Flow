#!/usr/bin/env node
// Phone script budget. Run after `next build`: it starts the built app on a spare local port, loads
// each route in script-budget.json with a phone user agent, adds up the gzipped size of every
// `<script src>` the page names, and fails when a route is over its budget. Nothing leaves the
// machine. On 16 October 2026 Home had crept from 500 KB (after #334) to 588 KB unnoticed, which is
// why this exists. Raise a budget only with a reason in the PR.
//
// Exit codes: 0 within budget, 2 over budget, 1 anything else (the app did not start, a page
// failed). `--write <file>` saves the measurements as JSON. `--judge <pr.json> <main.json>` decides a
// pull request from two saved measurements (see judgeAgainstMain), so a PR is only failed for a
// route it grew itself, never for a main that was already over (4 November 2026).
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
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

export function validateBudgets(budgets) {
  if (!budgets || typeof budgets !== "object" || Array.isArray(budgets) || Object.keys(budgets).length === 0) {
    throw new Error("Script budgets must be a non-empty route map");
  }
  for (const [route, limit] of Object.entries(budgets)) {
    const url = new URL(route, "http://local.invalid");
    if (!route.startsWith("/") || url.origin !== "http://local.invalid" || url.pathname !== route) {
      throw new Error(`Invalid script budget route: ${route}`);
    }
    if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
      throw new Error(`Invalid script budget for ${route}: expected a positive finite number`);
    }
  }
}

export function overBudget(measured, budgets) {
  validateBudgets(budgets);
  if (!measured || typeof measured !== "object" || Array.isArray(measured)) {
    throw new Error("Script measurements must be a route map");
  }
  for (const route of Object.keys(budgets)) {
    if (
      !Object.hasOwn(measured, route) ||
      typeof measured[route] !== "number" ||
      !Number.isFinite(measured[route]) ||
      measured[route] <= 0
    ) {
      throw new Error(`Invalid or missing script measurement for ${route}`);
    }
  }
  if (Object.keys(measured).some((route) => !Object.hasOwn(budgets, route))) {
    throw new Error("Script measurements include an unconfigured route");
  }
  return Object.entries(budgets)
    .filter(([route, limit]) => measured[route] > limit)
    .map(([route, limit]) => ({ route, kb: measured[route], limit }));
}

// Build-to-build noise allowed on top of an already-over main before the PR is blamed for the route.
// Two builds of the same main measured 572.7 and 573.7 KB in CI on 4 November 2026.
export const MAIN_TOLERANCE_KB = 1.5;

// The most a route may stand over its own budget and still pass as inherited, measured against the
// fixed budget rather than against main. Without it the tolerance compounded: each PR was compared
// with a main that already held the previous PR's 1.5 KB, so 20 PRs in a row could add 30 KB with
// every build green (performance audit WF-03, 11 November 2026). Twice the tolerance leaves room for
// main's own build noise plus this PR's. A PR that measures no bigger than main still passes, so a
// main that drifted further is never pinned on a PR that did not grow it.
export const MAX_INHERITED_OVERAGE_KB = 2 * MAIN_TOLERANCE_KB;

/**
 * Decides a pull request whose merged result is over budget, given what main alone measured.
 * A route fails when the PR pushed it over (main was within budget) or grew it further than
 * MAIN_TOLERANCE_KB past an already-over main. A route that was over only because main already was
 * is reported and passes: main's own breakage is tracked by the budget trim issue, not pinned on every other PR.
 * Growth within the tolerance passes only while the route stays within MAX_INHERITED_OVERAGE_KB of its
 * budget, so the tolerance cannot stack PR after PR; a PR measuring no bigger than main always passes.
 * No main measurement (main failed to build or measure) fails every over route, as before.
 */
export function judgeAgainstMain(prMeasured, mainMeasured, budgets) {
  const over = overBudget(prMeasured, budgets);
  const failing = [];
  const inherited = [];
  for (const entry of over) {
    const main = mainMeasured?.[entry.route];
    const mainKnown = typeof main === "number" && Number.isFinite(main) && main > 0;
    const withinNoise =
      entry.kb <= main || (entry.kb <= main + MAIN_TOLERANCE_KB && entry.kb <= entry.limit + MAX_INHERITED_OVERAGE_KB);
    if (mainKnown && main > entry.limit && withinNoise) inherited.push({ ...entry, main });
    else failing.push({ ...entry, main: mainKnown ? main : undefined });
  }
  return { failing, inherited };
}

function readMeasurements(file) {
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  if (!parsed || typeof parsed.measured !== "object") throw new Error(`${file}: no measurements`);
  return parsed;
}

function judge(prFile, mainFile) {
  const { budgets } = JSON.parse(readFileSync(join(process.cwd(), "script-budget.json"), "utf8"));
  const pr = readMeasurements(prFile);
  const main = mainFile && existsSync(mainFile) ? readMeasurements(mainFile) : undefined;
  if (!main) console.error("Main could not be measured, so every over-budget route counts against this PR.");
  const { failing, inherited } = judgeAgainstMain(pr.measured, main?.measured, budgets);
  for (const { route, kb, limit, main: mainKb } of inherited)
    console.log(
      `::warning::${route} is ${kb.toFixed(1)} KB against a ${limit} KB budget, but main alone is already ${mainKb.toFixed(1)} KB. Not this PR's growth; the budget trim issue tracks it.`,
    );
  for (const { route, kb, limit, main: mainKb } of failing)
    console.error(
      `Over budget: ${route} is ${kb.toFixed(1)} KB, budget ${limit} KB${mainKb === undefined ? "" : `, main alone ${mainKb.toFixed(1)} KB`}`,
    );
  if (failing.length) process.exitCode = 2;
}

// ---- Report-only sizes (performance audit WF-01, WF-02, WF-06 and WF-18, 11 November 2026) ----
// Printed and saved beside the budget measurements, never judged: no limit below can fail a build.
// Setting a limit on any of them is Josh's decision, from a measured baseline (never a raise).

// Heavy routes with no budget line, reported so their size is at least visible. The triage page was
// 719 KB of script on 11 November 2026, more than the largest budget.
export const REPORT_ROUTES = Object.freeze([
  "/ward-flow/people/PT-028/triage",
  "/ward-flow/help",
  "/ward-flow/activity",
  "/ward-flow/governance",
]);

/**
 * The other static assets a page names: render-blocking stylesheets, and JavaScript the page asks the
 * browser to preload (`<link rel="preload" as="script">` or `modulepreload`), which `scriptSources`
 * does not count. Same-origin Next static files only, deduplicated, in document order.
 */
export function pageAssets(html) {
  const stylesheets = [];
  const preloads = [];
  const pending = [parse(html)];
  while (pending.length) {
    const node = pending.pop();
    const children = node.childNodes ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]);
    if (node.tagName !== "link" || node.namespaceURI !== "http://www.w3.org/1999/xhtml") continue;
    const attributes = new Map(node.attrs.map(({ name, value }) => [name, value]));
    const rel = (attributes.get("rel") ?? "").toLowerCase().split(/\s+/u);
    const href = attributes.get("href") ?? "";
    if (!href.startsWith("/_next/static/")) continue;
    const url = new URL(href, "http://local.invalid");
    const path = url.pathname + url.search;
    if (rel.includes("stylesheet") && url.pathname.endsWith(".css")) stylesheets.push(path);
    else if (
      url.pathname.endsWith(".js") &&
      (rel.includes("modulepreload") || (rel.includes("preload") && attributes.get("as") === "script"))
    )
      preloads.push(path);
  }
  return { stylesheets: [...new Set(stylesheets)], preloads: [...new Set(preloads)] };
}

/**
 * @typedef {{ budgeted: boolean, scriptKb?: number, cssKb?: number, cssFiles?: number, preloadKb?: number,
 *   preloadFiles?: number, error?: string }} RouteReport
 */

/**
 * Script, stylesheet and preload sizes per route, plus the script every budgeted route shares.
 * @param {string} base
 * @param {readonly string[]} budgetedRoutes
 * @param {readonly string[]} [extraRoutes]
 * @returns {Promise<{ routes: Record<string, RouteReport>, sharedScriptKb: number | undefined }>}
 */
export async function reportSizes(base, budgetedRoutes, extraRoutes = REPORT_ROUTES) {
  const gzipped = new Map();
  const sizeOf = async (src) => {
    if (!gzipped.has(src)) {
      const asset = await fetchWithDeadline(base + src, { redirect: "manual" });
      if (!asset.ok) throw new Error(`${src} answered ${asset.status}`);
      gzipped.set(src, gzipSync(Buffer.from(await asset.arrayBuffer()), { level: 9 }).length);
    }
    return gzipped.get(src);
  };
  const total = async (list) => {
    let bytes = 0;
    for (const src of list) bytes += await sizeOf(src);
    return Math.round((bytes / 1024) * 10) / 10;
  };
  /** @type {Record<string, RouteReport>} */
  const routes = {};
  /** @type {Set<string> | undefined} */
  let shared;
  // A budgeted route that cannot be read leaves the shared set unknown, so no shared total is shown.
  let sharedKnown = true;
  for (const route of [...budgetedRoutes, ...extraRoutes]) {
    const isBudgeted = budgetedRoutes.includes(route);
    let parsed = false;
    try {
      const html = await fetchPageHtml(base, route);
      const scripts = scriptSources(html);
      const { stylesheets, preloads } = pageAssets(html);
      // Intersect before any asset download, so a failed download cannot drop this route from it.
      if (isBudgeted) shared = shared ? new Set(scripts.filter((src) => shared.has(src))) : new Set(scripts);
      parsed = true;
      const extraPreloads = preloads.filter((src) => !scripts.includes(src));
      routes[route] = {
        budgeted: isBudgeted,
        scriptKb: await total(scripts),
        cssKb: await total(stylesheets),
        cssFiles: stylesheets.length,
        preloadKb: await total(extraPreloads),
        preloadFiles: extraPreloads.length,
      };
    } catch (error) {
      if (isBudgeted && !parsed) sharedKnown = false;
      routes[route] = { budgeted: isBudgeted, error: error.message };
    }
  }
  let sharedScriptKb;
  if (sharedKnown && shared) {
    try {
      sharedScriptKb = await total([...shared]);
    } catch {
      sharedScriptKb = undefined;
    }
  }
  return { routes, sharedScriptKb };
}

export function formatReport(report) {
  const lines = [
    "Report only, not judged (WF-01, WF-02, WF-06, WF-18): KB gzipped.",
    "| Route | Budgeted | Script | Stylesheets | Preloaded script not counted |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const [route, size] of Object.entries(report.routes)) {
    if (size.error) lines.push(`| ${route} | ${size.budgeted ? "yes" : "no"} | not measured: ${size.error} | | |`);
    else
      lines.push(
        `| ${route} | ${size.budgeted ? "yes" : "no"} | ${size.scriptKb.toFixed(1)} | ${size.cssKb.toFixed(1)} (${size.cssFiles} files) | ${size.preloadKb.toFixed(1)} (${size.preloadFiles} files) |`,
      );
  }
  if (report.sharedScriptKb !== undefined)
    lines.push(`Script every budgeted route loads (shared shell): ${report.sharedScriptKb.toFixed(1)} KB.`);
  return lines.join("\n");
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

/** Fetches a route's HTML as a phone would, following only the one configured legacy redirect. */
async function fetchPageHtml(base, route) {
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
  return response.text();
}

export async function routeKb(base, route) {
  const sources = scriptSources(await fetchPageHtml(base, route));
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

async function main(writeTo) {
  const { budgets } = JSON.parse(readFileSync(join(process.cwd(), "script-budget.json"), "utf8"));
  validateBudgets(budgets);
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
    for (const route of Object.keys(budgets)) {
      measured[route] = await routeKb(base, route);
      console.log(`${route}: ${measured[route].toFixed(1)} KB gzipped (budget ${budgets[route]} KB)`);
    }
    // Report-only sizes never change the verdict below, so any failure here is only printed.
    let report;
    try {
      report = await reportSizes(base, Object.keys(budgets));
      const text = formatReport(report);
      console.log(text);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${text}\n`);
    } catch (error) {
      console.log(`Report-only sizes were not measured: ${error.message}`);
    }
    if (writeTo) writeFileSync(writeTo, `${JSON.stringify({ measured, budgets, report }, null, 2)}\n`);
    const over = overBudget(measured, budgets);
    for (const { route, kb, limit } of over)
      console.error(`Over budget: ${route} is ${kb.toFixed(1)} KB, budget ${limit} KB`);
    if (over.length) process.exitCode = 2;
  } finally {
    server.kill();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(name);
    return index === -1 ? undefined : args[index + 1];
  };
  const run = args.includes("--judge")
    ? async () => judge(option("--judge"), args[args.indexOf("--judge") + 2])
    : () => main(option("--write"));
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
