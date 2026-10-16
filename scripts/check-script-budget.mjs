#!/usr/bin/env node
// Phone script budget. Run after `next build`: it starts the built app on a spare local port, loads
// each route in script-budget.json with a phone user agent, adds up the gzipped size of every
// `<script src>` the page names, and fails when a route is over its budget. Nothing leaves the
// machine. On 16 October 2026 Home had crept from 500 KB (after #334) to 588 KB unnoticed, which is
// why this exists. Raise a budget only with a reason in the PR.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const PHONE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

export function scriptSources(html) {
  return [...new Set([...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((match) => match[1]))];
}

export function overBudget(measured, budgets) {
  return Object.entries(budgets)
    .filter(([route, limit]) => measured[route] > limit)
    .map(([route, limit]) => ({ route, kb: measured[route], limit }));
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

async function routeKb(base, route) {
  const response = await fetch(base + route, { headers: { "user-agent": PHONE_UA } });
  if (!response.ok) throw new Error(`${route} answered ${response.status}`);
  let bytes = 0;
  for (const src of scriptSources(await response.text())) {
    const script = await fetch(base + src);
    bytes += gzipSync(Buffer.from(await script.arrayBuffer()), { level: 9 }).length;
  }
  return Math.round(bytes / 1024);
}

async function main() {
  const { budgets } = JSON.parse(readFileSync(join(process.cwd(), "script-budget.json"), "utf8"));
  const port = 41000 + Math.floor(Math.random() * 2000);
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
