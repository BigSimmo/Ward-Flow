import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { readConfig } from "./config.mjs";
import { createStore, openStorage } from "./database.mjs";
import { createAuthenticator, VerifierUnavailableError } from "./auth.mjs";
import { createSharedHandler } from "./shared-http.mjs";
import { createPush } from "./push.mjs";

const BODY_LIMIT = 1_048_576;
const SESSION_PATH = /^\/v1\/sessions\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

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
  store,
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
    const match = SESSION_PATH.exec(path);
    const route = match ? "session" : path === "/readyz" ? "readiness" : path === "/healthz" ? "liveness" : "unknown";
    const origin = request.headers.get("origin");
    const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff", "x-request-id": requestId };
    const respond = (status, value, outcome = "completed", extraHeaders = {}) => {
      try {
        // Closed metadata vocabulary only: never log tokens, owner/session IDs, URL query strings,
        // request payloads, error messages or an arbitrary exception object.
        log({
          event: "ward_backend_request",
          requestId,
          route,
          method: ["GET", "PUT", "DELETE", "OPTIONS"].includes(request.method) ? request.method : "OTHER",
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
    if (!match && path !== "/readyz") return respond(404, { error: "Not found" });
    if (request.method === "OPTIONS" && origin)
      return respond(204, null, "preflight", {
        "access-control-allow-methods": "GET, PUT, DELETE, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
        "access-control-max-age": "600",
      });
    let owner;
    try {
      owner = await authenticate(request.headers.get("authorization"));
    } catch (error) {
      if (error instanceof VerifierUnavailableError)
        return respond(503, { error: "Sign-in verification unavailable; try again shortly" }, "verifier_unavailable");
      return respond(401, { error: "Sign in with the authorised Microsoft account" }, "auth_denied");
    }
    // Blob names are case-sensitive; one logical session must map to one blob.
    const sessionId = match?.[1].toLowerCase();
    try {
      if (path === "/readyz" && request.method === "GET") {
        await store.ready();
        if (sharedStore) await sharedStore.ready();
        return respond(200, sharedStore ? { storage: "ready", database: "ready" } : { storage: "ready" });
      }
      if (!match) return respond(405, { error: "Method not allowed" });
      if (request.method === "GET") {
        const result = await store.read(owner, sessionId);
        return result ? respond(200, result) : respond(404, { error: "Session not found" });
      }
      if (!["PUT", "DELETE"].includes(request.method)) return respond(405, { error: "Method not allowed" });
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
        return respond(415, { error: "JSON required" });
      let body;
      try {
        body = await readBody(request);
      } catch (error) {
        return respond(error.message === "too_large" ? 413 : 400, { error: "Invalid snapshot" });
      }
      if (
        !object(body) ||
        !Number.isSafeInteger(body.expectedRevision) ||
        body.expectedRevision < 0 ||
        body.expectedRevision > 2_147_483_646
      )
        return respond(400, { error: "A synthetic snapshot and valid revision are required" });
      if (request.method === "DELETE") {
        if (body.expectedRevision === 0) return respond(400, { error: "An existing session revision is required" });
        const result = await store.delete(owner, sessionId, body.expectedRevision);
        if (result === "deleted") return respond(204, null, "deleted");
        return result === "conflict"
          ? respond(409, { error: "Session changed; reload before deleting" }, "conflict")
          : respond(404, { error: "Session not found" }, "not_found");
      }
      if (
        body.classification !== "synthetic" ||
        !object(body.payload) ||
        body.expectedRevision === 2_147_483_646 ||
        (body.requestId !== undefined && (typeof body.requestId !== "string" || !UUID.test(body.requestId)))
      )
        return respond(400, { error: "A synthetic snapshot and valid request ID are required" });
      const revision = await store.save(
        owner,
        sessionId,
        body.expectedRevision,
        body.payload,
        body.requestId?.toLowerCase(),
      );
      return revision === null
        ? respond(409, { error: "Session changed; reload before saving" }, "conflict")
        : respond(200, { revision });
    } catch {
      return respond(503, { error: "Storage unavailable; changes were not confirmed" }, "storage_unavailable");
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
    const storage = await openStorage(config.storage);
    const authenticate = await createAuthenticator(config);
    let sharedStore;
    if (config.shared) {
      const { createPostgresPool, createWorkspaceStore } = await import("./postgres.mjs");
      const engine = await import("./dist/engine.mjs");
      pool = createPostgresPool(config.postgres);
      sharedStore = createWorkspaceStore(pool, {
        workspaceId: config.workspaceId,
        engine,
        push: await createPush(config),
      });
    }
    const server = listen(createHandler({ config, store: createStore(storage), authenticate, sharedStore }), config);
    registerShutdown(server, pool);
    // Phone push: the same five-minute act-now re-check the Azure timer trigger runs.
    if (sharedStore?.pushEnabled)
      setInterval(() => {
        void sharedStore.sweepPush().catch(() => console.error("Ward Flow phone push sweep unavailable"));
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
