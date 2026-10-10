import { parseSubscription } from "./push.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATHS = [
  "/v1/workspace",
  "/v1/workspace/commands",
  "/v1/workspace/audit",
  "/v1/workspace/push-key",
  "/v1/workspace/push-subscribe",
  "/v1/workspace/push-unsubscribe",
  "/v1/workspace/push-status",
];

export function createSharedHandler({ config, store, authenticate, readBody, verifierUnavailable }) {
  return async (request) => {
    const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
    const reply = (status, body) => Response.json(body, { status, headers });
    const origin = request.headers.get("origin");
    if (origin && origin !== config.origin) return reply(403, { error: "Origin not allowed" });
    if (origin) {
      headers["access-control-allow-origin"] = origin;
      headers.vary = "Origin";
    }
    const path = new URL(request.url).pathname;
    if (!PATHS.includes(path)) return reply(404, { error: "Not found" });
    if (request.method === "OPTIONS" && origin)
      return new Response(null, {
        status: 204,
        headers: {
          ...headers,
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "Authorization, Content-Type",
          "access-control-max-age": "600",
        },
      });
    let actorId;
    try {
      actorId = await authenticate(request.headers.get("authorization"));
    } catch (error) {
      return reply(error instanceof verifierUnavailable ? 503 : 401, {
        error: "Microsoft sign-in verification unavailable or required",
      });
    }
    // One application role, explicit named accounts. Tenant membership and client role fields
    // never grant coordinator access. These accounts can read the complete synthetic workspace.
    if (!config.coordinatorIds.includes(actorId))
      return reply(403, { error: "Coordinator access is not assigned to this account" });
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
      if (error.message === "invalid-command")
        return reply(400, { error: "The command is invalid; no change was saved" });
      return reply(503, {
        error: "Database unavailable; this change is not confirmed saved. Retry the same command ID.",
      });
    }
  };
}
