// @ts-check
import { randomUUID } from "node:crypto";
import { parseSubscription } from "./push.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Each shared path and the closed route name it is logged under. */
const ROUTES = new Map([
  ["/v1/workspace", "workspace"],
  ["/v1/workspace/commands", "workspace_commands"],
  ["/v1/workspace/audit", "workspace_audit"],
  ["/v1/workspace/push-key", "push_key"],
  ["/v1/workspace/push-subscribe", "push_subscribe"],
  ["/v1/workspace/push-unsubscribe", "push_unsubscribe"],
  ["/v1/workspace/push-status", "push_status"],
]);
/** Messages the pg pool and the workspace store use when the database, not the code, failed. */
const STORAGE_MESSAGES =
  /^(?:Connection terminated|timeout exceeded when trying to connect|Client has encountered a connection error|Cannot use a pool after calling end|Shared schema unavailable|Workspace data mode mismatch|Stored workspace is incompatible)/;

/**
 * PostgreSQL SQLSTATEs that mean the database could not do the work now: connection (08),
 * insufficient resources (53), operator intervention such as a shutdown (57), system error (58),
 * a serialization failure or a deadlock. Any other SQLSTATE is a query fault that retrying will not
 * clear, so it is a code fault.
 */
const STORAGE_SQLSTATE = /^(?:(?:08|53|57|58)[0-9A-Z]{3}|40001|40P01)$/;
/** Node network error codes for a database that cannot be reached. */
const NETWORK_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ECONNABORTED",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

/**
 * True when the database could not do the work: an outage SQLSTATE, a Node network error code or a
 * known pool or store message. Anything else is a code fault, which the API reports as 500 rather
 * than blaming the database.
 */
export function storageFailure(error) {
  const code = error?.code;
  return (
    (typeof code === "string" && (STORAGE_SQLSTATE.test(code) || NETWORK_CODES.has(code))) ||
    STORAGE_MESSAGES.test(String(error?.message ?? ""))
  );
}

/**
 * Closed diagnostic fields for an unexpected error: its name and code only. No message, since a
 * PostgreSQL or engine message can quote values from the request. The request ID ties the entry
 * to the response the caller saw.
 */
function failureFields(error) {
  const code = error?.code;
  return {
    errorName: typeof error?.name === "string" ? error.name.slice(0, 60) : "Error",
    ...(typeof code === "string" || typeof code === "number" ? { errorCode: String(code).slice(0, 40) } : {}),
  };
}

export function createSharedHandler({
  config,
  store,
  authenticate,
  readBody,
  verifierUnavailable,
  log = (event) => console.info(JSON.stringify(event)),
}) {
  return async (request) => {
    const requestId = randomUUID();
    const startedAt = performance.now();
    const path = new URL(request.url).pathname;
    /** @type {{ outcome?: string, failure?: Record<string, unknown> }} */
    const note = {};
    const response = await handle(request, path, requestId, note);
    try {
      // Closed metadata vocabulary only: never log tokens, actor IDs, query strings or payloads.
      log({
        event: "ward_backend_request",
        requestId,
        route: ROUTES.get(path) ?? "unknown",
        method: ["GET", "POST", "OPTIONS"].includes(request.method) ? request.method : "OTHER",
        status: response.status,
        outcome: note.outcome ?? (response.status < 400 ? "completed" : "refused"),
        durationMs: Math.round(performance.now() - startedAt),
        ...note.failure,
      });
    } catch {
      // Optional diagnostics must not alter the API result.
    }
    return response;
  };

  async function handle(request, path, requestId, note) {
    const headers = {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-request-id": requestId,
    };
    const reply = (status, body, outcome) => {
      if (outcome) note.outcome = outcome;
      return Response.json(body, { status, headers });
    };
    const origin = request.headers.get("origin");
    if (origin && origin !== config.origin) return reply(403, { error: "Origin not allowed" }, "origin_denied");
    if (origin) {
      headers["access-control-allow-origin"] = origin;
      headers["access-control-expose-headers"] = "X-Request-ID";
      headers.vary = "Origin";
    }
    if (!ROUTES.has(path)) return reply(404, { error: "Not found" });
    if (request.method === "OPTIONS" && origin) {
      note.outcome = "preflight";
      return new Response(null, {
        status: 204,
        headers: {
          ...headers,
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "Authorization, Content-Type",
          "access-control-max-age": "600",
        },
      });
    }
    let actorId;
    try {
      actorId = await authenticate(request.headers.get("authorization"));
    } catch (error) {
      return error instanceof verifierUnavailable
        ? reply(503, { error: "Sign-in verification unavailable; try again shortly" }, "verifier_unavailable")
        : reply(401, { error: "Sign in with the authorised account" }, "auth_denied");
    }
    // One application role, explicit named accounts. Tenant membership and client role fields
    // never grant coordinator access. These accounts can read the complete synthetic workspace.
    if (!config.coordinatorIds.includes(actorId))
      return reply(403, { error: "Coordinator access is not assigned to this account" }, "auth_denied");
    try {
      if (config.dataMode && config.dataMode !== "prototype")
        return reply(503, { error: "Live data mode is not commissioned" });
      if (path === "/v1/workspace" && request.method === "GET") {
        const snapshot = await store.read(actorId);
        if (snapshot.dataMode !== "prototype") throw new Error("Workspace data mode mismatch");
        return reply(200, {
          role: "coordinator",
          actorId,
          workspaceId: config.workspaceId,
          data: { mode: snapshot.dataMode, source: "synthetic", liveAvailable: false },
          snapshot,
        });
      }
      if (path === "/v1/workspace/audit" && request.method === "GET")
        return reply(200, { events: await store.audit() });
      // Phone push. The public key is not a secret; "enabled: false" tells Settings the server is
      // not set up for it, so the control can say why instead of disappearing.
      if (path === "/v1/workspace/push-key" && request.method === "GET")
        return reply(200, config.push ? { enabled: true, publicKey: config.push.publicKey } : { enabled: false });
      if (path.startsWith("/v1/workspace/push-")) {
        if (request.method !== "POST" || path === "/v1/workspace/push-key")
          return reply(405, { error: "Method not allowed" });
        if (!config.push || !store.subscribe) return reply(503, { error: "Phone alerts are not set up on the server" });
        if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
          return reply(415, { error: "JSON required" });
        let body;
        try {
          body = await readBody(request);
        } catch (error) {
          return reply(error.message === "too_large" ? 413 : 400, { error: "Invalid subscription" });
        }
        if (path === "/v1/workspace/push-subscribe") {
          const subscription = parseSubscription(body?.subscription);
          if (!subscription) return reply(400, { error: "A browser push subscription is required" });
          const outcome = await store.subscribe(actorId, subscription);
          return outcome === "limit"
            ? reply(409, {
                code: "limit",
                error: "This account already has phone alerts on 10 devices. Turn one off first.",
              })
            : outcome === "in-use"
              ? reply(409, {
                  code: "in-use",
                  error: "Phone alerts on this device belong to another account. Turn them off there first.",
                })
              : reply(200, { subscribed: true });
        }
        let endpoint;
        try {
          endpoint =
            typeof body?.endpoint === "string" && body.endpoint.length <= 2048 ? new URL(body.endpoint).href : null;
        } catch {
          endpoint = null;
        }
        if (!endpoint) return reply(400, { error: "A push endpoint is required" });
        // Ownership is the server's record for this signed-in account, never the browser's own
        // subscription: another coordinator may have turned alerts on with this device earlier.
        if (path === "/v1/workspace/push-status")
          return reply(200, { owned: await store.pushStatus(actorId, endpoint) });
        const outcome = await store.unsubscribe(actorId, endpoint);
        return reply(200, { subscribed: false, revoked: outcome === "unsubscribed" });
      }
      if (path !== "/v1/workspace/commands" || request.method !== "POST")
        return reply(405, { error: "Method not allowed" });
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
        return reply(415, { error: "JSON required" });
      let body;
      try {
        body = await readBody(request);
      } catch (error) {
        return reply(error.message === "too_large" ? 413 : 400, { error: "Invalid command" });
      }
      if (
        !body ||
        typeof body !== "object" ||
        body.classification !== "synthetic" ||
        (body.dataMode !== undefined && body.dataMode !== "prototype") ||
        !UUID.test(body.commandId ?? "") ||
        !Number.isSafeInteger(body.expectedRevision) ||
        body.expectedRevision < 1 ||
        body.expectedRevision >= Number.MAX_SAFE_INTEGER ||
        !body.event ||
        typeof body.event !== "object" ||
        Array.isArray(body.event) ||
        typeof body.event.type !== "string" ||
        body.event.type.length > 100
      )
        return reply(400, { error: "A synthetic command, command ID and valid revision are required" });
      const result = await store.command(actorId, body.commandId.toLowerCase(), body.expectedRevision, body.event);
      return reply(result.status, result.body);
    } catch (error) {
      if (error?.message === "invalid-command")
        return reply(400, { error: "The command is invalid; no change was saved" });
      const storage = storageFailure(error);
      note.failure = failureFields(error);
      return storage
        ? reply(
            503,
            { error: "Database unavailable; this change is not confirmed saved. Retry the same command ID." },
            "storage_unavailable",
          )
        : reply(
            500,
            { error: "The server could not complete this request; it is not confirmed saved.", requestId },
            "server_error",
          );
    }
  }
}
