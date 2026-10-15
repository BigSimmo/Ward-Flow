import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { readConfig } from "./config.mjs";
import { VerifierUnavailableError } from "./auth.mjs";
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
      })
    : null;
  return async (request) => {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/v1/workspace"))
      return sharedHandler
        ? sharedHandler(request)
        : Response.json(
            { error: "Shared workspace is not configured" },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
    const requestId = randomUUID();
    const startedAt = performance.now();
    const route = path === "/readyz" ? "readiness" : path === "/healthz" ? "liveness" : "unknown";
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
          method: ["GET", "OPTIONS"].includes(request.method) ? request.method : "OTHER",
          status,
          outcome,
          durationMs: Math.round(performance.now() - startedAt),
        });
      } catch {
        // Optional diagnostics must not alter the API result.
      }
      return status === 204
        ? new Response(null, { status, headers: { ...headers, ...extraHeaders } })
        : Response.json(value, { status, headers });
    };
    if (origin && origin !== config.origin) return respond(403, { error: "Origin not allowed" }, "origin_denied");
    if (origin) {
      headers["access-control-allow-origin"] = origin;
      headers["access-control-expose-headers"] = "X-Request-ID";
      headers.vary = "Origin";
    }
    if (path === "/healthz" && request.method === "GET") return respond(200, { service: "ward-flow-backend" });
    if (path !== "/readyz") return respond(404, { error: "Not found" });
    if (request.method === "OPTIONS" && origin)
      return respond(204, null, "preflight", {
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
        "access-control-max-age": "600",
      });
    try {
      await authenticate(request.headers.get("authorization"));
    } catch (error) {
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

export function listen(handler, config) {
  const server = createServer(
    { maxHeaderSize: 20_480, requestTimeout: 15_000, headersTimeout: 10_000 },
    async (incoming, outgoing) => {
      try {
        const request = new Request(`http://backend${incoming.url}`, {
          method: incoming.method,
          headers: incoming.headers,
          ...(["GET", "HEAD"].includes(incoming.method) ? {} : { body: Readable.toWeb(incoming), duplex: "half" }),
        });
        const response = await handler(request);
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      } catch {
        outgoing.writeHead(500, { "cache-control": "no-store" });
        outgoing.end();
      }
    },
  );
  server.maxConnections = 16;
  server.setTimeout(15_000, (socket) => socket.destroy());
  return server.listen(config.port, config.host);
}

/** One phone-push re-check. A failure is logged with its cause (name, code, URL-free message), never silently. */
export async function sweepPush(sharedStore, log = (event) => console.error(JSON.stringify(event))) {
  try {
    await sharedStore.sweepPush();
  } catch (error) {
    log({ event: "ward_backend_push_sweep_failure", ...errorFields(error) });
  }
}

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
