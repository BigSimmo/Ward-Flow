// Optional backend error reporting to Sentry. Off unless SENTRY_DSN is set.
//
// No SDK: one small envelope per failure, sent with fetch. Each report carries only a fixed event
// name, the allow-listed error name and code from `errorFields` (push.mjs), the environment and the
// release. No message text, stack, request, user, address or record content is ever read here, so
// nothing typed into Ward Flow can leave the server. Each event name is sent at most once every
// five minutes, which keeps a long outage inside Sentry's free monthly allowance.

import { randomUUID } from "node:crypto";

const EVENTS = new Set([
  "ward_backend_unhandled_failure",
  "ward_backend_unhandled_rejection",
  "ward_backend_uncaught_exception",
  "ward_backend_push_sweep_failure",
  // The live workspace has passed its size alert threshold (audit PS-02, config.mjs).
  "ward_backend_workspace_size_alert",
]);
const SAFE_VALUE = /^[A-Za-z0-9_.-]{1,64}$/;
export const REPORT_INTERVAL_MS = 300_000;
const SEND_TIMEOUT_MS = 5_000;

/** Envelope address and auth header for a DSN, or null when it is not a usable Sentry DSN. */
export function sentryTarget(dsn) {
  let url;
  try {
    url = new URL(dsn);
  } catch {
    return null;
  }
  const projectId = url.pathname.split("/").filter(Boolean).pop();
  if (url.protocol !== "https:" || !url.username || !projectId || !/^\d+$/.test(projectId)) return null;
  const prefix = url.pathname.slice(0, url.pathname.lastIndexOf(`/${projectId}`));
  return {
    endpoint: `https://${url.host}${prefix}/api/${projectId}/envelope/`,
    auth: `Sentry sentry_version=7, sentry_key=${url.username}, sentry_client=ward-flow-backend/0.1.0`,
  };
}

/**
 * The whole event Sentry receives: closed names only.
 * @param {Record<string, unknown>} event
 * @param {{ environment?: string, release?: string, now?: number }} [labels]
 */
export function failureEvent(event, { environment, release, now = Date.now() } = {}) {
  const name = typeof event?.event === "string" && EVENTS.has(event.event) ? event.event : "ward_backend_failure";
  const tags = { service: "ward-flow-backend" };
  for (const key of ["errorName", "errorCode"])
    if (typeof event?.[key] === "string" && SAFE_VALUE.test(event[key])) tags[key] = event[key];
  return {
    event_id: randomUUID().replaceAll("-", ""),
    timestamp: now / 1000,
    platform: "node",
    level: "error",
    logger: "ward-flow-backend",
    environment,
    ...(release ? { release } : {}),
    message: { formatted: name },
    fingerprint: [name, tags.errorName ?? "", tags.errorCode ?? ""],
    tags,
  };
}

/**
 * A reporter for `logFailure`, or null (reporting off) without a valid DSN or under tests.
 * @param {Record<string, string | undefined>} env
 */
export function createErrorReporter(env, { send = fetch, now = () => Date.now() } = {}) {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn || env.NODE_ENV === "test") return null;
  const target = sentryTarget(dsn);
  if (!target) return null;
  const environment = env.SENTRY_ENVIRONMENT?.trim() || "production";
  const release = env.SENTRY_RELEASE?.trim() || env.RAILWAY_GIT_COMMIT_SHA?.trim() || undefined;
  const lastSent = new Map();
  return (event) => {
    const at = now();
    const payload = failureEvent(event, { environment, release, now: at });
    const name = payload.message.formatted;
    if (at - (lastSent.get(name) ?? -Infinity) < REPORT_INTERVAL_MS) return;
    lastSent.set(name, at);
    const body = `${JSON.stringify({ event_id: payload.event_id, sent_at: new Date(at).toISOString() })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(payload)}`;
    // Fire and forget: reporting must never delay, fail or crash the request that failed.
    Promise.resolve()
      .then(() =>
        send(target.endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-sentry-envelope", "x-sentry-auth": target.auth },
          body,
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        }),
      )
      .catch(() => {});
  };
}

let reporter = null;

/** Start reporting when SENTRY_DSN is set. Returns whether reporting is on. */
export function startErrorReporting(env = process.env) {
  reporter = createErrorReporter(env);
  return reporter !== null;
}

/** Log a closed-field failure line and, when reporting is on, send it to Sentry. */
export function logFailure(event) {
  console.error(JSON.stringify(event));
  try {
    reporter?.(event);
  } catch {
    // Monitoring must not interfere with the failure it is reporting.
  }
}
