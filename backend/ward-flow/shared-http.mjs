// @ts-check
import { randomUUID } from "node:crypto";
import { errorFields, parseSubscription } from "./push.mjs";

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
  ["/v1/workspace/access", "access_list"],
  ["/v1/workspace/access/grant", "access_grant"],
  ["/v1/workspace/access/approve", "access_approve"],
  ["/v1/workspace/access/revoke", "access_revoke"],
  ["/v1/workspace/access/cover", "access_cover"],
  ["/v1/workspace/access/request", "access_request"],
  ["/v1/workspace/access/decide", "access_decide"],
  ["/v1/workspace/break-glass", "break_glass"],
]);
/**
 * The powerful steps (feature 9): giving, approving or ending a role, giving cover, answering a
 * request for access and opening a record outside your care. Each needs a recent sign-in.
 */
const STEP_UP_PATHS = new Set([
  "/v1/workspace/access/grant",
  "/v1/workspace/access/approve",
  "/v1/workspace/access/revoke",
  "/v1/workspace/access/cover",
  "/v1/workspace/access/decide",
  "/v1/workspace/break-glass",
]);
/** Names one of the account's roles when it holds more than one: a membership ID or "bootstrap". */
const WORKING_AS = "x-ward-working-as";
/** Messages the pg pool and the workspace store use when the database, not the code, failed. */
const STORAGE_MESSAGES =
  /^(?:Connection terminated|timeout exceeded when trying to connect|Client has encountered a connection error|Cannot use a pool after calling end|Shared schema unavailable|Workspace data mode mismatch|Stored workspace is incompatible)/;

/**
 * PostgreSQL SQLSTATEs that mean the database could not do the work now: connection (08),
 * insufficient resources (53), operator intervention such as a shutdown (57), system error (58),
 * a serialization failure, a deadlock or an unavailable lock. Any other SQLSTATE is a query fault
 * that retrying will not clear, so it is a code fault.
 */
const STORAGE_SQLSTATE = /^(?:(?:08|53|57|58)[0-9A-Z]{3}|40001|40P01|55P03)$/;
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
    error?.message === "Query read timeout" ||
    STORAGE_MESSAGES.test(String(error?.message ?? ""))
  );
}

export function createSharedHandler({
  config,
  store,
  authenticate,
  readBody,
  verifierUnavailable,
  verifierRateLimited = null,
  log = (event) => console.info(JSON.stringify(event)),
}) {
  return async (request, meta = {}) => {
    const requestId = randomUUID();
    const startedAt = performance.now();
    const path = new URL(request.url).pathname;
    /** @type {{ outcome?: string, failure?: Record<string, unknown> }} */
    const note = {};
    const response = await handle(request, path, requestId, note, meta);
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

  async function handle(request, path, requestId, note, meta) {
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
          "access-control-allow-headers": "Authorization, Content-Type, X-Ward-Working-As",
          "access-control-max-age": "600",
        },
      });
    }
    let actorId;
    /** @type {{ signedInAt?: number, sessionStartedAt?: number, aal?: string }} */
    const session = {};
    try {
      actorId = await authenticate(request.headers.get("authorization"), {
        clientAddress: meta.clientAddress,
        session,
      });
    } catch (error) {
      if (verifierRateLimited && error instanceof verifierRateLimited) {
        headers["retry-after"] = "60";
        return reply(429, { error: "Too many sign-in checks; try again shortly" }, "rate_limited");
      }
      return error instanceof verifierUnavailable
        ? reply(503, { error: "Sign-in verification unavailable; try again shortly" }, "verifier_unavailable")
        : reply(401, { error: "Sign in with the authorised account" }, "auth_denied");
    }
    // A sign-in lasts at most the session limit, however busy the desk (ISM-0428). Supabase tokens
    // carry the sign-in time, which a refresh keeps, so the person signs in again with a password.
    const limitMs = (Number.isFinite(store.sessionLimitMinutes) ? store.sessionLimitMinutes : Infinity) * 60_000;
    if (!Number.isFinite(session.sessionStartedAt) || session.sessionStartedAt < Date.now() - limitMs)
      return reply(
        401,
        {
          code: "session-limit",
          error: `Signed out after ${store.sessionLimitMinutes / 60} hours. Sign in again to carry on.`,
        },
        "session_limit",
      );
    const workingAs = request.headers.get(WORKING_AS)?.toLowerCase() ?? null;
    if (workingAs !== null && workingAs !== "bootstrap" && !UUID.test(workingAs))
      return reply(400, { error: "Working as names one of this account's roles" });
    // A JSON body, or the reply that refuses it.
    const json = async () => {
      if (request.method !== "POST") return { refusal: reply(405, { error: "Method not allowed" }) };
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
        return { refusal: reply(415, { error: "JSON required" }) };
      try {
        return { body: await readBody(request) };
      } catch (error) {
        return { refusal: reply(error.message === "too_large" ? 413 : 400, { error: "Invalid request" }) };
      }
    };
    try {
      if (config.dataMode && config.dataMode !== "prototype")
        return reply(503, { error: "Live data mode is not commissioned" });
      // The role and place come from the server's own record on every request, never from the
      // browser or the sign-in token. Accounts in WARD_COORDINATOR_USER_IDS are the bootstrap
      // statewide coordinators; everyone else needs an active membership.
      const view = await store.viewer(actorId, { bootstrap: config.coordinatorIds.includes(actorId), workingAs });
      // Asking for access is for a signed-in account with no role (feature 7), so it is answered
      // before the role checks below. An account that already holds a role is given another by an
      // access admin, never by a request it files itself.
      if (path === "/v1/workspace/access/request" && store.requestAccess) {
        if (request.method === "GET") {
          const result = await store.ownRequest(actorId);
          return reply(result.status, result.body);
        }
        // Decided from the account's roles, not the desk named in the header: a stale or made-up
        // working-as id reads as no desk, but the account still holds its roles.
        const holder = workingAs
          ? await store.viewer(actorId, { bootstrap: config.coordinatorIds.includes(actorId) })
          : view;
        if (holder.status !== "none")
          return reply(403, { error: "This account already has a role. Ask your access admin for another." });
        const { body, refusal } = await json();
        if (refusal) return refusal;
        if (typeof body?.role !== "string" || JSON.stringify(body?.scope ?? null).length > 4096)
          return reply(400, { error: "A role and a place are required" });
        const result = await store.requestAccess(actorId, { role: body.role, scope: body.scope });
        return reply(result.status, result.body);
      }
      if (view.status === "choose")
        return reply(
          409,
          {
            code: "choose-role",
            error: "This account holds more than one role. Say which one to work as.",
            choices: view.choices,
          },
          "auth_denied",
        );
      if (view.status !== "ok")
        return reply(
          403,
          {
            error: "No Ward Flow role is assigned to this account",
            // The form is offered only where a request can be filed, so not before migration 9.
            ...(store.requestAccess
              ? { code: "no-role", canRequest: store.takesRequests ? await store.takesRequests() : true }
              : {}),
          },
          "auth_denied",
        );
      // A recent sign-in for the powerful steps. The window comes from the clinical values module
      // through the store; a store that names none asks every time.
      if (STEP_UP_PATHS.has(path) && request.method === "POST") {
        const windowMs = (Number.isFinite(store.stepUpMinutes) ? store.stepUpMinutes : 0) * 60_000;
        if (!(Number.isFinite(session.signedInAt) && session.signedInAt >= Date.now() - windowMs))
          return reply(
            401,
            {
              code: "step-up",
              error: "Sign in again to carry on. This step needs a recent sign-in.",
            },
            "step_up",
          );
      }
      const whole = view.access.role === "coordinator" && view.access.scope.kind === "statewide";
      if (path === "/v1/workspace" && request.method === "GET") {
        // A locked store read can refresh this request's role and joined cover.
        const workspace = () => ({
          role: view.access.role,
          access: view.access,
          workingAs: view.membershipId ?? "bootstrap",
          actorId,
          workspaceId: config.workspaceId,
        });
        const data = { mode: "prototype", source: "synthetic", liveAvailable: false };
        // `?since=<revision>`: the poll. An unchanged workspace answers with its revision and clock only.
        const since = Number(new URL(request.url).searchParams.get("since"));
        if (Number.isSafeInteger(since) && since >= 1 && store.poll) {
          const polled = await store.poll(actorId, since, view);
          if (polled.notModified) {
            if (polled.dataMode !== "prototype") throw new Error("Workspace data mode mismatch");
            return reply(200, { ...workspace(), data, notModified: true, revision: polled.revision, now: polled.now });
          }
          if (polled.snapshot.dataMode !== "prototype") throw new Error("Workspace data mode mismatch");
          return reply(200, { ...workspace(), data, snapshot: polled.snapshot });
        }
        const snapshot = await store.read(actorId, view);
        if (snapshot.dataMode !== "prototype") throw new Error("Workspace data mode mismatch");
        return reply(200, { ...workspace(), data, snapshot });
      }
      if (path === "/v1/workspace/audit" && request.method === "GET") {
        // Change facts name records across the network, so only the statewide coordinator reads
        // them all; the access admin reads role changes only. Nobody else reads the audit.
        if (!whole && view.access.role !== "admin")
          return reply(403, { error: "The audit record is not part of your role" }, "role_denied");
        return reply(200, { events: await store.audit(view) });
      }
      if (path === "/v1/workspace/access" && request.method === "GET") {
        const result = await store.listAccess(view);
        return reply(result.status, result.body);
      }
      if (path === "/v1/workspace/access/cover" && request.method === "GET" && store.listCovers) {
        const result = await store.listCovers(view);
        return reply(result.status, result.body);
      }
      if (path.startsWith("/v1/workspace/access/") || path === "/v1/workspace/break-glass") {
        const { body, refusal } = await json();
        if (refusal) return refusal;
        let result;
        if (path === "/v1/workspace/break-glass") {
          if (typeof body?.patientId !== "string" || body.patientId.length > 100)
            return reply(400, { error: "A patient is required" });
          result = await store.breakGlass(view, body.patientId, body.reason);
        } else if (path === "/v1/workspace/access/grant") {
          const expiresAt = typeof body?.expiresAt === "string" ? new Date(body.expiresAt) : null;
          if (
            !UUID.test(body?.actorId ?? "") ||
            !expiresAt ||
            !Number.isFinite(expiresAt.getTime()) ||
            JSON.stringify(body?.scope ?? null).length > 4096
          )
            return reply(400, { error: "A person, a role, a place and an end date are required" });
          result = await store.grantAccess(view, {
            actorId: body.actorId.toLowerCase(),
            role: body.role,
            scope: body.scope,
            expiresAt,
          });
        } else if (path === "/v1/workspace/access/cover") {
          if (
            !store.giveCover ||
            !UUID.test(body?.actorId ?? "") ||
            !Number.isSafeInteger(body?.minutes) ||
            JSON.stringify(body?.scope ?? null).length > 4096
          )
            return reply(400, { error: "A person, a ward or ED and a length are required" });
          result = await store.giveCover(view, {
            actorId: body.actorId.toLowerCase(),
            scope: body.scope,
            minutes: body.minutes,
          });
        } else if (path === "/v1/workspace/access/decide") {
          const expiresAt = typeof body?.expiresAt === "string" ? new Date(body.expiresAt) : null;
          if (
            !store.decideRequest ||
            !UUID.test(body?.requestId ?? "") ||
            !["approved", "declined"].includes(body?.decision) ||
            // Only an approval gives a role, so only an approval needs an end date.
            (body.decision === "approved" && (!expiresAt || !Number.isFinite(expiresAt.getTime())))
          )
            return reply(400, { error: "A request, an answer and an end date are required" });
          result = await store.decideRequest(view, body.requestId.toLowerCase(), body.decision, expiresAt);
        } else {
          if (!UUID.test(body?.membershipId ?? "")) return reply(400, { error: "A role is required" });
          const membershipId = body.membershipId.toLowerCase();
          if (path === "/v1/workspace/access/approve") result = await store.approveAccess(view, membershipId);
          else if (path === "/v1/workspace/access/revoke") result = await store.revokeAccess(view, membershipId);
          else return reply(404, { error: "Not found" });
        }
        return reply(result.status, result.body);
      }
      // Phone push. The public key is not a secret; "enabled: false" tells Settings the server is
      // not set up for it, so the control can say why instead of disappearing.
      if (path === "/v1/workspace/push-key" && request.method === "GET")
        return reply(200, config.push ? { enabled: true, publicKey: config.push.publicKey } : { enabled: false });
      if (path.startsWith("/v1/workspace/push-")) {
        if (request.method !== "POST" || path === "/v1/workspace/push-key")
          return reply(405, { error: "Method not allowed" });
        if (!config.push || !store.subscribe) return reply(503, { error: "Phone alerts are not set up on the server" });
        // A bootstrap statewide coordinator hears the whole network. From migration 9 a desk held
        // by membership (coordinator, bed manager, nurse in charge, ED) hears its own place only;
        // before 9 delivery reads WARD_COORDINATOR_USER_IDS alone, so it would never hear.
        const byRole = !!view.membershipId && !!store.pushByRole?.(view);
        if (!view.membershipId && !whole)
          return reply(422, { code: "role", error: "Phone alerts are not part of your role" }, "role_denied");
        if (view.membershipId && !byRole)
          return reply(
            422,
            {
              code: "role",
              error: store.pushByRole
                ? "Phone alerts are not part of your role, or are not set up on this database yet."
                : "Phone alerts for this account are not wired in this prototype.",
            },
            "role_denied",
          );
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
          const outcome = await store.subscribe(actorId, subscription, view.membershipId ?? null);
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
          return reply(200, { owned: await store.pushStatus(actorId, endpoint, view.membershipId ?? null) });
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
        body.event.type.length > 100 ||
        (body.reply !== undefined && body.reply !== "revision")
      )
        return reply(400, { error: "A synthetic command, command ID and valid revision are required" });
      const result = await store.command(actorId, body.commandId.toLowerCase(), body.expectedRevision, body.event, {
        revisionOnly: body.reply === "revision",
        view,
      });
      return reply(result.status, result.body);
    } catch (error) {
      if (error?.message === "role-ended")
        return reply(403, { error: "No Ward Flow role is assigned to this account" }, "auth_denied");
      if (error?.message === "invalid-command")
        return reply(400, { error: "The command is invalid; no change was saved" });
      const storage = storageFailure(error);
      note.failure = errorFields(error);
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
