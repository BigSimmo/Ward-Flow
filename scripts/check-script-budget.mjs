#!/usr/bin/env node
// Phone script budget. Run after `next build`: it starts the built app on a spare local port, loads
// each route in script-budget.json with a phone user agent, adds up the gzipped size of every
// `<script src>` the page names, and fails when a route is over its budget. Nothing leaves the
// machine. On 16 October 2026 Home had crept from 500 KB (after #334) to 588 KB unnoticed, which is
// why this exists. Raise a budget only with a reason in the PR.
import { spawn } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const PHONE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

export function scriptSources(html) {
  const sources = [];
  for (const match of html.matchAll(/<script\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi)) {
    // A `nomodule` script runs only in browsers without ES modules (Next's polyfills). Modern phones
    // never download it, so counting it overstated every route by about 39 KB until 24 October 2026.
    if (/\snomodule(?:[\s=>]|$)/i.test(match[0])) continue;
    const src = (match[1] ?? match[2] ?? match[3]).replace(/&amp;|&#38;|&#x26;/gi, "&");
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
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(base, { redirect: "manual" });
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
  let response = await fetch(base + route, options);
  if ((response.status === 307 || response.status === 308) && route === LEGACY_MOVEMENT_REDIRECT.route) {
    const location = response.headers.get("location");
    const destination = location && new URL(location, base + route);
    if (!destination || destination.href !== `${base}${LEGACY_MOVEMENT_REDIRECT.destination}`) {
      throw new Error(`${route}: unexpected redirect destination`);
    }
    response = await fetch(destination, options);
  }
  if (!response.ok) throw new Error(`${route} answered ${response.status}`);
  if (!/^text\/html(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) {
    throw new Error(`${route}: expected an HTML page`);
  }
  const sources = scriptSources(await response.text());
  if (sources.length === 0) throw new Error(`${route}: no Next static scripts found`);
  let bytes = 0;
  for (const src of sources) {
    const script = await fetch(base + src, { redirect: "manual" });
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
    const over = overBudget(measured, budgets);
    for (const { route, kb, limit } of over)
      console.error(`Over budget: ${route} is ${kb.toFixed(1)} KB, budget ${limit} KB`);
    if (over.length) process.exitCode = 1;
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
