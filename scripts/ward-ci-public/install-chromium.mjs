import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { APT_ARCHIVES } from "./apt-archive-cache.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cli = resolve(root, "node_modules/playwright/cli.js");

/** GNU timeout kills the process group, including apt/download descendants, after a grace period. */
export function runBounded(command, args, timeoutMs) {
  return spawnSync("timeout", ["--signal=TERM", "--kill-after=5s", `${timeoutMs / 1000}s`, command, ...args], {
    stdio: "inherit",
    timeout: timeoutMs + 10_000,
    killSignal: "SIGKILL",
  });
}

/** A timed-out attempt can leave root apt-get holding the dpkg lock; let it finish before the retry. */
export function waitForPackageManager(deadline, now = Date.now) {
  while (now() < deadline && spawnSync("pgrep", ["^(apt-get|dpkg)$"]).status === 0) spawnSync("sleep", ["2"]);
}

/**
 * Six-minute shared budget, two attempts per operation; the workflow adds an eight-minute outer bound.
 * When the seed step has left cached system packages in apt's archive folder, they are installed
 * first with no network at all, then each browser must launch; only if that fails does the setup
 * fall back to Playwright's own apt-get, which needs the runner's Ubuntu mirror.
 * @param {{ browsers?: string[], cacheHit?: boolean, cachedDebs?: string[], execute?: (command: string, args: string[], timeoutMs: number) => { status: number | null, error?: { code?: string }, signal?: string | null }, now?: () => number, log?: (message: string) => void, waitForIdle?: (deadline: number) => void }} options
 */
export function installBrowsers({
  browsers = ["chromium"],
  cacheHit = false,
  execute = runBounded,
  now = Date.now,
  log = console.log,
  waitForIdle = execute === runBounded ? (deadline) => waitForPackageManager(deadline, now) : () => {},
  cachedDebs = execute === runBounded ? archiveDebs() : [],
} = {}) {
  if (
    !browsers.length ||
    new Set(browsers).size !== browsers.length ||
    browsers.some((browser) => !["chromium", "webkit", "firefox"].includes(browser))
  )
    throw new Error("Invalid browser selection; name unique supported engines");
  const label = browsers.length === 1 && browsers[0] === "chromium" ? "Chromium" : "Playwright browser";
  const deadline = now() + 360_000;
  if (cachedDebs.length && installOffline({ browsers, cachedDebs, execute, now, deadline, label, log }) === 0) return 0;
  const operations = cacheHit
    ? [
        ["install-deps", ...browsers],
        ["install", ...browsers],
      ]
    : [["install", "--with-deps", ...browsers]];
  for (const args of operations) {
    let installed = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (attempt > 1) waitForIdle(deadline);
      const remaining = deadline - now();
      if (remaining <= 0) {
        log(`${label} setup failed: six-minute installation budget exhausted.`);
        return 1;
      }
      log(`${label} setup: ${args[0]}, attempt ${attempt}/2.`);
      const result = execute(process.execPath, [cli, ...args], Math.min(120_000, remaining));
      if (!result.error && result.status === 0) {
        installed = true;
        break;
      }
      log(`${label} setup attempt failed (${result.error?.code ?? result.signal ?? result.status ?? "unknown"}).`);
    }
    if (!installed) return 1;
  }
  return 0;
}

/** The cached .deb files the seed step copied in; none when the cache missed. */
export function archiveDebs(dir = APT_ARCHIVES) {
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith(".deb"))
        .sort()
        .map((name) => join(dir, name))
    : [];
}

/** A fixed script; the Playwright path and the engine names arrive as arguments, never as code. */
const LAUNCH_PROBE = `const [playwright, ...names] = process.argv.slice(1);
const pw = require(playwright);
(async () => {
  for (const name of names) {
    const browser = await pw[name].launch();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});`;

/**
 * The runner's Ubuntu mirror can be unreachable for hours (11 Nov 2026: "Temporary failure
 * resolving 'azure.archive.ubuntu.com'"), and Playwright's install-deps always runs apt-get update
 * first. Install the cached packages as local files with downloads switched off, fetch the browsers
 * alone, and pass only if every browser launches. Any failure hands back to the online path.
 */
function installOffline({ browsers, cachedDebs, execute, now, deadline, label, log }) {
  log(`${label} setup: installing ${cachedDebs.length} cached system packages without the network.`);
  const steps = [
    ["sudo", ["apt-get", "install", "-y", "--no-download", "--no-install-recommends", ...cachedDebs], 120_000],
    [process.execPath, [cli, "install", ...browsers], 120_000],
    [process.execPath, ["-e", LAUNCH_PROBE, resolve(root, "node_modules/playwright"), ...browsers], 60_000],
  ];
  for (const [command, args, limit] of steps) {
    const remaining = deadline - now();
    const result = remaining > 0 ? execute(command, args, Math.min(limit, remaining)) : undefined;
    if (!result || result.error || result.status !== 0) {
      log(`${label} setup: the offline install did not finish; trying the runner's apt mirror.`);
      return 1;
    }
  }
  log(`${label} setup: installed from cached system packages; every browser launches.`);
  return 0;
}

// Existing consumers retain their default Chromium-only command and retry budget.
/** Compatibility entry point for callers requesting Chromium only. @param {Parameters<typeof installBrowsers>[0]} [options] */
export function installChromium(options) {
  return installBrowsers(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  process.exitCode = installBrowsers({
    ...(process.argv.length > 2 ? { browsers: process.argv.slice(2) } : {}),
    cacheHit: process.env.PLAYWRIGHT_CACHE_HIT === "true",
  });
