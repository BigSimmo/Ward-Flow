#!/usr/bin/env node
// H-0965: a TV and a desk left open for a long time. LOCAL ONLY, synthetic data only.
// Opens the bed meeting TV and one ward board in headless Chromium against a local production
// build, leaves them running and samples each page's JS heap (Chrome DevTools Performance metrics)
// every few minutes, before and after a forced garbage collection, into a CSV.
//
//   npm run build   (once, first)
//   node scripts/ward-flow/browser-soak.mjs --out <folder> [--hours 24] [--every-minutes 10] [--port 3917]
//
// It starts `next start` on 127.0.0.1 itself. To stop early, create the file `STOP` in the output
// folder (checked every 30 s); the browser and server are closed and the CSV kept. Its PID is in
// `soak.pid` there.
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { values } = parseArgs({
  options: {
    out: { type: "string" },
    hours: { type: "string", default: "24" },
    "every-minutes": { type: "string", default: "10" },
    port: { type: "string", default: "3917" },
  },
});
if (!values.out) throw new Error("Pass --out <folder> for the CSV, PID and STOP files");
const out = path.resolve(values.out);
mkdirSync(out, { recursive: true });
const csv = path.join(out, "heap.csv");
const stopFile = path.join(out, "STOP");
rmSync(stopFile, { force: true });
writeFileSync(path.join(out, "soak.pid"), `${process.pid}\n`);
const base = `http://127.0.0.1:${values.port}`;
const pages = {
  tv: `${base}/ward-flow/bed-meeting?service=all`,
  desk: `${base}/ward-flow/board/rph-adult-secure`,
};
const log = (message) => appendFileSync(path.join(out, "soak.log"), `${new Date().toISOString()} ${message}\n`);

const server = spawn(
  process.execPath,
  [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", values.port, "-H", "127.0.0.1"],
  { cwd: root, stdio: "ignore", windowsHide: true },
);
async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await fetch(`${base}/ward-flow`)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Local server did not start");
}

const MiB = 1048576;
const round = (value) => Math.round((value / MiB) * 100) / 100;

async function metrics(client) {
  const { metrics: list } = await client.send("Performance.getMetrics");
  return Object.fromEntries(list.map((metric) => [metric.name, metric.value]));
}

async function main() {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const opened = [];
  for (const [name, url] of Object.entries(pages)) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });
    const client = await context.newCDPSession(page);
    await client.send("Performance.enable");
    opened.push({ name, page, client });
  }
  if (!existsSync(csv))
    writeFileSync(
      csv,
      "isoTime,minutes,page,heapUsedMiB,heapUsedAfterGcMiB,heapTotalMiB,domNodes,listeners,documents,frames\n",
    );
  const started = Date.now();
  const until = started + Number(values.hours) * 3_600_000;
  const every = Number(values["every-minutes"]) * 60_000;
  let next = started;
  log(`started pid=${process.pid} csv=${csv}`);
  while (Date.now() < until && !existsSync(stopFile)) {
    if (Date.now() >= next) {
      for (const { name, client } of opened) {
        try {
          const before = await metrics(client);
          await client.send("HeapProfiler.collectGarbage");
          const after = await metrics(client);
          appendFileSync(
            csv,
            [
              new Date().toISOString(),
              Math.round((Date.now() - started) / 60_000),
              name,
              round(before.JSHeapUsedSize),
              round(after.JSHeapUsedSize),
              round(after.JSHeapTotalSize),
              after.Nodes,
              after.JSEventListeners,
              after.Documents,
              after.Frames,
            ].join(",") + "\n",
          );
        } catch (error) {
          log(`sample failed for ${name}: ${String(error).slice(0, 200)}`);
        }
      }
      next += every;
    }
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
  log(existsSync(stopFile) ? "stopped by STOP file" : "finished");
  await browser.close();
}

try {
  await main();
} catch (error) {
  log(`failed: ${String(error).slice(0, 300)}`);
  process.exitCode = 1;
} finally {
  server.kill();
}
