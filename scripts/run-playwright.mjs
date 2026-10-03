#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { childProcessExitCode, childProcessFailureSummary } from "./child-process-result.mjs";
import { assertPlaywrightBrowsersReady } from "./playwright-browser-preflight.mjs";
import { removePathSync } from "./retryable-fs.mjs";
import { offlineTestEnvironment } from "./test-environment.mjs";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";
import { runOwnedChild } from "./owned-child.mjs";
import { knownFailurePatternFromEnvironment } from "./ward-flow/known-journey-failures.mjs";
import { journeyRunVerdict, requestedProjects } from "./ward-flow/journey-run-verdict.mjs";
import { keepJourneyFailures } from "./ward-flow/keep-journey-failures.mjs";
import {
  appName,
  circularProjectPortRange,
  isReservedDevPort,
  localProjectId,
  stableProjectPort,
} from "../src/lib/local-server-utils.mjs";

if (Number(process.versions.node.split(".")[0]) !== 24) {
  console.error(`Ward Flow Playwright checks require Node 24.x. Current runtime: ${process.versions.node}.`);
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playwrightBin = path.join(projectRoot, "node_modules", "playwright", "cli.js");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const identityPath = "/api/local-project-id";
const startupTimeoutMs = 180_000;
const missingErrorComponentsNeedle = "missing required error components";
// WARD_ONLY_BUILD=1 builds only the Ward Flow routes (R27), so the readiness probe must use them too.
const wardOnlyRequested = process.env.WARD_ONLY_BUILD === "1";
const WARD_ONLY_BUILD_PATHS = [
  "app/mockups/ward-flow/**",
  "app/mockups/ward-flow-sign-in/**",
  "app/mockups/ward-flow-digest/**",
  "app/api/local-project-id/**",
].join(",");
const wardSmokePaths = ["/mockups/ward-flow", "/mockups/ward-flow/capacity"];
let routeSmokePaths;
// Ward Flow is the only app left (PsychSift removal, 25 September 2026), so a full build is
// probed on the same Ward Flow pages as a ward-only build.
const fullRouteSmokePaths = wardSmokePaths;
routeSmokePaths = fullRouteSmokePaths;
/**
 * What `playwright test` receives, exactly as the caller wrote it, and what the browser preflight
 * reads.
 */
const playwrightArgs = process.argv.slice(2);
// Known-failing journeys run in their own fast-failing project (playwright.config.ts); add it
// whenever the mockups project is requested and the list has entries. playwright.config.ts only
// defines that project when the list names at least one test, so an emptied list must not ask for
// it (26 September 2026: it did, Playwright said "project not found", and 0 tests ran).
if (
  knownFailurePatternFromEnvironment() !== null &&
  playwrightArgs.some(
    (argument, index) =>
      argument === "--project=chromium-mockups" ||
      (argument === "--project" && playwrightArgs[index + 1] === "chromium-mockups"),
  )
) {
  playwrightArgs.push("--project=chromium-mockups-known");
}
// WARD_JOURNEY_GROUP="<index>/<count>" (public CI): run only group <index> of the same
// duration-balanced split WARD_JOURNEY_SHARDS=<count> would make, on this run's single server. Each
// CI runner then has a whole machine to itself; three shards sharing one 4-core runner made
// timing-sensitive journeys fail (28 September 2026). The groups partition the selected spec files,
// so the <count> runs together cover every spec once.
const journeyGroup = process.env.WARD_JOURNEY_GROUP;
if (journeyGroup) {
  const match = /^(\d+)\/(\d+)$/.exec(journeyGroup);
  const index = match ? Number(match[1]) : Number.NaN;
  const count = match ? Number(match[2]) : Number.NaN;
  const groups = index >= 1 && index <= count ? balancedShardGroups(playwrightArgs, count) : null;
  if (!groups || process.env.WARD_JOURNEY_SHARDS) {
    console.error(
      `WARD_JOURNEY_GROUP must be "<index>/<count>" over spec-file filters, without WARD_JOURNEY_SHARDS; got "${journeyGroup}".`,
    );
    process.exit(2);
  }
  const flags = playwrightArgs.filter((argument) => argument.startsWith("-"));
  playwrightArgs.splice(0, playwrightArgs.length, ...flags, ...groups[index - 1].files);
  console.log(
    `Journey group ${index}/${count}: ${Math.round(groups[index - 1].seconds)}s measured, ${groups[index - 1].files.join(", ")}`,
  );
}
const explicitProjectRequested = playwrightArgs.some(
  (argument) => argument === "--project" || argument.startsWith("--project="),
);
const mockupProjectRequested =
  !explicitProjectRequested ||
  playwrightArgs.some(
    (argument, index) =>
      argument === "--project=chromium-mockups" ||
      (argument === "--project" && playwrightArgs[index + 1] === "chromium-mockups"),
  );
// Fail loud on missing browser binaries before the heavy lock or production build.
// Otherwise launch failures surface as "N failed" product tests and are easy to misread
// when a caller pipes output without `pipefail` (outstanding-issues #120).
const browserPreflight = assertPlaywrightBrowsersReady(playwrightArgs);
const preinstalledChromium = browserPreflight.checked.find(
  (entry) => entry.source === "preinstalled container Chromium (PLAYWRIGHT_BROWSERS_PATH)",
);
if (preinstalledChromium && !process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = preinstalledChromium.path;
  console.error(
    `[playwright] Managed Chromium is unavailable; using the preinstalled container browser at ${preinstalledChromium.path}.`,
  );
}

const requestedRunId = process.env.PLAYWRIGHT_BUILD_ROOT_ID?.trim();
if (requestedRunId && !/^[a-z0-9-]+$/i.test(requestedRunId)) {
  console.error("PLAYWRIGHT_BUILD_ROOT_ID must contain only letters, numbers, and hyphens.");
  process.exit(1);
}
const keepBuildRootValue = process.env.PLAYWRIGHT_KEEP_BUILD_ROOT?.trim();
if (keepBuildRootValue && keepBuildRootValue !== "true") {
  console.error('PLAYWRIGHT_KEEP_BUILD_ROOT must be unset or exactly "true".');
  process.exit(1);
}
const keepBuildRoot = keepBuildRootValue === "true";
if (keepBuildRoot && !requestedRunId) {
  console.error("PLAYWRIGHT_KEEP_BUILD_ROOT requires PLAYWRIGHT_BUILD_ROOT_ID.");
  process.exit(1);
}
const runId = requestedRunId || `${process.pid}-${Date.now()}`;
const relativeRunRoot = `.next-playwright/${runId}`;
const absoluteRunRoot = path.join(projectRoot, relativeRunRoot);
const relativeDistDir = `${relativeRunRoot}/dist`;
const relativeTsConfigPath = `${relativeRunRoot}/tsconfig.json`;
const configuredWaitTimeoutMs = Number(process.env.HEAVY_RUN_WAIT_TIMEOUT_MS);
const waitTimeoutMs = Number.isFinite(configuredWaitTimeoutMs) ? configuredWaitTimeoutMs : undefined;
const ADMISSION_BUSY_EXIT = 75;
const ADMISSION_BUSY_MARKER = "DATABASE_HEAVY_RUN_ADMISSION_BUSY";
// Match only the coordinator's actual capacity/timeout messages (test-run-lock.mjs
// busyMessage() and the initializing-coordinator branch) — not every error that
// merely mentions "Database heavyweight", such as an inherited-lease mismatch or a
// coordinator-directory setup failure. Those are configuration bugs, not admission
// contention, and must keep failing with the ordinary exit 1 below.
const ADMISSION_BUSY_PATTERN =
  /^(?:Database focused-test capacity is full|Another Database heavyweight command is active|A Database heavyweight coordinator is being initialized\b.*retry shortly\.)/;

let lock;
try {
  lock = acquireHeavyRunLock({
    projectRoot,
    command: `playwright ${playwrightArgs.join(" ")}`,
    ...(waitTimeoutMs === undefined ? {} : { waitTimeoutMs }),
  });
} catch (error) {
  const message = String(error?.message ?? error);
  if (ADMISSION_BUSY_PATTERN.test(message)) {
    console.error(ADMISSION_BUSY_MARKER);
    console.error(`Playwright did not run: ${message}`);
    console.error("Wait for the active heavyweight run to finish, then retry this command.");
    process.exit(ADMISSION_BUSY_EXIT);
  }
  console.error(message);
  process.exit(1);
}

if (process.env.WARD_OWNED_PLAYWRIGHT !== "1") {
  try {
    const result = await runOwnedChild(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
      cwd: projectRoot,
      env: { ...lock.environment, WARD_OWNED_PLAYWRIGHT: "1" },
    });
    process.exitCode = childProcessExitCode(result);
  } finally {
    lock.release();
  }
  process.exit(process.exitCode);
}
if (!lock.reentrant) {
  lock.release();
  throw new Error("Owned Playwright collector requires validated inherited admission");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canListenOnHost(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => resolve(error.code === "EAFNOSUPPORT" || error.code === "EADDRNOTAVAIL"));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, host);
  });
}

function canConnectToHost(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(250);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

async function canListen(port) {
  for (const host of ["127.0.0.1", "localhost", "::1"]) if (await canConnectToHost(port, host)) return false;
  for (const host of ["127.0.0.1", "localhost", "::1", "0.0.0.0", "::"]) {
    if (!(await canListenOnHost(port, host))) return false;
  }
  return true;
}

async function findFreePort(startPort) {
  for (const port of circularProjectPortRange(startPort)) {
    if (!isReservedDevPort(port) && (await canListen(port))) return port;
  }
  throw new Error("No free Playwright server port found in the configured project range.");
}

function request(url, { json = false, timeoutMs = 30_000 } = {}) {
  return new Promise((resolve) => {
    const pending = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 400) return resolve(null);
        if (!json) return resolve(body);
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    pending.on("timeout", () => {
      pending.destroy();
      resolve(null);
    });
    pending.on("error", () => resolve(null));
  });
}

function isVerifiedProjectPayload(payload) {
  return (
    payload?.appName === appName &&
    payload?.projectId === localProjectId(projectRoot) &&
    payload?.localServer?.safeLocalOrigin === true
  );
}

async function waitForServer(baseUrl, server) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < startupTimeoutMs) {
    // Per-child rather than one module-level slot: this runner can own several servers (one per
    // journey shard), and a shared slot would report one server's launch failure against another
    // and send a reader to the wrong process.
    if (server.launchError) {
      throw new Error(`Playwright-owned Next server failed to launch: ${server.launchError.message}`);
    }
    if (server.exitCode !== null || server.signalCode) {
      throw new Error(
        `Playwright-owned Next server exited before readiness (${server.exitCode !== null ? `code ${server.exitCode}` : `signal ${server.signalCode}`}).`,
      );
    }
    const payload = await request(`${baseUrl}${identityPath}`, { json: true, timeoutMs: 5000 });
    if (isVerifiedProjectPayload(payload)) {
      let healthy = true;
      for (const smokePath of routeSmokePaths) {
        // request() returns null on transport/status failure, or a string body on
        // 2xx/3xx (including empty redirect bodies from legacy route handlers).
        const body = await request(`${baseUrl}${smokePath}`);
        if (body === null || body.includes(missingErrorComponentsNeedle)) {
          healthy = false;
          break;
        }
      }
      if (healthy) return;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for the Playwright-owned Ward Flow server at ${baseUrl}.`);
}

/**
 * One `next start` from this run's isolated build, on one port, with one environment.
 *
 * Both servers go through here so the launch shape — detached process group, inherited stdio, and
 * the per-child `launchError` `waitForServer` reads — cannot drift between them.
 */
function startIsolatedServer(serverPort, env) {
  const child = spawn(process.execPath, [nextBin, "start", "--hostname", "0.0.0.0", "--port", String(serverPort)], {
    cwd: projectRoot,
    detached: process.platform !== "win32",
    env,
    stdio: ["ignore", "inherit", "inherit"],
    windowsHide: true,
  });
  child.once("error", (error) => {
    child.launchError = error;
  });
  return child;
}

function stopOwnedProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

/**
 * Split the journey spec files a run selects into `count` groups of roughly equal measured time.
 * Returns null (use --shard) when the positional filters do not name spec files by path, or when a
 * --grep style option narrows tests inside files.
 */
function balancedShardGroups(args, count) {
  if (args.some((argument) => /^(--grep|-g|--grep-invert|--last-failed|--only-changed)/.test(argument))) return null;
  const filters = args.filter(
    (argument, index) =>
      !argument.startsWith("-") &&
      !args[index - 1]?.match(/^--(project|workers|reporter|output|shard|timeout|retries|max-failures)$/),
  );
  if (filters.length === 0) return null;
  const specs = readdirSync(path.join(projectRoot, "tests")).filter(
    (name) => /\.spec\.ts$/.test(name) && filters.some((filter) => new RegExp(filter).test(`tests/${name}`)),
  );
  if (specs.length < count) return null;
  let durations = {};
  try {
    durations = JSON.parse(
      readFileSync(path.join(projectRoot, "scripts/ward-flow/journey-durations.json"), "utf8"),
    ).seconds;
  } catch {
    // no measurements yet: every file counts the same
  }
  const known = Object.values(durations).sort((a, b) => a - b);
  const median = known.length ? known[Math.floor(known.length / 2)] : 1;
  const groups = Array.from({ length: count }, () => ({ seconds: 0, files: [] }));
  for (const spec of specs
    .map((name) => ({ name, seconds: durations[name] ?? median }))
    .sort((a, b) => b.seconds - a.seconds)) {
    const lightest = groups.reduce((best, group) => (group.seconds < best.seconds ? group : best));
    lightest.files.push(spec.name);
    lightest.seconds += spec.seconds;
  }
  return groups;
}

let server;
/** The build's type check when it runs beside the journeys (WARD_GATE_PARALLEL_TSC=1). */
let parallelTypeCheck = null;
/** The primary server's URL once it is up, for screenshots taken from this build. */
let activeBaseUrl = null;

/**
 * WARD_SHOTS_SET=before|after (Ward Flow): take the Ward Flow desktop screenshots from THIS run's
 * finished build and server, after the journeys, instead of building the app a second time. The
 * journeys build is the only one in offline mockup mode, so it is the only one the screens render
 * from. WARD_SHOTS_LABEL names an after set; WARD_SHOTS_ROUTES narrows the screens (default all).
 * Screenshot problems are reported but never change the journeys' exit code.
 */
function takeShotsFromThisBuild() {
  const set = process.env.WARD_SHOTS_SET;
  if (!set || !activeBaseUrl) return;
  const shotArgs = [path.join(projectRoot, "scripts", "ward-flow", "shots.mjs"), "--set", set, "--url", activeBaseUrl];
  if (process.env.WARD_SHOTS_LABEL) shotArgs.push("--label", process.env.WARD_SHOTS_LABEL);
  if (process.env.WARD_SHOTS_ROUTES) shotArgs.push("--routes", process.env.WARD_SHOTS_ROUTES);
  if (process.env.WARD_SHOTS_LINE) shotArgs.push("--line", process.env.WARD_SHOTS_LINE);
  console.log(`Taking the ${set} screenshots from this build (${activeBaseUrl}).`);
  const shots = spawnSync(process.execPath, shotArgs, { cwd: projectRoot, stdio: "inherit" });
  console.log(`Screenshots: exit ${childProcessExitCode(shots)} (reported only; the journeys' result stands).`);
}

/** Wait for the parallel build type check, report it, then clean up and exit. */
async function exitAfterTypeCheck(runExitCode) {
  // The journeys' own status propagates; a failed build type check turns a pass into a failure.
  let exitCode = runExitCode;
  takeShotsFromThisBuild();
  if (parallelTypeCheck) {
    const result = await parallelTypeCheck;
    if (result.code !== 0) {
      console.error("Build type check (run beside the journeys) FAILED:");
      console.error(result.output.split("\n").slice(0, 60).join("\n"));
      exitCode = exitCode || 1;
    } else {
      console.log("Build type check (run beside the journeys): passed.");
    }
  }
  cleanup();
  process.exit(exitCode);
}
/** Extra `next start` servers for WARD_JOURNEY_SHARDS, one per shard after the first. */
const shardServers = [];
let cleaned = false;
/** A Playwright JSON report, or null when it is missing or unreadable. */
function readJsonReport(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try {
    // Every server, on every exit path: one left listening holds the heavy-run port past the run
    // that owned it.
    for (const shardServer of shardServers) stopOwnedProcessTree(shardServer);
    stopOwnedProcessTree(server);
    if (!keepBuildRoot) {
      removePathSync(absoluteRunRoot, { recursive: true });
      try {
        rmdirSync(path.dirname(absoluteRunRoot));
      } catch (error) {
        if (error?.code !== "ENOENT" && error?.code !== "ENOTEMPTY") throw error;
      }
    } else {
      console.log(`Keeping Playwright build root for cache reuse (${relativeRunRoot})`);
    }
  } catch (error) {
    console.error(`Playwright cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    lock.release();
  }
}

process.once("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.once("SIGTERM", () => {
  cleanup();
  process.exit(143);
});
process.once("exit", cleanup);

// This isolated run's tsconfig.json (below) cannot simply inherit the root
// tsconfig.json's `exclude` — see the comment on `include`/`exclude` at its call
// site for why the whole include/exclude pair must be redeclared rather than left
// unset. But redeclaring `exclude` as a second hand-typed copy of the root's list
// is exactly the shape that has gone stale before: two near-identical lists where
// only one gets a fix. Derive it from the root config instead, so there is only
// one list to maintain — this reads the root config through TypeScript's own
// JSONC-tolerant parser (tsconfig.json allows comments; a plain JSON.parse would
// break on them) and prefixes each root-relative entry with the `../../` this
// isolated run root needs, then appends only the entries genuinely specific to
// this isolated build (currently just `.next/**`, justified above).
function deriveIsolatedRunExclude(rootProjectRoot, isolatedRunExtraEntries) {
  const rootTsconfigPath = path.join(rootProjectRoot, "tsconfig.json");
  const { config, error } = ts.readConfigFile(rootTsconfigPath, (file) => readFileSync(file, "utf8"));
  if (error) {
    throw new Error(
      `Could not parse ${rootTsconfigPath} while deriving the isolated Playwright run's tsconfig exclude list: ${ts.flattenDiagnosticMessageText(error.messageText, "\n")}`,
    );
  }
  const rootExclude = config?.exclude;
  if (!Array.isArray(rootExclude) || rootExclude.length === 0) {
    throw new Error(
      `${rootTsconfigPath} has no non-empty "exclude" array; the isolated Playwright run's tsconfig cannot derive one from it.`,
    );
  }
  const derivedEntries = rootExclude.map((entry) => {
    if (typeof entry !== "string" || entry.length === 0 || entry.startsWith("/") || entry.startsWith(".")) {
      throw new Error(
        `${rootTsconfigPath} "exclude" entry ${JSON.stringify(entry)} is not a plain root-relative pattern; the isolated Playwright run's tsconfig cannot safely rewrite it to "../../".`,
      );
    }
    return `../../${entry}`;
  });
  return [...derivedEntries, ...isolatedRunExtraEntries];
}

try {
  const port = await findFreePort(stableProjectPort(projectRoot));
  const baseUrl = `http://localhost:${port}`;
  mkdirSync(absoluteRunRoot, { recursive: true });
  writeFileSync(
    path.join(absoluteRunRoot, "tsconfig.json"),
    `${JSON.stringify(
      {
        extends: "../../tsconfig.json",
        compilerOptions: {
          // TypeScript 6 deprecates baseUrl (TS5101). Next 16.3+ typechecks this
          // isolated config during `next build`, so silence until paths migrate.
          ignoreDeprecations: "6.0",
          baseUrl: "../..",
          paths: { "@/*": ["src/*"] },
        },
        // Declaring include/exclude here (rather than leaving them unset and
        // inheriting the root tsconfig.json's) is deliberate. TypeScript resolves
        // an extended config's *inherited* relative include/exclude entries
        // against the repo root, so an unset include here would still resolve
        // "**/*.ts" and ".next/dev/types/**/*.ts" against the shared top-level
        // .next/ directory — not this isolated run's own NEXT_DIST_DIR output
        // under `dist/`. That pulls stale/foreign route types from whatever the
        // top-level .next happens to contain (a prior `npm run dev` or `npm run
        // build`) into this run's typecheck. Excluding the repo-root .next/ and
        // pointing at this run's own dist/types + dist/dev/types keeps the
        // isolated build's typecheck scoped to itself (outstanding-issues #210).
        // `include` stays hand-declared for that reason. `exclude` does not: it is
        // derived from the root tsconfig.json's own "exclude" (deriveIsolatedRunExclude,
        // above) plus this isolated build's own `.next/**` entry, so the two configs
        // cannot silently diverge on the entries they share.
        include: [
          "../../next-env.d.ts",
          "../../**/*.ts",
          "../../**/*.tsx",
          "../../**/*.mts",
          "dist/types/**/*.ts",
          "dist/dev/types/**/*.ts",
        ],
        exclude: deriveIsolatedRunExclude(projectRoot, ["../../.next/**"]),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const offlineEnv = offlineTestEnvironment(lock.environment, {
    PORT: String(port),
    PLAYWRIGHT_BASE_URL: baseUrl,
    NEXT_DIST_DIR: relativeDistDir,
    NEXT_TSCONFIG_PATH: relativeTsConfigPath,
    NODE_ENV: "production",
    PLAYWRIGHT_OFFLINE_MODE: "true",
    NEXT_PUBLIC_MOCKUPS_ENABLED: mockupProjectRequested ? "true" : "false",
  });
  // WARD_BUILD_CACHE_DIR (Ward Flow gate, Josh 25 September R26): reuse Next's working cache between
  // gate builds, never the finished output. The cache is copied into this run's fresh dist/cache before
  // the build and copied back out after a good build. Next validates every cache entry against the
  // current source, so a warm cache changes speed, not what is built.
  const buildCacheDir = process.env.WARD_BUILD_CACHE_DIR?.trim();
  const runCacheDir = path.join(absoluteRunRoot, "dist", "cache");
  if (buildCacheDir && existsSync(buildCacheDir)) {
    cpSync(buildCacheDir, runCacheDir, { recursive: true });
    console.log(`Seeded the build cache from ${buildCacheDir}`);
  }
  console.log(`Building isolated production Playwright app (${relativeRunRoot})`);

  // WARD_GATE_PARALLEL_TSC=1 (Ward Flow gate, Josh 25 September): the build skips its own type
  // check (WARD_GATE_BUILD=1) and the SAME check (this run's isolated tsconfig, which includes the
  // build's generated route types) runs beside the journeys instead of before them. The run fails if
  // it fails, so nothing is checked less; it only leaves the critical path.
  const parallelTscRequested = process.env.WARD_GATE_PARALLEL_TSC === "1";
  if (parallelTscRequested) offlineEnv.WARD_GATE_BUILD = "1";
  const buildArgs = ["--max-old-space-size=8192", nextBin, "build", "--webpack"];
  const runBuild = (extra) =>
    spawnSync(process.execPath, [...buildArgs, ...extra], {
      cwd: projectRoot,
      env: offlineEnv,
      stdio: "inherit",
    });
  let wardOnlyBuilt = false;
  let buildResult;
  if (wardOnlyRequested) {
    console.log(`Ward-only build (WARD_ONLY_BUILD=1): ${WARD_ONLY_BUILD_PATHS}`);
    buildResult = runBuild([`--debug-build-paths=${WARD_ONLY_BUILD_PATHS}`]);
    wardOnlyBuilt = childProcessExitCode(buildResult) === 0;
    if (!wardOnlyBuilt) console.log("Ward-only build failed; falling back to a full build.");
    // A ward-only build can exit 0 having compiled only /404 (a40f6babe2, 26 September): the
    // server then never answers the ward pages and the run timed out instead of falling back.
    // Read what was built, and fall back unless the Ward Flow home page is in it.
    if (wardOnlyBuilt) {
      let builtRoutes = [];
      try {
        const manifestPath = path.join(absoluteRunRoot, "dist", "server", "app-paths-manifest.json");
        builtRoutes = Object.keys(JSON.parse(readFileSync(manifestPath, "utf8")));
      } catch {
        builtRoutes = [];
      }
      if (!builtRoutes.includes("/mockups/ward-flow/page")) {
        console.log(
          `Ward-only build is incomplete (${builtRoutes.length} route(s), no Ward Flow home page); falling back to a full build.`,
        );
        wardOnlyBuilt = false;
      }
    }
  }
  if (!wardOnlyBuilt) buildResult = runBuild([]);
  const buildExitCode = childProcessExitCode(buildResult);
  if (wardOnlyBuilt) routeSmokePaths = wardSmokePaths;
  if (buildExitCode !== 0) {
    const memory = process.memoryUsage();
    console.error(
      `[playwright] build diagnostics: status=${buildResult.status}, signal=${buildResult.signal ?? "none"}, error=${buildResult.error?.message ?? "none"}, memory(rss=${Math.round(memory.rss / (1024 * 1024))}MB, heapTotal=${Math.round(memory.heapTotal / (1024 * 1024))}MB, heapUsed=${Math.round(memory.heapUsed / (1024 * 1024))}MB)`,
    );
    throw new Error(`Playwright production build failed (${childProcessFailureSummary(buildResult)}).`);
  }

  if (buildCacheDir && existsSync(runCacheDir)) {
    // Copy out to a temporary folder first, then swap, so a failed copy never leaves a half cache.
    const staging = `${buildCacheDir}.incoming-${process.pid}`;
    removePathSync(staging, { recursive: true });
    cpSync(runCacheDir, staging, { recursive: true });
    removePathSync(buildCacheDir, { recursive: true });
    renameSync(staging, buildCacheDir);
    console.log(`Saved the build cache to ${buildCacheDir}`);
  }

  if (parallelTscRequested) {
    console.log("Build type check running beside the journeys (WARD_GATE_PARALLEL_TSC=1).");
    parallelTypeCheck = new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        [
          path.join(projectRoot, "node_modules", "typescript", "bin", "tsc"),
          "-p",
          relativeTsConfigPath,
          "--noEmit",
          "--tsBuildInfoFile",
          path.join(absoluteRunRoot, "parallel-tsc.tsbuildinfo"),
        ],
        { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] },
      );
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      child.on("error", (error) => resolve({ code: 1, output: String(error.message) }));
      child.on("close", (code) => resolve({ code: code ?? 1, output }));
    });
  }

  console.log(`Starting isolated production Playwright server at ${baseUrl} (${relativeRunRoot})`);

  server = startIsolatedServer(port, offlineEnv);
  // A ward-only server that never becomes ready falls back to a full build like a missing screen
  // does, rather than failing the run on a timeout. A full build's server failing still throws.
  let wardOnlyServerFailed = false;
  try {
    await waitForServer(baseUrl, server);
  } catch (error) {
    if (!wardOnlyBuilt) throw error;
    console.log(
      `Ward-only build's server did not become ready (${error instanceof Error ? error.message : String(error)}).`,
    );
    wardOnlyServerFailed = true;
  }
  activeBaseUrl = baseUrl;

  // Ward-only build: every Ward Flow screen the journeys and screenshots visit must answer. If any
  // does not, stop, build the whole app, and start again (R27's automatic fallback).
  if (wardOnlyBuilt) {
    const shotRoutes = readFileSync(path.join(projectRoot, "scripts/ward-flow/shot-routes.txt"), "utf8")
      .split(/\r?\n/)
      .filter(Boolean);
    const missing = wardOnlyServerFailed ? ["(the server itself)"] : [];
    if (!wardOnlyServerFailed)
      for (const route of shotRoutes) if ((await request(`${baseUrl}${route}`)) === null) missing.push(route);
    if (missing.length > 0) {
      console.log(`Ward-only build is missing ${missing.join(", ")}; falling back to a full build.`);
      stopOwnedProcessTree(server);
      const fullBuild = runBuild([]);
      if (childProcessExitCode(fullBuild) !== 0) {
        throw new Error(`Playwright production build failed (${childProcessFailureSummary(fullBuild)}).`);
      }
      routeSmokePaths = fullRouteSmokePaths;
      server = startIsolatedServer(port, offlineEnv);
      await waitForServer(baseUrl, server);
    } else {
      console.log(`Ward-only build answers all ${shotRoutes.length} Ward Flow screens.`);
    }
  }

  const testEnv = { ...offlineEnv };

  // WARD_JOURNEY_SHARDS=N (off unless set; Ward Flow fold gate only, once proven): split the specs
  // N ways with Playwright's --shard, each shard on its own `next start` from this same build and its
  // own output folder, all running at once. Ward Flow keeps no server-side state (every test's data
  // lives in its own browser context), so the shards cannot see each other's data. The exit code is
  // non-zero if any shard fails; a failing spec is then rerun alone, unsharded, before anyone is
  // blamed.
  const shardCount = Number(process.env.WARD_JOURNEY_SHARDS ?? "1");
  if (Number.isInteger(shardCount) && shardCount > 1) {
    const shardUrls = [baseUrl];
    for (let index = 2; index <= shardCount; index++) {
      const shardPort = await findFreePort(stableProjectPort(projectRoot));
      const shardUrl = `http://localhost:${shardPort}`;
      console.log(`Starting shard ${index} server at ${shardUrl} (${relativeRunRoot})`);
      const shardServer = startIsolatedServer(shardPort, {
        ...offlineEnv,
        PORT: String(shardPort),
        PLAYWRIGHT_BASE_URL: shardUrl,
      });
      shardServers.push(shardServer);
      await waitForServer(shardUrl, shardServer);
      shardUrls.push(shardUrl);
    }
    const reportFor = (index) => path.join(absoluteRunRoot, `shard-${index + 1}.json`);
    // Duration-weighted groups instead of Playwright's count-based --shard (batch 2: one shard held
    // every slow spec and took 10.9 minutes against 3.3 and 3.9). Each spec file the filters select
    // is placed, longest first, into the group with the least measured time so far
    // (scripts/ward-flow/journey-durations.json; an unmeasured file counts as the median). Falls
    // back to --shard when the selection cannot be listed.
    const shardGroups = balancedShardGroups(playwrightArgs, shardCount);
    if (shardGroups) {
      shardGroups.forEach((group, index) =>
        console.log(`Shard ${index + 1}: ${Math.round(group.seconds)}s measured, ${group.files.join(", ")}`),
      );
    }
    const shardArgsFor = (index) =>
      shardGroups
        ? [...playwrightArgs.filter((argument) => argument.startsWith("-")), ...shardGroups[index].files]
        : [...playwrightArgs, `--shard=${index + 1}/${shardCount}`];
    const codes = await Promise.all(
      shardUrls.map(
        (shardUrl, index) =>
          new Promise((resolve) => {
            const child = spawn(
              process.execPath,
              [
                playwrightBin,
                "test",
                ...shardArgsFor(index),
                `--output=test-results/shard-${index + 1}`,
                "--reporter=list,json",
              ],
              {
                cwd: projectRoot,
                env: {
                  ...testEnv,
                  PLAYWRIGHT_BASE_URL: shardUrl,
                  PLAYWRIGHT_JSON_OUTPUT_NAME: reportFor(index),
                },
                stdio: "inherit",
              },
            );
            child.on("close", (code) => resolve(code ?? 1));
          }),
      ),
    );
    // Merged report: every shard's counts, and the spec files that had a failing test.
    const totals = { passed: 0, failed: 0, skipped: 0, flaky: 0 };
    const failedFiles = new Set();
    // Which Playwright projects each failing file failed in, so a file whose ONLY failures are in the
    // known-failures project is not rerun (gate speed-up, Josh 26 September).
    const failedFileProjects = new Map();
    const walk = (suite, file) => {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          const status = test.status === "expected" ? "passed" : test.status === "unexpected" ? "failed" : test.status;
          if (status in totals) totals[status]++;
          if (status === "failed") {
            const failedFile = file ?? spec.file;
            failedFiles.add(failedFile);
            if (!failedFileProjects.has(failedFile)) failedFileProjects.set(failedFile, new Set());
            failedFileProjects.get(failedFile).add(test.projectName);
          }
        }
      }
      for (const child of suite.suites ?? []) walk(child, file ?? suite.file);
    };
    codes.forEach((code, index) => {
      try {
        for (const suite of JSON.parse(readFileSync(reportFor(index), "utf8")).suites ?? []) walk(suite, suite.file);
      } catch {
        if (code !== 0) failedFiles.add(`(shard ${index + 1} left no report)`);
      }
      console.log(`Shard ${index + 1}/${shardCount}: exit ${code}`);
    });
    console.log(
      `Sharded journeys: ${totals.passed} passed, ${totals.failed} failed, ${totals.skipped} skipped, ${totals.flaky} flaky.`,
    );
    let exitCode = codes.find((code) => code !== 0) ?? 0;
    const shardVerdict = journeyRunVerdict(
      codes.map((code, index) => ({ label: `Shard ${index + 1}`, code, report: readJsonReport(reportFor(index)) })),
      requestedProjects(playwrightArgs),
    );
    if (!shardVerdict.ok) {
      for (const problem of shardVerdict.problems) console.error(`Journeys run is not trustworthy: ${problem}.`);
      // A run that did not really run cannot pass, and a rerun of "failed files" cannot rescue it.
      await exitAfterTypeCheck(exitCode === 0 ? 1 : exitCode);
    }
    // G4: a spec that failed in a shard is rerun alone, unsharded, on the primary server, before
    // any branch is blamed. The rerun's result is the verdict.
    //
    // Gate speed-up (Josh, 26 September): a file whose ONLY failures are in the known-failures
    // project ("chromium-mockups-known") is not rerun. Those tests already ran once, in their own
    // fast-fail project, and the expected-reds comparison reads that run; a second run adds about
    // eleven minutes and no information. The exit code is unchanged either way, and any failure in
    // any other project still sends its file to the rerun, whose result is still the verdict.
    const specFailures = [...failedFiles].filter((file) => file.endsWith(".spec.ts"));
    const rerun = specFailures.filter((file) =>
      [...(failedFileProjects.get(file) ?? [])].some((project) => project !== "chromium-mockups-known"),
    );
    const knownOnly = specFailures.filter((file) => !rerun.includes(file));
    if (knownOnly.length > 0) {
      console.log(
        `Not rerunning ${knownOnly.length} spec file(s) that failed only on the known list: ${knownOnly.join(", ")}`,
      );
    }
    // Keep the shards' failure artefacts before anything can overwrite them: the unsharded rerun
    // below writes to test-results/ and wiped them (full-journey:126, 26 September 2026).
    if (exitCode !== 0) {
      try {
        const kept = keepJourneyFailures({
          projectRoot,
          shardCount,
          logsRoot: process.env.WARD_FLOW_LOGS ?? "D:/Repos/ward-flow-logs",
        });
        if (kept) console.log(`Kept the shards' failure artefacts in ${kept}`);
      } catch (error) {
        console.error(
          `Could not keep the shards' failure artefacts: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    if (exitCode !== 0 && rerun.length > 0 && specFailures.length === failedFiles.size) {
      console.log(`Rerunning ${rerun.length} failed spec file(s) alone, unsharded: ${rerun.join(", ")}`);
      const specArgs = playwrightArgs.filter((argument) => argument.startsWith("-"));
      const again = spawnSync(process.execPath, [playwrightBin, "test", ...specArgs, ...rerun], {
        cwd: projectRoot,
        env: testEnv,
        stdio: "inherit",
      });
      exitCode = childProcessExitCode(again);
      console.log(`Unsharded rerun: exit ${exitCode}`);
    }
    // Before this speed-up the known-only files were in the rerun and failed it again, so the run
    // could never exit 0 while they had failed. Keep that: skipping their rerun must not turn the run
    // green.
    if (knownOnly.length > 0 && exitCode === 0) exitCode = 1;
    await exitAfterTypeCheck(exitCode);
  }

  // The same verdict as the sharded path, read from a JSON report, unless the caller chose its own
  // reporter (then only the exit code is available, as before).
  const callerChoseReporter = playwrightArgs.some((argument) => argument.startsWith("--reporter"));
  const singleReport = path.join(absoluteRunRoot, "journeys.json");
  const result = spawnSync(
    process.execPath,
    [playwrightBin, "test", ...playwrightArgs, ...(callerChoseReporter ? [] : ["--reporter=list,json"])],
    {
      cwd: projectRoot,
      env: callerChoseReporter ? testEnv : { ...testEnv, PLAYWRIGHT_JSON_OUTPUT_NAME: singleReport },
      stdio: "inherit",
    },
  );
  const exitCode = childProcessExitCode(result);
  let verdictExitCode = exitCode;
  if (!callerChoseReporter) {
    const verdict = journeyRunVerdict(
      [{ label: "The run", code: exitCode, report: readJsonReport(singleReport) }],
      requestedProjects(playwrightArgs),
    );
    for (const problem of verdict.problems) console.error(`Playwright run is not trustworthy: ${problem}.`);
    if (!verdict.ok && exitCode === 0) verdictExitCode = 1;
  }
  await exitAfterTypeCheck(verdictExitCode);
} catch (error) {
  cleanup();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
