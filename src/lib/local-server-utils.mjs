import crypto from "node:crypto";
import path from "node:path";

export const appName = "Ward Flow";
export const projectPortStart = 3100;
export const projectPortEnd = 4599;

// Ports Next.js refuses to bind ("Bad port: X is reserved for Y" — Chrome's
// restricted-port list). Worktree paths can hash onto one of these, which
// would make every dev/playwright server boot fail for that checkout.
const reservedDevPorts = new Set([3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080]);

export function isReservedDevPort(port) {
  return reservedDevPorts.has(port);
}

export function normalizeProjectRoot(projectRoot, platform = process.platform) {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const resolvedRoot = pathApi.resolve(projectRoot);
  return platform === "win32" ? resolvedRoot.replaceAll("\\", "/").toLowerCase() : resolvedRoot;
}

export function projectHash(projectRoot, platform = process.platform) {
  return crypto.createHash("sha256").update(normalizeProjectRoot(projectRoot, platform)).digest();
}

export function stableProjectPort(projectRoot, platform = process.platform) {
  const offset = projectHash(projectRoot, platform).readUInt32BE(0) % (projectPortEnd - projectPortStart + 1);
  let port = projectPortStart + offset;
  while (isReservedDevPort(port)) {
    port = port >= projectPortEnd ? projectPortStart : port + 1;
  }
  return port;
}

/**
 * ═══ WHICH RUNNING SERVER `npm run ensure` MAY ADOPT ═══════════════════════════════════════════
 *
 * 🔴 **`appName` + `projectId` MATCHING IS NOT ENOUGH, AND FOR MONTHS IT WAS THE WHOLE CHECK.**
 * `scripts/run-playwright.mjs` builds an isolated production bundle and runs `next start` from the
 * SAME project root, so a browser gate's server answers the identity route with the right app name
 * and the right project id — `projectId` is a hash of the project root, which the gate shares by
 * design. `ensure` adopted it and printed its URL as the project's dev server.
 *
 * That server is frozen at the gate's build, so the caller's current changes are absent, and its
 * production compile strips `data-testid`, so markers are missing too. It presents as "my change is
 * not on the page" — somebody then debugs their own correct work. See
 * `LocalProjectIdentityPayload.runtimeMode` for the full account.
 *
 * ⚠️ **A MISSING `runtimeMode` IS REFUSED, NOT ASSUMED FRIENDLY, AND THE ASYMMETRY IS THE POINT.**
 * The two mistakes do not cost the same:
 *
 *   - refuse a real dev server  -> `ensure` starts a second one on the next port. Wasteful, visible,
 *                                  self-correcting, and nothing it reports is wrong.
 *   - adopt a production server -> the silent failure above, which costs a debugging session and
 *                                  looks like the caller's own bug.
 *
 * The field is also cheap to satisfy: `next dev` compiles route handlers on demand, so a dev server
 * already running against this checkout serves the new field on the first request after the source
 * exists. A production bundle cannot — `next build` inlines `process.env.NODE_ENV`. So "did not
 * report a mode" is itself evidence of a frozen build far more often than of a stale dev server.
 *
 * Pure, and given the expected project id rather than reading it, so the whole decision is testable
 * without a port, a process, or a platform.
 */
export const adoptableRuntimeMode = "development";

export function serverAdoptionVerdict(payload, expectedProjectId) {
  const pid = typeof payload?.localServer?.pid === "number" ? payload.localServer.pid : null;

  if (!payload || payload.appName !== appName || payload.projectId !== expectedProjectId) {
    return { adopt: false, reason: "not-this-project", pid, runtimeMode: null };
  }

  const runtimeMode = payload.localServer?.runtimeMode ?? null;
  if (runtimeMode === adoptableRuntimeMode) {
    return { adopt: true, reason: "development", pid, runtimeMode };
  }
  if (runtimeMode === null) {
    return { adopt: false, reason: "runtime-mode-unreported", pid, runtimeMode: null };
  }
  return { adopt: false, reason: "not-a-dev-server", pid, runtimeMode };
}

/**
 * The sentence printed when a port holds this project but is not adoptable. It names the process, so
 * the reader can identify it without a platform-specific process query, and it names the likely
 * cause, because the true cause is another session's gate rather than anything the reader did.
 *
 * Returns null for a port that simply is not this project — that is the ordinary case `ensure` has
 * always handled silently, and narrating it would bury the one line that matters.
 */
export function describeUnadoptableServer(port, verdict) {
  // An adopted server is the normal outcome and says nothing. Keyed on `adopt` rather than on the
  // reason list: a future reason added without a matching arm here would otherwise be narrated as a
  // refusal or, worse, an adoption would be — which is how this function first shipped.
  if (verdict.adopt) return null;
  if (verdict.reason === "not-this-project") return null;
  const process_ = verdict.pid === null ? "" : ` (pid ${verdict.pid})`;

  if (verdict.reason === "runtime-mode-unreported") {
    return (
      `Port ${port} is serving ${appName}${process_} but did not report whether it is a dev server. ` +
      `Not adopting it: a production build cannot report one, and a dev server picks the field up on ` +
      `its next request, so silence usually means a frozen build.`
    );
  }

  return (
    `Port ${port} is serving a ${verdict.runtimeMode} build of ${appName}${process_}, not a dev server — ` +
    `most likely a browser gate (npm run verify:ui / verify:phone-chrome), which starts its own ` +
    `\`next start\` from an isolated build. Not adopting it: it is frozen at that build, so your ` +
    `current changes are absent from every page and data-testid markers are stripped.`
  );
}

export function circularProjectPortRange(startPort) {
  if (!Number.isInteger(startPort) || startPort < projectPortStart || startPort > projectPortEnd) {
    throw new Error(`Project port must be between ${projectPortStart} and ${projectPortEnd}: ${startPort}`);
  }
  const count = projectPortEnd - projectPortStart + 1;
  return Array.from(
    { length: count },
    (_, index) => projectPortStart + ((startPort - projectPortStart + index) % count),
  );
}

export function localProjectId(projectRoot, platform = process.platform) {
  return `clinical-kb:${projectHash(projectRoot, platform).toString("hex").slice(0, 12)}`;
}

// Idle-shutdown minutes for a dev server run in the background (e.g. via
// `npm run ensure`), from DEV_SERVER_IDLE_MINUTES. Returns null when unset,
// non-numeric, zero, or negative — the caller's idle-shutdown watchdog stays
// disabled in that case.
export function parseIdleMinutes(rawValue) {
  const parsed = Number.parseFloat(rawValue ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// How to terminate the wrapped `next dev`/`next start` child once the idle
// watchdog fires. On POSIX, a plain SIGTERM is enough: next-dev's own CLI
// (node_modules/next/dist/cli/next-dev.js) installs a SIGTERM handler that
// forwards the signal to the actual server process it forks internally, and
// the caller's own SIGKILL fallback covers anything that doesn't exit cleanly.
// Windows has no such forwarding path: TerminateProcess-based termination
// (what Node's child.kill() maps every signal to on win32) tears down only
// the CLI process itself — no in-process handler ever runs to relay it to the
// forked grandchild server process, which then survives as an orphan bound to
// the port, defeating the point of the watchdog. `taskkill /T /F` terminates
// the whole process tree in one call instead, which is why Windows gets its
// own command here rather than reusing the POSIX signal path.
export function buildIdleShutdownCommand(pid, platform = process.platform) {
  if (platform === "win32") {
    return { kind: "taskkill", command: "taskkill", args: ["/PID", String(pid), "/T", "/F"] };
  }
  return { kind: "signal", signal: "SIGTERM" };
}
