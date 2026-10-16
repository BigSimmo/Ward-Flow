// @ts-check
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { readConfig } from "./config.mjs";
import { VerifierRateLimitedError, VerifierUnavailableError } from "./auth.mjs";
import { createBackend } from "./providers.mjs";
import { createSharedHandler } from "./shared-http.mjs";
import { errorFields } from "./push.mjs";

const BODY_LIMIT = 1_048_576;

async function readBody(request) {
  if (Number(request.headers.get("content-length")) > BODY_LIMIT) throw new Error("too_large");
  if (!request.body) throw new Error("invalid");
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > BODY_LIMIT) {
        await reader.cancel();
        throw new Error("too_large");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}

export function createHandler({
  config,
  authenticate,
  sharedStore,
  log = (event) => console.info(JSON.stringify(event)),
}) {
  const sharedHandler = sharedStore
    ? createSharedHandler({
        config,
        store: sharedStore,
        authenticate,
        readBody,
        verifierUnavailable: VerifierUnavailableError,
        verifierRateLimited: VerifierRateLimitedError,
        log,
      })
    : null;
  /** `meta.clientAddress` comes from `listen()`; it keys the sign-in check limit. */
  return async (request, meta = {}) => {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/v1/workspace") && sharedHandler) return sharedHandler(request, meta);
    const requestId = randomUUID();
    const startedAt = performance.now();
    const route = path.startsWith("/v1/workspace")
      ? "workspace"
      : path === "/readyz"
        ? "readiness"
        : path === "/healthz"
          ? "liveness"
          : "unknown";
    const origin = request.headers.get("origin");
    const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff", "x-request-id": requestId };
    const respond = (status, value, outcome = "completed", extraHeaders = {}) => {
      try {
        // Closed metadata vocabulary only: never log tokens, owner IDs, URL query strings,
        // request payloads, error messages or an arbitrary exception object.
        log({
          event: "ward_backend_request",
          requestId,
          route,
          method: ["GET", "POST", "OPTIONS"].includes(request.method) ? request.method : "OTHER",
          status,
          outcome,
          durationMs: Math.round(performance.now() - startedAt),
        });
      } catch {
        // Optional diagnostics must not alter the API result.
      }
      return status === 204
        ? new Response(null, { status, headers: { ...headers, ...extraHeaders } })
        : Response.json(value, { status, headers: { ...headers, ...extraHeaders } });
    };
    if (origin && origin !== config.origin) return respond(403, { error: "Origin not allowed" }, "origin_denied");
    if (origin) {
      headers["access-control-allow-origin"] = origin;
      headers["access-control-expose-headers"] = "X-Request-ID";
      headers.vary = "Origin";
    }
    // Shared routes with the shared workspace switched off: still logged, with a request ID.
    if (route === "workspace") return respond(503, { error: "Shared workspace is not configured" }, "not_configured");
    if (path === "/healthz" && request.method === "GET") return respond(200, { service: "ward-flow-backend" });
    if (path !== "/readyz") return respond(404, { error: "Not found" });
    if (request.method === "OPTIONS" && origin)
      return respond(204, null, "preflight", {
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
        "access-control-max-age": "600",
      });
    try {
      await authenticate(request.headers.get("authorization"), { clientAddress: meta.clientAddress });
    } catch (error) {
      if (error instanceof VerifierRateLimitedError)
        return respond(429, { error: "Too many sign-in checks; try again shortly" }, "rate_limited", {
          "retry-after": "60",
        });
      if (error instanceof VerifierUnavailableError)
        return respond(503, { error: "Sign-in verification unavailable; try again shortly" }, "verifier_unavailable");
      return respond(401, { error: "Sign in with the authorised account" }, "auth_denied");
    }
    if (request.method !== "GET") return respond(405, { error: "Method not allowed" });
    try {
      if (sharedStore) await sharedStore.ready();
      return respond(200, sharedStore ? { database: "ready" } : {});
    } catch {
      return respond(503, { error: "Database unavailable" }, "storage_unavailable");
    }
  };
}

/**
 * The address sign-in checks are limited by. Proxy headers are read only when the socket peer is a
 * listed trusted proxy, or "*" is listed for a host such as Railway that is reachable only through
 * its proxy. Then X-Real-IP (the single client address Railway sets) is used, else the last
 * X-Forwarded-For entry (the one a proxy appends). Otherwise the socket's own address, so a direct
 * client cannot choose its limit address.
 */
export function clientAddress(incoming, trustedProxyAddresses = []) {
  const socketAddress = (incoming.socket?.remoteAddress || "unknown").replace(/^::ffff:/i, "");
  if (!trustedProxyAddresses.includes("*") && !trustedProxyAddresses.includes(socketAddress))
    return socketAddress.slice(0, 64);
  const realIp = incoming.headers["x-real-ip"];
  const forwarded = incoming.headers["x-forwarded-for"];
  const last = typeof forwarded === "string" ? (forwarded.split(",").at(-1)?.trim() ?? "") : "";
  return ((typeof realIp === "string" && realIp.trim()) || last || socketAddress).slice(0, 64);
}

/**
 * Up to 256 open connections. A client must finish its headers within 5 seconds and its whole
 * request within 15, so a handful of slow or idle connections cannot hold every slot.
 */
export const MAX_CONNECTIONS = 256;
export const HEADERS_TIMEOUT_MS = 5_000;

export function listen(handler, config) {
  const server = createServer(
    { maxHeaderSize: 20_480, requestTimeout: 15_000, headersTimeout: HEADERS_TIMEOUT_MS },
    async (incoming, outgoing) => {
      try {
        const request = new Request(`http://backend${incoming.url}`, {
          method: incoming.method,
          headers: /** @type {HeadersInit} */ (/** @type {unknown} */ (incoming.headers)),
          ...(["GET", "HEAD"].includes(incoming.method)
            ? {}
            : { body: /** @type {BodyInit} */ (/** @type {unknown} */ (Readable.toWeb(incoming))), duplex: "half" }),
        });
        const response = await handler(request, {
          clientAddress: clientAddress(incoming, config.trustedProxyAddresses),
        });
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        // Name and code only: a database or engine message can quote values from the request.
        const { errorName, errorCode } = errorFields(error);
        console.error(JSON.stringify({ event: "ward_backend_unhandled_failure", errorName, errorCode }));
        if (!outgoing.headersSent) outgoing.writeHead(500, { "cache-control": "no-store" });
        outgoing.end();
      }
    },
  );
  server.maxConnections = MAX_CONNECTIONS;
  server.setTimeout(15_000, (socket) => socket.destroy());
  return server.listen(config.port, config.host);
}

/** One phone-push re-check. A failure is logged with closed diagnostic fields, never exception text. */
export async function sweepPush(sharedStore, log = (event) => console.error(JSON.stringify(event))) {
  try {
    await sharedStore.sweepPush();
  } catch (error) {
    log({ event: "ward_backend_push_sweep_failure", ...errorFields(error) });
  }
}

/**
 * @param {any} server
 * @param {{ end(): Promise<unknown> } | undefined} pool
 * @param {Pick<NodeJS.EventEmitter, "once"> & { exitCode?: number | string | null }} [signals] `process`, or an emitter in tests.
 */
export function registerShutdown(server, pool, signals = process) {
  let shutdown;
  const close = () => {
    shutdown ??= (async () => {
      try {
        await new Promise((resolve, reject) => {
          server.close((error) => {
            if (error && error.code !== "ERR_SERVER_NOT_RUNNING") reject(error);
            else resolve();
          });
        });
      } finally {
        await pool?.end();
      }
    })().catch(() => {
      console.error("Backend shutdown unavailable");
      signals.exitCode = 1;
    });
    return shutdown;
  };
  signals.once("SIGINT", close);
  signals.once("SIGTERM", close);
  server.on("error", () => {
    console.error("Backend listener unavailable");
    signals.exitCode = 1;
    void close();
  });
  return close;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let pool;
  try {
    const config = readConfig();
    const backend = await createBackend(config);
    pool = backend.pool;
    const { sharedStore } = backend;
    const server = listen(createHandler(backend), config);
    registerShutdown(server, pool);
    // Phone push: time alone can turn a row red, so the act-now list is re-checked every five minutes.
    if (sharedStore?.pushEnabled)
      setInterval(() => {
        void sweepPush(sharedStore);
      }, 300_000).unref();
    server.on("listening", () => console.log("Ward Flow backend listening; authenticated readiness check required"));
  } catch {
    console.error("Backend configuration or identity unavailable");
    process.exitCode = 1;
    try {
      await pool?.end();
    } catch {
      console.error("Backend shutdown unavailable");
    }
  }
}
