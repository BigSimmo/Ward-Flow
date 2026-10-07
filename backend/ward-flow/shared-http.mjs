const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    if (!["/v1/workspace", "/v1/workspace/commands", "/v1/workspace/audit"].includes(path))
      return reply(404, { error: "Not found" });
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
      if (path === "/v1/workspace" && request.method === "GET")
        return reply(200, {
          role: "coordinator",
          actorId,
          workspaceId: config.workspaceId,
          snapshot: await store.read(actorId),
        });
      if (path === "/v1/workspace/audit" && request.method === "GET")
        return reply(200, { events: await store.audit() });
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
