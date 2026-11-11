import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

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
 * @param {{ browsers?: string[], cacheHit?: boolean, execute?: (command: string, args: string[], timeoutMs: number) => { status: number | null, error?: { code?: string }, signal?: string | null }, now?: () => number, log?: (message: string) => void, waitForIdle?: (deadline: number) => void }} options
 */
export function installBrowsers({
  browsers = ["chromium"],
  cacheHit = false,
  execute = runBounded,
  now = Date.now,
  log = console.log,
  waitForIdle = execute === runBounded ? (deadline) => waitForPackageManager(deadline, now) : () => {},
} = {}) {
  if (
    !browsers.length ||
    new Set(browsers).size !== browsers.length ||
    browsers.some((browser) => !["chromium", "webkit", "firefox"].includes(browser))
  )
    throw new Error("Invalid browser selection; name unique supported engines");
  const label = browsers.length === 1 && browsers[0] === "chromium" ? "Chromium" : "Playwright browser";
  const deadline = now() + 360_000;
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
