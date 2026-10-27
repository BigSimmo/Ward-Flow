// @ts-check
import { createHash, randomUUID } from "node:crypto";
import { errorFields, parseSubscription } from "./push.mjs";
import { bootstrapCoordinators } from "./auth.mjs";
import { jsonResponse } from "./reply-cache.mjs";
import { forecastHistoryInput } from "./forecast-history.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Each shared path and the closed route name it is logged under. */
const ROUTES = new Map([
  ["/v1/workspace", "workspace"],
  ["/v1/workspace/commands", "workspace_commands"],
  ["/v1/workspace/receipt", "workspace_receipt"],
  ["/v1/workspace/audit", "workspace_audit"],
  ["/v1/workspace/archive", "workspace_archive"],
  ["/v1/workspace/forecast-history", "forecast_history"],
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
  ["/v1/workspace/record-access", "record_access"],
  ["/v1/workspace/sign-out", "sign_out"],
]);
/** The screens that open a patient's record, as the record access log names them. */
const VIEW_SURFACES = new Set(["patient", "movement", "referral"]);
/** A synthetic person or movement id, as the workspace names them. */
const RECORD_ID = /^(?:PT|WF)-[A-Za-z0-9-]{1,96}$/;
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
/** "tv" when the desk is showing the bed meeting TV board, so the access log can say so (H-0731). */
const SCREEN = "x-ward-screen";
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
/**
 * CS-19 follow-up: the records a command's open popups have seen at a later revision than the
 * command's own, by the opaque tokens an earlier reply named as `covered` (records.mjs).
 */
const SEEN_TOKEN = /^[0-9a-f]{16}$/;
function validSeen(seen) {
  if (!seen || typeof seen !== "object" || Array.isArray(seen)) return false;
  const entries = Object.entries(seen);
  return (
    entries.length <= 1_000 &&
    entries.every(
      ([token, revision]) =>
        SEEN_TOKEN.test(token) && Number.isSafeInteger(revision) && revision >= 1 && revision < Number.MAX_SAFE_INTEGER,
    )
  );
}

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

/**
 * The end of a role being granted or approved (TC2-04, audit 26 Oct 2026, H-0763). The app sends
 * `expiresInMinutes`, as cover already sends `minutes`, and the end is set here on the server's own
 * clock, so a device clock hours slow can still grant a one-hour role and a fast one cannot stretch
 * it. An absolute `expiresAt` from an older client is still read, and checked against the server's
 * time in the store as before. Null when neither is usable.
 */
function requestedAccessEnd(body) {
  if (body?.expiresInMinutes !== undefined) {
    return Number.isSafeInteger(body.expiresInMinutes) && body.expiresInMinutes > 0
      ? new Date(Date.now() + body.expiresInMinutes * 60_000)
      : null;
  }
  return typeof body?.expiresAt === "string" ? new Date(body.expiresAt) : null;
}
export function storageFailure(error) {
  const code = error?.code;
  return (
    (typeof code === "string" && (STORAGE_SQLSTATE.test(code) || NETWORK_CODES.has(code))) ||
    error?.message === "Query read timeout" ||
    STORAGE_MESSAGES.test(String(error?.message ?? ""))
  );
}

/** The message of a thrown value, when it has one (H-0294: catch values are unknown). */
function messageOf(error) {
  return typeof error === "object" && error !== null && "message" in error ? error.message : undefined;
}

export function createSharedHandler({
  config,
  store,
  authenticate,
  readBody,
  verifierUnavailable,
  verifierRateLimited = /** @type {(new (...args: any[]) => Error) | null} */ (null),
  // Part B item 49 groundwork: off until the health service's sign-in or Supabase factors are set up.
  requireSecondStep = false,
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
      // Audit PS-05: a scoped board the store already serialised is reused, not stringified again.
      // TC2-05 (H-0764): every answer carrying a board (a save's too) carries the server's time, so
      // the app reads the board's `accessUntil` on this clock. Spread keeps the board's own object.
      const withTime =
        body && typeof body === "object" && "snapshot" in body && !("serverTime" in body)
          ? { serverTime: Date.now(), ...body }
          : body;
      return jsonResponse(withTime, { status, headers });
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
          "access-control-allow-headers": "Authorization, Content-Type, X-Ward-Working-As, X-Ward-Screen",
          "access-control-max-age": "600",
        },
      });
    }
    let actorId;
    /** @type {{ signedInAt?: number, startedAt?: number, aal?: string, secondStep?: boolean, sessionId?: string }} */
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
        : reply(401, { code: "auth-denied", error: "Sign in with the authorised account" }, "auth_denied");
    }
    // A sign-in lasts at most the session limit, however busy the desk (ISM-0428). It counts from
    // the token's first sign-in factor, which a refresh or a later factor never moves, so the person
    // signs in again with a password. A sign-in with no start time fails closed. Turning this
    // device's phone alerts off still goes through, so the sign-out can stop them reaching it.
    const limitMinutes = store.sessionLimitMinutes;
    const started = session.startedAt;
    if (
      Number.isFinite(limitMinutes) &&
      !(typeof started === "number" && Number.isFinite(started) && started >= Date.now() - limitMinutes * 60_000) &&
      path !== "/v1/workspace/push-unsubscribe"
    )
      return reply(
        401,
        {
          code: "session-limit",
          error: Number.isFinite(started)
            ? `Signed out after ${limitMinutes / 60} hours. Sign in again to carry on.`
            : "Signed out. Sign in again to carry on.",
        },
        "session_limit",
      );
    // A signed-out sign-in is refused at once, not when its token expires (readiness review item
    // 8). Turning this device's phone alerts off still goes through, as for the session limit.
    if (store.sessionSignedOut && path !== "/v1/workspace/push-unsubscribe") {
      try {
        if (await store.sessionSignedOut(session.sessionId))
          return reply(401, { code: "signed-out", error: "Signed out. Sign in again to carry on." }, "signed_out");
      } catch (error) {
        note.failure = errorFields(error);
        return storageFailure(error)
          ? reply(503, { error: "Database unavailable; try again shortly" }, "storage_unavailable")
          : reply(500, { error: "The server could not complete this request.", requestId }, "server_error");
      }
    }
    // Sign-out needs no role, so an account without one can end its own sign-in too.
    if (path === "/v1/workspace/sign-out") {
      if (request.method !== "POST") return reply(405, { error: "Method not allowed" });
      if (!store.signOutSession || typeof session.sessionId !== "string") return reply(200, { signedOut: false });
      try {
        return reply(200, {
          signedOut: await store.signOutSession(actorId, session.sessionId, session.startedAt),
        });
      } catch (error) {
        note.failure = errorFields(error);
        return storageFailure(error)
          ? reply(503, { error: "Database unavailable; sign out again shortly" }, "storage_unavailable")
          : reply(500, { error: "The server could not complete this request.", requestId }, "server_error");
      }
    }
    // When switched on, every other request needs a sign-in that finished its second step. Turning
    // this device's phone alerts off and signing out still go through, so nobody is stuck signed in.
    if (requireSecondStep && session.secondStep !== true && path !== "/v1/workspace/push-unsubscribe")
      return reply(
        401,
        { code: "second-step-required", error: "Finish signing in with your second step, then carry on." },
        "second_step_required",
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
        return { refusal: reply(messageOf(error) === "too_large" ? 413 : 400, { error: "Invalid request" }) };
      }
    };
    try {
      if (config.dataMode && config.dataMode !== "prototype")
        return reply(503, { error: "Live data mode is not commissioned" });
      // The role and place come from the server's own record on every request, never from the
      // browser or the sign-in token. Accounts in WARD_COORDINATOR_USER_IDS are the bootstrap
      // statewide coordinators; everyone else needs an active membership.
      const view = await store.viewer(actorId, {
        bootstrap: bootstrapCoordinators(config).includes(actorId),
        workingAs,
        // Fresh audit X-2: the push opt-out skips the sign-in checks above, so it must not count
        // as working the role, or a signed-out phone could keep an unused role on for good.
        ...(path === "/v1/workspace/push-unsubscribe" ? { touch: false } : {}),
      });
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
          ? await store.viewer(actorId, { bootstrap: bootstrapCoordinators(config).includes(actorId) })
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
            // The form is offered only where a request can be filed, so not before migration 9. A
            // role that names no health service (granted before one was required) is refused the
            // same way, under its own code so the screen can say to have it given again (RA-02).
            ...(store.requestAccess || view.needsService
              ? {
                  code: view.needsService ? "role-needs-service" : "no-role",
                  canRequest: !store.requestAccess ? false : store.takesRequests ? await store.takesRequests() : true,
                }
              : {}),
          },
          "auth_denied",
        );
      // A recent sign-in for the powerful steps. The window comes from the clinical values module
      // through the store; a store that names none asks every time.
      if (STEP_UP_PATHS.has(path) && request.method === "POST") {
        const windowMs = (Number.isFinite(store.stepUpMinutes) ? store.stepUpMinutes : 0) * 60_000;
        const signedInAt = session.signedInAt;
        if (!(typeof signedInAt === "number" && Number.isFinite(signedInAt) && signedInAt >= Date.now() - windowMs))
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
        // Missing session identity must not become a shared JSON-null recovery binding.
        const receiptIdentity =
          typeof session.sessionId === "string" && session.sessionId.trim().length > 0
            ? session.sessionId
            : Number.isFinite(started)
              ? started
              : undefined;
        // A locked store read can refresh this request's role and joined cover.
        const workspace = () => ({
          // TC2-05 (H-0764): the server's own time, so the app can read `accessUntil` against this
          // clock rather than the device's (`onDeviceClock` in ward-shared-client.ts).
          serverTime: Date.now(),
          role: view.access.role,
          access: view.access,
          workingAs: view.membershipId ?? "bootstrap",
          actorId,
          workspaceId: config.workspaceId,
          // No session limit configured means no sign-in deadline (a set limit with no start time was
          // already refused above), so only a role or grant expiry can bound access here.
          accessUntil: Math.min(
            typeof started === "number" && Number.isFinite(started) && Number.isFinite(limitMinutes)
              ? started + limitMinutes * 60_000
              : Infinity,
            view.accessUntil ?? Infinity,
            ...(view.grants ?? []).map((grant) => new Date(grant.until).getTime()),
          ),
          ...(receiptIdentity === undefined || typeof store.receipt !== "function"
            ? {}
            : {
                receiptScope: createHash("sha256")
                  .update(JSON.stringify([config.workspaceId, actorId, view.membershipId, receiptIdentity]))
                  .digest("hex"),
              }),
        });
        const data = { mode: "prototype", source: "synthetic", liveAvailable: false };
        // H-0731: the server logs, before sending them, that this desk read its records. An
        // unchanged poll sends none, so it is not logged, except on the TV board: a desk that moves
        // to the TV keeps showing the records it already holds, so the TV logs its own polls too
        // (the store logs at most once a window). A failed log write fails the read.
        const tvScreen = request.headers.get(SCREEN) === "tv";
        const logListRead = async () => {
          if (store.logList) await store.logList(view, tvScreen ? "tv" : "list");
        };
        // `?since=<revision>`: the poll. An unchanged workspace answers with its revision and clock only.
        const params = new URL(request.url).searchParams;
        const since = Number(params.get("since"));
        // `&context=<hash>`: the access context of the member desk's last full read (audit F-04).
        const context = params.get("context");
        if (Number.isSafeInteger(since) && since >= 1 && store.poll) {
          const polled = await store.poll(
            actorId,
            since,
            view,
            context && /^[a-f0-9]{64}$/.test(context) ? context : null,
          );
          if (polled.notModified) {
            if (polled.dataMode !== "prototype") throw new Error("Workspace data mode mismatch");
            if (tvScreen) await logListRead();
            return reply(200, { ...workspace(), data, notModified: true, revision: polled.revision, now: polled.now });
          }
          if (polled.snapshot.dataMode !== "prototype") throw new Error("Workspace data mode mismatch");
          await logListRead();
          return reply(200, { ...workspace(), data, snapshot: polled.snapshot });
        }
        const snapshot = await store.read(actorId, view);
        if (snapshot.dataMode !== "prototype") throw new Error("Workspace data mode mismatch");
        await logListRead();
        return reply(200, { ...workspace(), data, snapshot });
      }
      if (path === "/v1/workspace/receipt" && request.method === "GET") {
        const commandId = new URL(request.url).searchParams.get("commandId");
        if (!UUID.test(commandId ?? "")) return reply(400, { error: "A command ID is required" });
        if (typeof store.receipt !== "function") return reply(404, { error: "Command receipts are not available" });
        return reply(200, { receipt: await store.receipt(actorId, (commandId ?? "").toLowerCase()) });
      }
      if (path === "/v1/workspace/archive" && request.method === "GET") {
        // History's closed records older than 30 days (migration 14), each desk's own part only,
        // as its live workspace is. A store without an archive answers with an empty list.
        if (!store.archive) return reply(200, { archived: 0, records: [] });
        // Audit PS-01: a desk that holds the archive names the revision it holds, and is sent only
        // what was archived after it. Anything else reads the whole archive.
        const since = new URL(request.url).searchParams.get("since");
        const archive = await store.archive(view, since && /^\d{1,15}$/.test(since) ? Number(since) : undefined);
        // GV-27: archived records sent to a desk are logged as a list read, as the live list is
        // (H-0731), before they go. A failed log write fails the read.
        if (archive?.records?.length && store.logList) await store.logList(view, "list");
        return reply(200, archive);
      }
      if (path === "/v1/workspace/forecast-history") {
        // Proposal 013 (migration 16): this desk's forecast snapshots and miss reasons, shared by
        // every device and colleague working the same role and place. Counts and closed-list values
        // only. A store without the table answers `shared: false`, and the browser keeps its own.
        if (!store.forecastHistory || !store.recordForecast) return reply(200, { shared: false });
        if (request.method === "GET") return reply(200, await store.forecastHistory(view));
        const { body, refusal } = await json();
        if (refusal) return refusal;
        const input = forecastHistoryInput(body);
        if (!input) return reply(400, { error: "A forecast snapshot or a reason for a missed day is required" });
        const result = await store.recordForecast(view, input);
        return reply(result.status, result.body);
      }
      if (path === "/v1/workspace/audit" && request.method === "GET") {
        // Change facts name records across the network, so only the statewide coordinator reads
        // them all; the access admin reads role changes only. Nobody else reads the audit.
        if (!whole && view.access.role !== "admin")
          return reply(403, { error: "The audit record is not part of your role" }, "role_denied");
        const cursor = new URL(request.url).searchParams.get("before");
        if (cursor !== null && (!/^[1-9][0-9]{0,18}$/.test(cursor) || BigInt(cursor) > 9223372036854775807n))
          return reply(400, { error: "Invalid audit cursor" });
        if (typeof store.auditPage === "function") return reply(200, await store.auditPage(view, cursor));
        const events = cursor === null ? await store.audit(view) : await store.audit(view, cursor);
        const complete = events.length < 200;
        return reply(200, { events, complete, nextCursor: complete ? null : String(events.at(-1).sequence) });
      }
      if (path === "/v1/workspace/record-access") {
        // Every desk logs the records it opens. The statewide coordinator reads the whole log; the
        // access admin reads it for the desks inside its own place (D-80 item 14, Access log). A
        // coordinator also reads the break glass openings for its review list: statewide every
        // record, a service coordinator the records in its own service (D-80 item 14).
        if (request.method === "GET") {
          const coordinator = view.access.role === "coordinator";
          if (!whole && !coordinator && view.access.role !== "admin")
            return reply(403, { error: "The record access log is not part of your role" }, "role_denied");
          const patient = new URL(request.url).searchParams.get("patient");
          if (patient !== null && !RECORD_ID.test(patient)) return reply(400, { error: "A patient is required" });
          // #839: both lists are read at once, as each is its own round trip to the database.
          const [views, openings] = await Promise.all([
            store.recordViews ? store.recordViews(view, patient) : [],
            coordinator && store.breakGlassOpenings && patient === null ? store.breakGlassOpenings(view) : [],
          ]);
          if (!coordinator) return reply(200, { views });
          return reply(200, { views, openings });
        }
        const { body, refusal } = await json();
        if (refusal) return refusal;
        if (typeof body?.patientId !== "string" || !RECORD_ID.test(body.patientId) || !VIEW_SURFACES.has(body?.surface))
          return reply(400, { error: "A patient and a screen are required" });
        if (!store.logView) return reply(200, { logged: false });
        const result = await store.logView(view, body.patientId, body.surface);
        return reply(result.status, result.body);
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
          const expiresAt = requestedAccessEnd(body);
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
          const expiresAt = requestedAccessEnd(body);
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
          return reply(messageOf(error) === "too_large" ? 413 : 400, { error: "Invalid subscription" });
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
        return reply(messageOf(error) === "too_large" ? 413 : 400, { error: "Invalid command" });
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
        (body.reply !== undefined && body.reply !== "revision") ||
        (body.seen !== undefined && !validSeen(body.seen))
      )
        return reply(400, { error: "A synthetic command, command ID and valid revision are required" });
      const result = await store.command(actorId, body.commandId.toLowerCase(), body.expectedRevision, body.event, {
        revisionOnly: body.reply === "revision",
        ...(body.seen ? { seen: body.seen } : {}),
        view,
      });
      return reply(result.status, result.body);
    } catch (error) {
      if (messageOf(error) === "role-ended")
        return reply(403, { error: "No Ward Flow role is assigned to this account" }, "auth_denied");
      if (messageOf(error) === "invalid-command")
        return reply(400, { error: "The command is invalid; no change was saved" });
      // H-0291: the save would take the workspace past its size limit. It rolled back, so this
      // change is definitely not saved, and retrying the same change cannot succeed.
      if (
        (typeof error === "object" && error !== null && "name" in error && error.name === "WorkspaceTooLargeError") ||
        messageOf(error) === "Workspace too large"
      )
        return reply(
          413,
          { code: "workspace-full", error: "The shared workspace is full, so this change was not saved." },
          "workspace_full",
        );
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
