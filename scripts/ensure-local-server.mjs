#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  describeUnadoptableServer,
  isReservedDevPort,
  localProjectId,
  projectPortEnd,
  serverAdoptionVerdict,
  stableProjectPort,
} from "../src/lib/local-server-utils.mjs";

if (Number(process.versions.node.split(".")[0]) !== 24) {
  console.error(`Ward Flow local server requires Node 24.x. Current runtime: ${process.versions.node}.`);
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const maxPort = 65535;
const identityPath = "/api/local-project-id";
const logPath = path.join(projectRoot, "dev-server.log");
const startupLockPath = path.join(projectRoot, "tmp", "ensure-local-server.lock");
const printUrlOnly = process.argv.slice(2).includes("--print-url");
const debugEnabled = process.env.ENSURE_DEBUG === "1";
const startupLockStaleMs = 3 * 60 * 1000;
const readyStableMs = 5 * 1000;
// Ward Flow is the only app left (PsychSift removal, 25 September 2026), so readiness is its front page.
const readinessPaths = ["/mockups/ward-flow"];
// Servers started here run detached and unref'd, so nothing stops them when the
// task/session that called `ensure` ends. Default them to a self-shutdown after
// this many idle minutes so unattended background servers don't accumulate.
// Set DEV_SERVER_IDLE_MINUTES yourself (0 disables it) to override.
const defaultBackgroundIdleMinutes = 45;

function debug(message) {
  if (debugEnabled) console.error(`[ensure-local-server] ${message}`);
}

function localUrl(port) {
  return `http://localhost:${port}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function isPortBusy(port) {
  for (const host of ["127.0.0.1", "localhost", "::1"]) {
    if (await canConnectToHost(port, host)) return true;
  }
  return false;
}

function requestJson(url, timeoutMs = 3500) {
  return new Promise((resolve) => {
    let settled = false;
    let request;

    const settle = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      resolve(value);
    };

    const fallback = setTimeout(() => {
      request?.destroy();
      settle(null);
    }, timeoutMs + 500);

    request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          settle(JSON.parse(body));
        } catch {
          settle(null);
        }
      });
    });

    request.on("timeout", () => {
      request.destroy();
      settle(null);
    });
    request.on("error", () => settle(null));
  });
}

function requestOk(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let settled = false;
    let request;

    const settle = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      resolve(value);
    };

    const fallback = setTimeout(() => {
      request?.destroy();
      settle(false);
    }, timeoutMs + 500);

    request = http.get(url, { timeout: timeoutMs }, (response) => {
      response.resume();
      response.on("end", () => settle(response.statusCode >= 200 && response.statusCode < 400));
    });

    request.on("timeout", () => {
      request.destroy();
      settle(false);
    });
    request.on("error", () => settle(false));
  });
}

// One line per port, however many times the scan revisits it. `findExistingProjectServer`,
// `findStartPort` and `waitForProject` all ask about the same ports, and a wall of the same sentence
// is how the one line that matters gets skipped.
const reportedPorts = new Set();

function reportUnadoptable(port, verdict) {
  const message = describeUnadoptableServer(port, verdict);
  if (!message || reportedPorts.has(port)) return;
  reportedPorts.add(port);
  // stderr, always — including under `--print-url`, whose caller reads stdout for the URL alone and
  // would otherwise be the one caller that never learns why it got a different port.
  console.error(message);
}

/**
 * ⚠️ **A MATCHING `appName`/`projectId` NO LONGER MEANS "ADOPT THIS".** The identity check cannot
 * separate a dev server from a browser gate's `next start`, which shares this project root and so
 * answers identically. `serverAdoptionVerdict` carries the rest of the decision; see its doc.
 */
async function projectServerVerdict(port, attempts = 3) {
  let verdict = { adopt: false, reason: "not-this-project", pid: null, runtimeMode: null };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const payload = await requestJson(`http://localhost:${port}${identityPath}`);
    verdict = serverAdoptionVerdict(payload, localProjectId(projectRoot));
    debug(`identity attempt ${attempt + 1} on ${port}: ${verdict.reason} ${JSON.stringify(payload)}`);
    if (verdict.adopt) return verdict;
    // Retrying is for a server that has not answered yet. A server that answered and said it is a
    // production build will say so again — the retries exist for silence, not for a settled answer.
    if (verdict.reason !== "not-this-project") return verdict;
    if (attempt < attempts - 1) await sleep(250);
  }
  return verdict;
}

async function isThisProject(port, attempts = 3) {
  const verdict = await projectServerVerdict(port, attempts);
  if (!verdict.adopt) reportUnadoptable(port, verdict);
  return verdict.adopt;
}

async function findExistingProjectServer(startPort) {
  for (let port = startPort; port <= projectPortEnd; port += 1) {
    if (await isThisProject(port, 1)) return port;
  }
  return null;
}

async function findStartPort(startPort) {
  for (let port = startPort; port <= maxPort; port += 1) {
    if (isReservedDevPort(port)) continue;
    if (await isThisProject(port, 1)) return { port, alreadyRunning: true };
    if (!(await isPortBusy(port))) return { port, alreadyRunning: false };
  }
  throw new Error(`No free local port found from ${startPort} to ${maxPort}.`);
}

async function acquireStartupLock() {
  fs.mkdirSync(path.dirname(startupLockPath), { recursive: true });
  const startedAt = Date.now();

  while (Date.now() - startedAt < startupLockStaleMs) {
    try {
      const fd = fs.openSync(startupLockPath, "wx");
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      fs.closeSync(fd);
      debug(`acquired startup lock ${startupLockPath}`);
      return () => {
        try {
          fs.rmSync(startupLockPath, { force: true });
          debug(`released startup lock ${startupLockPath}`);
        } catch (error) {
          debug(`failed to release startup lock: ${error?.message ?? error}`);
        }
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;

      const ageMs = Date.now() - (fs.statSync(startupLockPath, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if (ageMs > startupLockStaleMs) {
        debug(`removing stale startup lock after ${Math.round(ageMs)}ms`);
        fs.rmSync(startupLockPath, { force: true });
        continue;
      }

      await sleep(500);
    }
  }

  throw new Error(`Timed out waiting for ${startupLockPath}. Another startup may be stuck.`);
}

function startDevServer(port) {
  debug(`starting dev server on ${port}`);
  const out = fs.openSync(logPath, "a");
  const err = fs.openSync(logPath, "a");
  try {
    const child = spawn(
      process.execPath,
      [path.join("scripts", "dev-free-port.mjs"), "--port", String(port), "--webpack"],
      {
        cwd: projectRoot,
        detached: true,
        env: {
          ...process.env,
          PORT: String(port),
          DEV_SERVER_IDLE_MINUTES: process.env.DEV_SERVER_IDLE_MINUTES ?? String(defaultBackgroundIdleMinutes),
        },
        stdio: ["ignore", out, err],
        windowsHide: true,
      },
    );
    child.unref();
  } finally {
    fs.closeSync(out);
    fs.closeSync(err);
  }
}

async function waitForProject(port) {
  let stableSince = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await isThisProject(port, 1)) {
      stableSince ??= Date.now();
      const stableForMs = Date.now() - stableSince;
      if (stableForMs >= readyStableMs) {
        const routeReadiness = await Promise.all(
          readinessPaths.map((routePath) => requestOk(`${localUrl(port)}${routePath}`)),
        );
        debug(
          `route readiness on ${port}: ${readinessPaths.map((routePath, index) => `${routePath}=${routeReadiness[index]}`).join(", ")}`,
        );
        if (routeReadiness.every(Boolean) && (await isPortBusy(port))) return true;
        stableSince = null;
      }
    } else {
      stableSince = null;
    }
    debug(`waiting for project on ${port}: attempt ${attempt + 1}`);
    await sleep(500);
  }
  return false;
}

async function main() {
  const stablePort = stableProjectPort(projectRoot);
  debug(`stable port ${stablePort}`);
  const existingPort = await findExistingProjectServer(stablePort);
  debug(`existing port ${existingPort ?? "none"}`);

  if (existingPort) {
    if (await waitForProject(existingPort)) {
      console.log(printUrlOnly ? localUrl(existingPort) : `Ward Flow is already running at ${localUrl(existingPort)}`);
      return 0;
    }
  }

  const releaseStartupLock = await acquireStartupLock();

  try {
    const lockedExistingPort = await findExistingProjectServer(stablePort);
    debug(`locked existing port ${lockedExistingPort ?? "none"}`);

    if (lockedExistingPort && (await waitForProject(lockedExistingPort))) {
      console.log(
        printUrlOnly ? localUrl(lockedExistingPort) : `Ward Flow is already running at ${localUrl(lockedExistingPort)}`,
      );
      return 0;
    }

    const target = await findStartPort(stablePort);
    debug(`target ${target.port}, alreadyRunning=${target.alreadyRunning}`);

    if (target.alreadyRunning) {
      if (await waitForProject(target.port)) {
        console.log(printUrlOnly ? localUrl(target.port) : `Ward Flow is already running at ${localUrl(target.port)}`);
        return 0;
      }
    }

    if (target.port !== stablePort && !printUrlOnly) {
      console.log(
        `Stable project port ${stablePort} is serving another local project; starting Ward Flow at ${localUrl(target.port)}`,
      );
    }

    startDevServer(target.port);

    if (await waitForProject(target.port)) {
      console.log(printUrlOnly ? localUrl(target.port) : `Ward Flow is running at ${localUrl(target.port)}`);
      if (!printUrlOnly) console.log(`Server log: ${logPath}`);
      return 0;
    }

    console.error(`Ward Flow did not become ready at ${localUrl(target.port)}. Check ${logPath}`);
    return 1;
  } finally {
    releaseStartupLock();
  }
}

process.exitCode = await main();
