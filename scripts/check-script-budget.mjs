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
  return [...new Set([...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((match) => match[1]))];
}

export function validateBudgets(budgets) {
  if (!budgets || typeof budgets !== "object" || Array.isArray(budgets) || Object.keys(budgets).length === 0) {
    throw new Error("Script budgets must be a nonempty object of route limits");
  }
  for (const [route, limit] of Object.entries(budgets)) {
    const localRoute = route.startsWith("/") && !route.startsWith("//") && !route.includes("\\");
    if (!localRoute || !Number.isFinite(limit) || limit <= 0) {
      throw new Error(`Invalid script budget for ${route}: expected a route and a finite positive KB limit`);
    }
  }
}

export function overBudget(measured, budgets) {
  validateBudgets(budgets);
  for (const route of Object.keys(budgets)) {
    if (!Number.isFinite(measured?.[route]) || measured[route] < 0) {
      throw new Error(`Invalid script measurement for ${route}: expected finite nonnegative KB`);
    }
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

async function measuredResponse(url, label, request, headers) {
  const response = await request(url, { redirect: "manual", ...(headers ? { headers } : {}) });
  if (!response.ok) throw new Error(`${label} answered ${response.status}; redirects and errors cannot be measured`);
  if (response.url !== url) throw new Error(`${label} answered at ${response.url}, expected ${url}`);
  return response;
}

export async function routeKb(base, route, request = fetch) {
  const response = await measuredResponse(new URL(route, base).href, route, request, { "user-agent": PHONE_UA });
  const sources = scriptSources(await response.text());
  if (sources.length === 0) throw new Error(`${route} names no Next static scripts, so its size cannot be measured`);
  let bytes = 0;
  for (const src of sources) {
    const script = await measuredResponse(new URL(src, base).href, `${route}: ${src}`, request);
    bytes += gzipSync(Buffer.from(await script.arrayBuffer()), { level: 9 }).length;
  }
  return Math.round(bytes / 1024);
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
      console.log(`${route}: ${measured[route]} KB gzipped (budget ${budgets[route]} KB)`);
    }
    const over = overBudget(measured, budgets);
    for (const { route, kb, limit } of over) console.error(`Over budget: ${route} is ${kb} KB, budget ${limit} KB`);
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
