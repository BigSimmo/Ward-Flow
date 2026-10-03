#!/usr/bin/env node
// Ward Flow desktop screenshots, fast: from a finished production build, four pages at a time, with
// a shared "before" set per line commit and a pixel compare that lists only the screens that changed.
//
//   node scripts/ward-flow/shots.mjs --set before|after (--url <http://127.0.0.1:port> | --dist <dist dir>)
//        [--line <commit>] [--label <branch>] [--routes all|<route>,<route>] [--concurrency 4]
//
//   --url      an already running production server (for example the journeys' `next start`);
//   --dist     a finished JOURNEYS build folder (`.next-playwright/<run-id>/dist`, built in offline
//              mockup mode): the script runs `next start` on a free port itself and stops it after.
//              A plain `npm run build` cannot serve the Ward Flow screens (mockups are off and it
//              needs the live Supabase settings), so --dist refuses `.next`. Best of all: set
//              WARD_SHOTS_SET on the gate's journeys run, which shoots from that build with no
//              second build or server (scripts/run-playwright.mjs).
//   --set before  shots of the line before your change; kept in
//              ward-flow-logs/shots/<line commit>/before and reused by every thread (skipped if
//              already there for every requested route).
//   --set after   shots of your branch, in ward-flow-logs/shots/<line commit>/after-<label>, then
//              compared with the before set: prints only the screens whose pixels changed.
// Desktop only (1440 x 900, light). Waits for hydration: the Ward rail has more than 4 links, or no
// rail. Run it through the slot script (it is a wide run):
//   node scripts/ward-flow/run-slot.mjs run wide "<thread>" -- node scripts/ward-flow/shots.mjs ...
import { spawn, execFileSync } from "node:child_process";
import { resolveAuditTarget } from "./local-audit-target.mjs";
import { createRequire } from "node:module";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require("sharp");

const LOGS = process.env.WARD_FLOW_LOGS ?? "D:/Repos/ward-flow-logs";
const LINE = "origin/main";
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);

const set = opt("--set");
const lineCommit = execFileSync("git", ["rev-parse", "--short=12", opt("--line", LINE)], { encoding: "utf8" }).trim();
const label = (
  opt("--label") ?? execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim()
).replace(/[^\w.-]+/g, "_");
const concurrency = Number(opt("--concurrency", "4"));
if (!["before", "after"].includes(set) || (!opt("--url") && !opt("--dist"))) {
  console.log(
    "Usage: shots.mjs --set before|after (--url <base> | --dist <dir>) [--line <commit>] [--label <b>] [--routes all|a,b]",
  );
  process.exit(2);
}
const routeArg = opt("--routes", "all");
const routes =
  routeArg === "all"
    ? fs.readFileSync(path.join(root, "scripts/ward-flow/shot-routes.txt"), "utf8").split(/\r?\n/).filter(Boolean)
    : routeArg
        .split(",")
        .map((route) => route.trim())
        // Git Bash rewrites a leading "/" argument into its own install folder
        // ("/mockups/x" -> "C:/Program Files/Git/mockups/x") unless MSYS_NO_PATHCONV=1 is set.
        // Undo that here, so nobody has to remember the variable.
        .map((route) => route.replace(/^[A-Za-z]:[\\/].*?[\\/]Git(?=[\\/]mockups[\\/])/i, "").replace(/\\/g, "/"));
const fileFor = (route) => `${route.replace(/^\/mockups\//, "").replace(/[/?=&]/g, "_") || "root"}.png`;

const setDir = path.join(LOGS, "shots", lineCommit, set === "before" ? "before" : `after-${label}`);
fs.mkdirSync(setDir, { recursive: true });
if (set === "before" && routes.every((route) => fs.existsSync(path.join(setDir, fileFor(route))))) {
  console.log(`shots: the before set for ${lineCommit} already has every requested screen: ${setDir}`);
  process.exit(0);
}

// The identity route only accepts Ward Flow's managed project port range, so an OS-assigned
// ephemeral port would make the self-launched server fail verification. Probe that range instead.
async function freePort() {
  const utils = await import(pathToFileURL(path.join(root, "src/lib/local-server-utils.mjs")).href);
  const span = utils.projectPortEnd - utils.projectPortStart + 1;
  const start = utils.projectPortStart + Math.floor(Math.random() * span);
  const available = (port) =>
    new Promise((resolve) => {
      const probe = net.createServer();
      probe.once("error", () => resolve(false));
      probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
    });
  for (const port of utils.circularProjectPortRange(start)) {
    if (!utils.isReservedDevPort(port) && (await available(port))) return port;
  }
  throw new Error("shots: no free port in the managed project range.");
}

const { offlineTestEnvironment } = await import(pathToFileURL(path.join(root, "scripts/test-environment.mjs")).href);
if (opt("--dist") && !/^\.next-playwright\/[a-z0-9-]+\/dist$/i.test(opt("--dist"))) {
  console.log(
    "shots: --dist must be a journeys build (.next-playwright/<run-id>/dist). A plain npm run build cannot serve the Ward Flow screens.",
  );
  process.exit(2);
}
let server = null;
let base = opt("--url");
if (!base) {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(port)], {
    cwd: root,
    // The same offline environment the journeys' own server gets, so the screens match theirs.
    env: offlineTestEnvironment(process.env, {
      NEXT_DIST_DIR: opt("--dist"),
      NODE_ENV: "production",
      PORT: String(port),
      PLAYWRIGHT_OFFLINE_MODE: "true",
      NEXT_PUBLIC_MOCKUPS_ENABLED: "true",
    }),
    stdio: "ignore",
  });
  const deadline = Date.now() + 180_000;
  for (;;) {
    try {
      const response = await fetch(`${base}/mockups/ward-flow`);
      if (response.status < 500) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      server.kill();
      console.log("shots: the production server did not start within 3 minutes.");
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

try {
  base = (await resolveAuditTarget({ root, url: base })).url;
} catch (error) {
  server?.kill();
  throw error;
}

// The Playwright client here can ask for a browser build that is not installed; fall back to the
// newest installed headless shell, so nobody has to set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH by hand.
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (() => {
    const store = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
    if (!fs.existsSync(store)) return undefined;
    const shells = fs
      .readdirSync(store)
      .filter((name) => /^chromium_headless_shell-\d+$/.test(name))
      .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))
      .map((name) => path.join(store, name, "chrome-headless-shell-win64", "chrome-headless-shell.exe"))
      .filter((file) => fs.existsSync(file));
    return shells[0];
  })();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: "light",
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
});

async function shoot(route) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error.message).slice(0, 200)));
    try {
      const response = await page.goto(base + route, { waitUntil: "networkidle", timeout: 120_000 });
      let hydrated = true;
      await page
        .waitForFunction(
          () => {
            const rail = document.querySelector('[data-testid="ward-rail"]');
            return !rail || rail.querySelectorAll('[data-testid="ward-rail-link"]').length > 4;
          },
          null,
          { timeout: 60_000 },
        )
        .catch(() => (hydrated = false));
      await page.addStyleTag({
        content:
          "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(setDir, fileFor(route)), fullPage: true });
      if (!hydrated) errors.push("NOT HYDRATED");
      return { route, status: response?.status() ?? null, errors };
    } catch (error) {
      if (attempt === 2) return { route, error: String(error.message).slice(0, 300) };
    } finally {
      await page.close().catch(() => {});
    }
  }
}

const started = Date.now();
const results = [];
const queue = [...routes];
await Promise.all(
  Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length) results.push(await shoot(queue.shift()));
  }),
);
await browser.close();
if (server) server.kill();
fs.writeFileSync(path.join(setDir, "results.json"), JSON.stringify(results, null, 1));
const failed = results.filter((result) => result.error || result.errors?.length);
console.log(`shots: ${results.length} screens in ${Math.round((Date.now() - started) / 1000)}s -> ${setDir}`);
for (const result of failed) console.log(`  PROBLEM ${result.route}: ${result.error ?? result.errors.join("; ")}`);

if (set === "after") {
  const beforeDir = path.join(LOGS, "shots", lineCommit, "before");
  const changed = [];
  const missing = [];
  for (const route of routes) {
    const [a, b] = [path.join(beforeDir, fileFor(route)), path.join(setDir, fileFor(route))];
    if (!fs.existsSync(a) || !fs.existsSync(b)) {
      missing.push(route);
      continue;
    }
    const [left, right] = await Promise.all(
      [a, b].map((file) => sharp(file).raw().toBuffer({ resolveWithObject: true })),
    );
    if (left.info.width !== right.info.width || left.info.height !== right.info.height) {
      changed.push(
        `${route} (size ${left.info.width}x${left.info.height} -> ${right.info.width}x${right.info.height})`,
      );
      continue;
    }
    let differing = 0;
    const step = left.info.channels;
    for (let index = 0; index < left.data.length; index += step) {
      for (let channel = 0; channel < Math.min(step, 3); channel++) {
        if (Math.abs(left.data[index + channel] - right.data[index + channel]) > 16) {
          differing++;
          break;
        }
      }
    }
    if (differing > 0) changed.push(`${route} (${differing} pixels differ)`);
  }
  console.log(`shots: ${changed.length} of ${routes.length} screens changed against the before set of ${lineCommit}.`);
  for (const entry of changed) console.log(`  CHANGED ${entry}`);
  for (const route of missing) console.log(`  NO BEFORE SHOT ${route} (take the before set first)`);
}
process.exit(failed.length ? 1 : 0);
