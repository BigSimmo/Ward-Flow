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

/**
 * Six-minute shared budget, two attempts per operation; the workflow adds an eight-minute outer bound.
 * @param {{ cacheHit?: boolean, execute?: (command: string, args: string[], timeoutMs: number) => { status: number | null, error?: { code?: string }, signal?: string | null }, now?: () => number, log?: (message: string) => void }} options
 */
export function installChromium({ cacheHit = false, execute = runBounded, now = Date.now, log = console.log } = {}) {
  const deadline = now() + 360_000;
  const operations = cacheHit
    ? [
        ["install-deps", "chromium"],
        ["install", "chromium"],
      ]
    : [["install", "--with-deps", "chromium"]];
  for (const args of operations) {
    let installed = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const remaining = deadline - now();
      if (remaining <= 0) {
        log("Chromium setup failed: six-minute installation budget exhausted.");
        return 1;
      }
      log(`Chromium setup: ${args[0]}, attempt ${attempt}/2.`);
      const result = execute(process.execPath, [cli, ...args], Math.min(120_000, remaining));
      if (!result.error && result.status === 0) {
        installed = true;
        break;
      }
      log(`Chromium setup attempt failed (${result.error?.code ?? result.signal ?? result.status ?? "unknown"}).`);
    }
    if (!installed) return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  process.exitCode = installChromium({ cacheHit: process.env.PLAYWRIGHT_CACHE_HIT === "true" });
