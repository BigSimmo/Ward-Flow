// @ts-check
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { createHandler } from "./server.mjs";
import { storageFailure } from "./shared-http.mjs";
import { readConfig } from "./config.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";
import { syntheticDatabaseUrl } from "./synthetic-database-url.test-support.mjs";
import { STATEWIDE_VIEW, bootstrapViewer } from "./viewer.test-support.mjs";

const coordinator = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const commandId = "44444444-4444-4444-8444-444444444444";
const auditEvent = {
  sequence: 1,
  actor_id: coordinator,
  actor_role: "coordinator",
  data_mode: "prototype",
  action: "PULL_PATIENT",
  outcome: "accepted",
  prior_revision: 1,
  revision: 2,
  changes: {},
  committed_at: "2026-01-01T00:00:00.000Z",
};
const body = {
  classification: "synthetic",
  commandId,
  expectedRevision: 1,
  event: { type: "PULL_PATIENT", role: "coordinator" },
};
function setup(actor = coordinator, dataMode = "prototype", overrides = {}) {
  const calls = [];
  const logs = [];
  const sharedStore = {
    viewer: bootstrapViewer,
    read: async (...args) => {
      calls.push(args);
      return { revision: 1, dataMode };
    },
    command: async (...args) => {
      calls.push(args);
      return { status: 409, body: { outcome: "stale" } };
    },
    audit: async (...args) => {
      calls.push(["audit", ...args]);
      return [auditEvent];
    },
    // Granting access and breaking glass need a recent sign-in (feature 9).
    stepUpMinutes: 10,
    // A sign-in lasts at most 12 hours (ISM-0428).
    sessionLimitMinutes: 720,
    ...overrides,
  };
  const handler = createHandler({
    config: { coordinatorIds: [coordinator], origin: "https://ward-flow-production.up.railway.app" },
    sharedStore,
    /** @param {string} token @param {{ session?: { signedInAt?: number, startedAt?: number } }} [context] */
    authenticate: async (token, { session } = {}) => {
      if (!token) throw new Error("Unauthorized");
      // "Bearer stale" stands for a sign-in older than the step-up window, "Bearer old" for one
      // older than the session limit, "Bearer old-later-factor" for an old sign-in with a recent
      // second factor, and "Bearer unknown" for a token with no sign-in times.
      if (session && token !== "Bearer unknown") {
        const age = { "Bearer stale": 11 * 60_000, "Bearer old": 12 * 60 * 60_000 + 60_000 }[token] ?? 0;
        session.signedInAt = session.startedAt = Date.now() - age;
        if (token === "Bearer old-later-factor") session.startedAt = Date.now() - 12 * 60 * 60_000 - 60_000;
      }
      return actor;
    },
    log: (event) => logs.push(event),
  });
  return { calls, logs, handler };
}
const request = (path = "", data, token = "Bearer test") =>
  new Request(`http://localhost/v1/workspace${path}`, {
    method: data ? "POST" : "GET",
    headers: { authorization: token, "content-type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });

test("a named coordinator can read the entire shared workspace", async () => {
  const { calls, handler } = setup();
  const response = await handler(request());
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.role, "coordinator");
  assert.deepEqual(value.access, STATEWIDE_VIEW.access);
  assert.equal(value.workingAs, "bootstrap");
  assert.deepEqual(value.data, { mode: "prototype", source: "synthetic", liveAvailable: false });
  assert.deepEqual(calls, [[coordinator, { ...STATEWIDE_VIEW, actorId: coordinator }]]);
});
test("another tenant account cannot self-assign coordinator in a command", async () => {
  const { calls, handler } = setup(other);
  assert.equal((await handler(request("/commands", body))).status, 403);
  assert.equal(calls.length, 0);
});
test("a named coordinator can read audit events without reading or commanding the workspace", async () => {
  const { calls, handler } = setup();
  const response = await handler(request("/audit"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { events: [auditEvent], complete: true, nextCursor: null });
  assert.deepEqual(calls, [["audit", { ...STATEWIDE_VIEW, actorId: coordinator }]]);
});
test("another tenant account cannot read audit events or reach the workspace", async () => {
  const { calls, handler } = setup(other);
  const response = await handler(request("/audit"));
  assert.equal(response.status, 403);
  assert.deepEqual(calls, []);
});
test("the API does not expose a snapshot with mismatched database provenance", async () => {
  const { handler } = setup(coordinator, "live");
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).snapshot, undefined);
});
test("missing authentication and cross-origin calls never reach the database", async () => {
  const { calls, handler } = setup();
  assert.equal((await handler(request("", undefined, ""))).status, 401);
  const crossOrigin = request("/commands", body);
  crossOrigin.headers.set("origin", "https://example.com");
  assert.equal((await handler(crossOrigin)).status, 403);
  assert.equal(calls.length, 0);
});
test("the server forwards the authenticated actor and conflict result", async () => {
  const { calls, handler } = setup();
  const response = await handler(request("/commands", { ...body, actorId: other }));
  assert.equal(response.status, 409);
  assert.equal(calls[0][0], coordinator);
  assert.equal(calls[0][1], commandId);
});
test("a role removed while a request is in flight answers 403, not a server error", async () => {
  const { handler } = setup(coordinator, "prototype", {
    command: async () => {
      throw new Error("role-ended");
    },
  });
  const response = await handler(request("/commands", body));
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /No Ward Flow role/);
});

test("clinical labels and invalid command envelopes are rejected", async () => {
  const { calls, handler } = setup();
  for (const invalid of [
    { ...body, classification: "clinical" },
    { ...body, dataMode: "live" },
    { ...body, expectedRevision: 0 },
    { ...body, commandId: "bad" },
    { ...body, event: [] },
  ])
    assert.equal((await handler(request("/commands", invalid))).status, 400);
  assert.equal(calls.length, 0);
});
test("shared configuration reads only the approved Supabase target and refuses live data", () => {
  const env = {
    WARD_COORDINATOR_USER_IDS: coordinator,
    WARD_SUPABASE_PROJECT_REF: APPROVED_SUPABASE_PROJECT,
    WARD_SUPABASE_URL: APPROVED_SUPABASE_URL,
    WARD_SUPABASE_PUBLISHABLE_KEY: ["sb", "publishable", "synthetic_offline_fixture"].join("_"),
    WARD_SHARED_ENABLED: "true",
    WARD_WORKSPACE_ID: commandId,
    WARD_SUPABASE_DATABASE_URL: syntheticDatabaseUrl({
      host: `db.${APPROVED_SUPABASE_PROJECT}.supabase.co`,
      database: "postgres",
    }),
  };
  assert.ok(readConfig(env).shared);
  assert.equal(readConfig(env).postgres.connectionString, env.WARD_SUPABASE_DATABASE_URL);
  assert.equal(readConfig(env).dataMode, "prototype");
  assert.throws(() => readConfig({ ...env, WARD_DATA_MODE: "live" }), /not commissioned/);
  assert.throws(() => readConfig({ ...env, WARD_DATA_MODE: "invalid" }), /not commissioned/);
  for (const host of ["db.otherproject.supabase.co", "127.0.0.1"])
    assert.throws(
      () => readConfig({ ...env, WARD_SUPABASE_DATABASE_URL: syntheticDatabaseUrl({ host, database: "postgres" }) }),
      /Unapproved/,
    );
  assert.throws(() => readConfig({ ...env, WARD_WORKSPACE_ID: "00000000-0000-4000-8000-000000000000" }), /workspace/);
});

test("every shared request is logged with its request ID and closed fields only", async () => {
  const { logs, handler } = setup();
  const response = await handler(request("/commands", body));
  assert.equal(response.status, 409);
  const requestId = response.headers.get("x-request-id");
  assert.match(requestId, /^[0-9a-f-]{36}$/);
  assert.equal(logs.length, 1);
  const { durationMs, ...entry } = logs[0];
  assert.ok(Number.isInteger(durationMs));
  assert.deepEqual(entry, {
    event: "ward_backend_request",
    requestId,
    route: "workspace_commands",
    method: "POST",
    status: 409,
    outcome: "refused",
  });
  assert.doesNotMatch(JSON.stringify(logs), new RegExp(coordinator));
});
test("a database outage is a 503 and a code fault is a 500, and both are logged", async () => {
  const outage = Object.assign(new Error('relation "x" does not exist: secret value'), { code: "57P01" });
  const fault = new TypeError("Cannot read properties of undefined (reading 'state')");
  /** @type {Array<[Error, number, string, Record<string, string>]>} */
  const failures = [
    [outage, 503, "storage_unavailable", { errorName: "Error", errorCode: "57P01" }],
    [new Error("Connection terminated unexpectedly"), 503, "storage_unavailable", { errorName: "Error" }],
    [
      Object.assign(new Error("canceling statement due to lock timeout"), { code: "55P03" }),
      503,
      "storage_unavailable",
      { errorName: "Error", errorCode: "55P03" },
    ],
    [new Error("Query read timeout"), 503, "storage_unavailable", { errorName: "Error" }],
    [fault, 500, "server_error", { errorName: "TypeError" }],
    [
      Object.assign(new Error('column "secret value" does not exist'), { code: "42703" }),
      500,
      "server_error",
      { errorName: "Error", errorCode: "42703" },
    ],
  ];
  for (const [error, status, outcome, fields] of failures) {
    const { logs, handler } = setup(coordinator, "prototype", {
      command: async () => {
        throw error;
      },
    });
    const response = await handler(request("/commands", body));
    assert.equal(response.status, status);
    const { durationMs, requestId, ...entry } = logs[0];
    assert.ok(Number.isInteger(durationMs));
    assert.equal(requestId, response.headers.get("x-request-id"));
    assert.deepEqual(entry, {
      event: "ward_backend_request",
      route: "workspace_commands",
      method: "POST",
      status,
      outcome,
      ...fields,
    });
  }
});
test("storage failures are told apart from code faults", () => {
  assert.equal(storageFailure(Object.assign(new Error("x"), { code: "ECONNREFUSED" })), true);
  for (const code of ["08006", "53300", "57P01", "58030", "40001", "40P01"])
    assert.equal(storageFailure(Object.assign(new Error("x"), { code })), true, code);
  for (const code of ["23514", "42703", "P0001", "ENGINE"])
    assert.equal(storageFailure(Object.assign(new Error("x"), { code })), false, code);
  assert.equal(storageFailure(new Error("timeout exceeded when trying to connect")), true);
  assert.equal(storageFailure(new RangeError("Invalid time value")), false);
  assert.equal(storageFailure(Object.assign(new Error("x"), { code: "ERR_INVALID_ARG_TYPE" })), false);
});
test("shared routes are logged with a request ID even when the shared workspace is off", async () => {
  const logs = [];
  const handler = createHandler({
    config: { coordinatorIds: [coordinator], origin: null },
    sharedStore: null,
    authenticate: async () => coordinator,
    log: (event) => logs.push(event),
  });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].requestId, response.headers.get("x-request-id"));
  assert.equal(logs[0].route, "workspace");
  assert.equal(logs[0].outcome, "not_configured");
});

// Match the pg client's configured deadline vocabulary narrowly: arbitrary timeout text can
// still be an application fault and must not hide behind a retryable database response.
test("only the configured pg query timeout and lock SQLSTATE are storage failures", () => {
  assert.equal(storageFailure(new Error("Query read timeout")), true);
  assert.equal(storageFailure({ code: "55P03" }), true);
  for (const message of ["Query read timeout: invalid application state", "application timeout", "query read timeout"])
    assert.equal(storageFailure(new Error(message)), false, message);
  for (const code of ["55000", "55P02", "55P04"]) assert.equal(storageFailure({ code }), false, code);
});

test("arbitrary exception fields cannot enter HTTP diagnostics or the response", async () => {
  const { logs, handler } = setup(coordinator, "prototype", {
    command: async () => {
      throw { name: "synthetic-private-name", code: "SECRT", message: "synthetic-private-marker" };
    },
  });
  const response = await handler(request("/commands", body));
  assert.equal(response.status, 500);
  const value = await response.json();
  assert.equal(logs[0].errorName, "Error");
  assert.equal(logs[0].errorCode, undefined);
  assert.equal(logs[0].requestId, response.headers.get("x-request-id"));
  assert.equal(logs[0].requestId, value.requestId);
  assert.equal(logs[0].outcome, "server_error");
  assert.doesNotMatch(JSON.stringify({ logs, value }), /synthetic-private|SECRT/);
});

test("the poll names its revision; an unchanged workspace answers with the clock only", async () => {
  const { calls, handler } = setup(coordinator, "prototype", {
    poll: async (...args) => {
      calls.push(["poll", ...args]);
      return { notModified: true, dataMode: "prototype", revision: 7, now: 900 };
    },
  });
  const response = await handler(request("?since=7"));
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.notModified, true);
  assert.equal(value.revision, 7);
  assert.equal(value.now, 900);
  assert.equal(value.snapshot, undefined);
  assert.deepEqual(calls, [["poll", coordinator, 7, { ...STATEWIDE_VIEW, actorId: coordinator }, null]]);
  // A member desk names its access context (audit F-04); anything but a 64-hex hash is ignored.
  const context = "a".repeat(64);
  await handler(request(`?since=7&context=${context}`));
  assert.equal(calls.at(-1).at(-1), context);
  await handler(request("?since=7&context=not-a-hash"));
  assert.equal(calls.at(-1).at(-1), null);
  for (const since of ["0", "x", "1.5"]) {
    const { calls: plain, handler: other } = setup();
    assert.equal((await other(request(`?since=${since}`))).status, 200);
    assert.deepEqual(
      plain,
      [[coordinator, { ...STATEWIDE_VIEW, actorId: coordinator }]],
      "an unusable revision reads the full workspace",
    );
  }
});
test("a command may ask for a revision-only reply, and nothing else", async () => {
  const { calls, handler } = setup();
  await handler(request("/commands", { ...body, reply: "revision" }));
  assert.deepEqual(calls.at(-1).at(-1), { revisionOnly: true, view: { ...STATEWIDE_VIEW, actorId: coordinator } });
  assert.equal((await handler(request("/commands", { ...body, reply: "everything" }))).status, 400);
});
test("a command may say which records its popups saw at a later revision (CS-19 follow-up)", async () => {
  const { calls, handler } = setup();
  const seen = { "0123456789abcdef": 3 };
  await handler(request("/commands", { ...body, seen }));
  assert.deepEqual(calls.at(-1).at(-1), {
    revisionOnly: false,
    seen,
    view: { ...STATEWIDE_VIEW, actorId: coordinator },
  });
  for (const bad of [[], { "not-a-token": 3 }, { "0123456789abcdef": 0 }, { "0123456789abcdef": 1.5 }])
    assert.equal((await handler(request("/commands", { ...body, seen: bad }))).status, 400);
});

const wardView = {
  ...STATEWIDE_VIEW,
  actorId: other,
  membershipId: "55555555-5555-4555-8555-555555555555",
  access: { role: "ward", scope: { kind: "ward", unitIds: ["unit-a"] } },
};

test("a desk with a membership is sent only its own view, and the audit is not part of its role", async () => {
  const asked = [];
  const { calls, handler } = setup(other, "prototype", {
    viewer: async (...args) => {
      asked.push(args);
      return wardView;
    },
  });
  const value = await (await handler(request())).json();
  assert.equal(value.role, "ward");
  assert.deepEqual(value.access, wardView.access);
  assert.equal(value.workingAs, wardView.membershipId);
  assert.deepEqual(calls, [[other, wardView]]);
  assert.deepEqual(asked[0], [other, { bootstrap: false, workingAs: null }]);
  const audit = await handler(request("/audit"));
  assert.equal(audit.status, 403);
  assert.equal(calls.length, 1);
});

test("an account with no role is refused, and one with several must say which", async () => {
  const choices = [
    { workingAs: "bootstrap", ...STATEWIDE_VIEW.access },
    { workingAs: wardView.membershipId, ...wardView.access },
  ];
  const { calls, handler } = setup(other, "prototype", {
    viewer: async (_actor, { workingAs }) =>
      workingAs === null ? { status: "choose", choices } : workingAs === "bootstrap" ? { status: "none" } : wardView,
  });
  const choose = await handler(request());
  assert.equal(choose.status, 409);
  assert.deepEqual((await choose.json()).choices, choices);
  const named = request();
  named.headers.set("x-ward-working-as", wardView.membershipId.toUpperCase());
  assert.equal((await handler(named)).status, 200);
  const none = request();
  none.headers.set("x-ward-working-as", "bootstrap");
  assert.equal((await handler(none)).status, 403);
  const bad = request();
  bad.headers.set("x-ward-working-as", "coordinator");
  assert.equal((await handler(bad)).status, 400);
  assert.deepEqual(calls, [[other, wardView]]);
});

test("cross-origin calls may name the role they work as", async () => {
  const { handler } = setup();
  const preflight = new Request("http://localhost/v1/workspace", {
    method: "OPTIONS",
    headers: { origin: "https://ward-flow-production.up.railway.app" },
  });
  const response = await handler(preflight);
  assert.equal(response.status, 204);
  assert.match(response.headers.get("access-control-allow-headers"), /X-Ward-Working-As/);
});

test("access and break glass routes check their fields and pass the store's answer through", async () => {
  const seen = [];
  const answer =
    (name) =>
    async (...args) => {
      seen.push([name, ...args]);
      return { status: 200, body: { name } };
    };
  const { handler } = setup(coordinator, "prototype", {
    listAccess: answer("list"),
    grantAccess: answer("grant"),
    approveAccess: answer("approve"),
    revokeAccess: answer("revoke"),
    breakGlass: answer("breakGlass"),
  });
  const view = { ...STATEWIDE_VIEW, actorId: coordinator };
  const membershipId = "66666666-6666-4666-8666-666666666666";
  const grant = {
    actorId: other.toUpperCase(),
    role: "ward",
    scope: { kind: "ward", unitIds: ["unit-a"] },
    expiresAt: "2027-01-01T00:00:00.000Z",
  };
  assert.deepEqual(await (await handler(request("/access"))).json(), { name: "list" });
  assert.equal((await handler(request("/access/grant", grant))).status, 200);
  assert.equal((await handler(request("/access/approve", { membershipId }))).status, 200);
  assert.equal((await handler(request("/access/revoke", { membershipId }))).status, 200);
  assert.equal((await handler(request("/break-glass", { patientId: "p-1", reason: "handover" }))).status, 200);
  assert.deepEqual(seen, [
    ["list", view],
    ["grant", view, { actorId: other, role: "ward", scope: grant.scope, expiresAt: new Date(grant.expiresAt) }],
    ["approve", view, membershipId],
    ["revoke", view, membershipId],
    ["breakGlass", view, "p-1", "handover"],
  ]);
  for (const [path, data] of /** @type {Array<[string, unknown]>} */ ([
    ["/access/grant", { ...grant, actorId: "someone" }],
    ["/access/grant", { ...grant, expiresAt: "soon" }],
    ["/access/grant", { ...grant, scope: { kind: "team", teamName: "x".repeat(5000) } }],
    ["/access/approve", { membershipId: "x" }],
    ["/access/revoke", {}],
    ["/break-glass", { patientId: 7, reason: "handover" }],
    ["/break-glass", { patientId: "p".repeat(101), reason: "handover" }],
  ]))
    assert.equal((await handler(request(path, data))).status, 400, path);
  assert.equal((await handler(request("/access/grant"))).status, 405);
  assert.equal(seen.length, 5);
});

test("the powerful steps need a recent sign-in, and say so with their own code", async () => {
  const seen = [];
  const { handler } = setup(coordinator, "prototype", {
    grantAccess: async () => {
      seen.push("grant");
      return { status: 200, body: {} };
    },
    breakGlass: async () => {
      seen.push("breakGlass");
      return { status: 200, body: {} };
    },
    ...Object.fromEntries(
      ["approveAccess", "revokeAccess", "giveCover", "decideRequest"].map((name) => [
        name,
        async () => {
          seen.push(name);
          return { status: 200, body: {} };
        },
      ]),
    ),
    listAccess: async () => ({ status: 200, body: { memberships: [] } }),
  });
  const membershipId = "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d";
  const grant = {
    actorId: other,
    role: "ward",
    scope: { kind: "ward", unitIds: ["unit-a"] },
    expiresAt: "2027-01-01T00:00:00.000Z",
  };
  for (const [path, data] of /** @type {Array<[string, unknown]>} */ ([
    ["/access/grant", grant],
    ["/access/approve", { membershipId }],
    ["/access/revoke", { membershipId }],
    ["/access/cover", { actorId: other, scope: { kind: "ward", unitIds: ["unit-a"] }, minutes: 60 }],
    ["/access/decide", { requestId: membershipId, decision: "approved", expiresAt: "2027-01-01T00:00:00.000Z" }],
    ["/break-glass", { patientId: "p-1", reason: "handover" }],
  ])) {
    const response = await handler(request(path, data, "Bearer stale"));
    assert.equal(response.status, 401, path);
    assert.equal((await response.json()).code, "step-up");
  }
  assert.deepEqual(seen, []);
  // Reading the list is not a powerful step.
  assert.equal((await handler(request("/access", undefined, "Bearer stale"))).status, 200);
  assert.equal((await handler(request("/access/grant", grant))).status, 200);
  assert.deepEqual(seen, ["grant"]);
  // A store that names no window asks every time.
  const strict = setup(coordinator, "prototype", {
    stepUpMinutes: undefined,
    grantAccess: async () => ({ status: 200, body: {} }),
  });
  assert.equal((await strict.handler(request("/access/grant", grant, "Bearer stale"))).status, 401);
});

test("a sign-in older than the session limit is refused on every route, reads included", async () => {
  const { calls, handler } = setup();
  for (const [path, data] of /** @type {Array<[string, unknown]>} */ ([
    ["", undefined],
    ["/commands", body],
  ])) {
    const response = await handler(request(path, data, "Bearer old"));
    assert.equal(response.status, 401, path || "/");
    const body = await response.json();
    assert.equal(body.code, "session-limit");
    assert.match(body.error, /12 hours/);
  }
  assert.deepEqual(calls, []);
  // A later factor does not extend the sign-in, and a token with no sign-in time fails closed.
  for (const token of ["Bearer old-later-factor", "Bearer unknown"]) {
    const response = await handler(request("", undefined, token));
    assert.equal(response.status, 401, token);
    assert.equal((await response.json()).code, "session-limit");
  }
  assert.deepEqual(calls, []);
  // A sign-in just inside the limit still reads the board.
  assert.equal((await handler(request("", undefined, "Bearer stale"))).status, 200);
  // A store that names no limit keeps the old behaviour.
  const open = setup(coordinator, "prototype", { sessionLimitMinutes: undefined });
  assert.equal((await open.handler(request("", undefined, "Bearer old"))).status, 200);
});

test("cover, requests and answers check their fields; asking for access needs no role", async () => {
  const seen = [];
  const answer =
    (name) =>
    async (...args) => {
      seen.push([name, ...args]);
      return { status: 200, body: { name } };
    };
  const { handler } = setup(coordinator, "prototype", {
    giveCover: answer("cover"),
    listCovers: answer("covers"),
    decideRequest: answer("decide"),
    requestAccess: answer("request"),
    ownRequest: answer("own"),
  });
  const view = { ...STATEWIDE_VIEW, actorId: coordinator };
  const scope = { kind: "ward", unitIds: ["unit-a"] };
  const requestId = "77777777-7777-4777-8777-777777777777";
  assert.equal((await handler(request("/access/cover", { actorId: other, scope, minutes: 480 }))).status, 200);
  assert.deepEqual(await (await handler(request("/access/cover"))).json(), { name: "covers" });
  const decided = { requestId, decision: "approved", expiresAt: "2027-01-01T00:00:00.000Z" };
  assert.equal((await handler(request("/access/decide", decided))).status, 200);
  // Declining needs no end date.
  assert.equal((await handler(request("/access/decide", { requestId, decision: "declined" }))).status, 200);
  assert.deepEqual(seen, [
    ["cover", view, { actorId: other, scope, minutes: 480 }],
    ["covers", view],
    ["decide", view, requestId, "approved", new Date(decided.expiresAt)],
    ["decide", view, requestId, "declined", null],
  ]);
  for (const [path, data] of /** @type {Array<[string, unknown]>} */ ([
    ["/access/cover", { actorId: "x", scope, minutes: 480 }],
    ["/access/cover", { actorId: other, scope, minutes: "8h" }],
    ["/access/decide", { ...decided, decision: "maybe" }],
    ["/access/decide", { ...decided, requestId: "x" }],
  ]))
    assert.equal((await handler(request(path, data))).status, 400, path);
  // An account that already holds a role is not the one that asks.
  assert.equal((await handler(request("/access/request", { role: "ward", scope }))).status, 403);
  const choosing = setup(other, "prototype", {
    viewer: async () => ({ status: "choose", choices: [] }),
    requestAccess: answer("request"),
  });
  assert.equal((await choosing.handler(request("/access/request", { role: "ward", scope }))).status, 403);
  // A stale or made-up working-as header reads as no role, but the account still holds roles.
  const stale = setup(other, "prototype", {
    viewer: async (_actor, options) => (options?.workingAs ? { status: "none" } : { status: "choose", choices: [] }),
    requestAccess: answer("request"),
  });
  const staleAsk = request("/access/request", { role: "ward", scope });
  staleAsk.headers.set("x-ward-working-as", "88888888-8888-4888-8888-888888888888");
  assert.equal((await stale.handler(staleAsk)).status, 403);

  // An account with no role may ask for one, and read its own request, but nothing else.
  seen.length = 0;
  const nobody = setup(other, "prototype", {
    viewer: async () => ({ status: "none" }),
    requestAccess: answer("request"),
    ownRequest: answer("own"),
  });
  assert.equal((await nobody.handler(request("/access/request", { role: 7, scope }))).status, 400);
  assert.equal((await nobody.handler(request("/access/request", { role: "ward", scope }))).status, 200);
  assert.deepEqual(await (await nobody.handler(request("/access/request"))).json(), { name: "own" });
  const closed = await nobody.handler(request("/access"));
  assert.equal(closed.status, 403);
  assert.deepEqual(await closed.json(), {
    error: "No Ward Flow role is assigned to this account",
    code: "no-role",
    canRequest: true,
  });
  assert.deepEqual(seen, [
    ["request", other, { role: "ward", scope }],
    ["own", other],
  ]);
  // Before migration 9 the screen says asking is not wired, rather than offering a form that fails.
  const early = setup(other, "prototype", {
    viewer: async () => ({ status: "none" }),
    requestAccess: answer("request"),
    takesRequests: async () => false,
  });
  assert.equal((await (await early.handler(request("/access"))).json()).canRequest, false);
  // A role the server cannot read because it names no health service is refused the same way, under
  // its own code, so the screen can say to have it given again (RA-02).
  for (const requestAccess of [answer("request"), undefined]) {
    const unnamed = setup(other, "prototype", {
      viewer: async () => ({ status: "none", needsService: true }),
      ...(requestAccess ? { requestAccess } : {}),
    });
    for (const path of ["/access", ""]) {
      const refusedUnnamed = await unnamed.handler(request(path));
      assert.equal(refusedUnnamed.status, 403, path);
      assert.deepEqual(await refusedUnnamed.json(), {
        error: "No Ward Flow role is assigned to this account",
        code: "role-needs-service",
        canRequest: !!requestAccess,
      });
    }
  }
});

test("a signed-out sign-in is refused on every route at once; sign-out needs no role", async () => {
  const signedOut = new Set();
  const named = [];
  const { calls, handler } = setup(other, "prototype", {
    sessionSignedOut: async (sessionId) => signedOut.has(sessionId),
    signOutSession: async (actorId, sessionId, startedAt) => {
      named.push([actorId, sessionId, Number.isFinite(startedAt)]);
      signedOut.add(sessionId);
      return true;
    },
  });
  // The fake sign-in has no session id, so the store is asked about `undefined` and says no.
  assert.equal((await handler(request())).status, 403);
  // An account with no role can still end its own sign-in; with no session id nothing is named.
  assert.deepEqual(await (await handler(request("/sign-out", {}))).json(), { signedOut: false });
  assert.equal((await handler(request("/sign-out"))).status, 405);
  assert.deepEqual(named, []);
  signedOut.add(undefined);
  for (const path of ["", "/audit", "/commands", "/record-access", "/access/request"]) {
    const response = await handler(request(path, path === "" || path === "/audit" ? undefined : body));
    assert.equal(response.status, 401, path);
    assert.equal((await response.json()).code, "signed-out");
  }
  // Turning this device's phone alerts off still goes through, as for the session limit.
  assert.notEqual((await handler(request("/push-unsubscribe", { endpoint: "https://push.example/1" }))).status, 401);
  assert.equal(calls.length, 0);
});

test("a database outage while checking a sign-out is a 503, never a pass", async () => {
  const outage = Object.assign(new Error("Connection terminated unexpectedly"), { code: "08006" });
  const { calls, handler } = setup(coordinator, "prototype", {
    sessionSignedOut: async () => {
      throw outage;
    },
  });
  assert.equal((await handler(request())).status, 503);
  assert.equal(calls.length, 0);
});

test("every desk logs the records it opens; the access admin reads the log, a coordinator the log and the openings", async () => {
  const logged = [];
  const store = {
    logView: async (view, patientId, surface) => {
      logged.push([view.access.role, patientId, surface]);
      return { status: 200, body: { logged: true } };
    },
    recordViews: async (_view, patient) => [{ patient_id: patient ?? "PT-1001" }],
    breakGlassOpenings: async (view) => [{ id: "7", scope: view.access.scope.kind }],
  };
  const ward = setup(other, "prototype", { ...store, viewer: async () => wardView });
  const opened = await ward.handler(request("/record-access", { patientId: "PT-1001", surface: "movement" }));
  assert.deepEqual(await opened.json(), { logged: true });
  assert.deepEqual(logged, [["ward", "PT-1001", "movement"]]);
  // The full referral detail is a screen of its own (D-80).
  assert.equal(
    (await ward.handler(request("/record-access", { patientId: "PT-1001", surface: "referral" }))).status,
    200,
  );
  assert.deepEqual(logged.at(-1), ["ward", "PT-1001", "referral"]);
  logged.pop();
  assert.equal((await ward.handler(request("/record-access"))).status, 403);
  for (const bad of [
    { patientId: "Jane Citizen", surface: "patient" },
    { patientId: "PT-1001", surface: "search" },
    { patientId: "PT-1001" },
    { patientId: `PT-${"1".repeat(100)}`, surface: "patient" },
  ])
    assert.equal((await ward.handler(request("/record-access", bad))).status, 400, JSON.stringify(bad));
  assert.equal(logged.length, 1);
  const lead = setup(coordinator, "prototype", store);
  const views = await lead.handler(request("/record-access?patient=PT-2002"));
  assert.deepEqual(await views.json(), { views: [{ patient_id: "PT-2002" }], openings: [] });
  assert.equal((await lead.handler(request("/record-access?patient=not%20an%20id"))).status, 400);
  // The review list reads the openings too (D-80 item 14).
  assert.deepEqual(await (await lead.handler(request("/record-access"))).json(), {
    views: [{ patient_id: "PT-1001" }],
    openings: [{ id: "7", scope: "statewide" }],
  });
  // The access admin reads the log for its Access log in Settings (D-80 item 14), without the
  // openings.
  const admin = setup(other, "prototype", {
    ...store,
    viewer: async () => ({
      ...wardView,
      access: { role: "admin", scope: { kind: "service", service: "North Metro" } },
    }),
  });
  assert.deepEqual(await (await admin.handler(request("/record-access"))).json(), {
    views: [{ patient_id: "PT-1001" }],
  });
  const service = setup(other, "prototype", {
    ...store,
    viewer: async () => ({
      ...wardView,
      access: { role: "coordinator", scope: { kind: "service", service: "North Metro" } },
    }),
  });
  // A service coordinator reads the log and the openings for its review list; the store keeps it
  // to its own service's records (D-80 item 14).
  assert.deepEqual(await (await service.handler(request("/record-access"))).json(), {
    views: [{ patient_id: "PT-1001" }],
    openings: [{ id: "7", scope: "service" }],
  });
});

test("History's archive is read with the desk's own view, and a store without one sends an empty list", async () => {
  const asked = [];
  const records = [{ collection: "movements", body: { id: "WF-007" } }];
  const ward = setup(other, "prototype", {
    viewer: async () => wardView,
    archive: async (view) => {
      asked.push(view.access.role);
      return { archived: 1, records };
    },
  });
  const response = await ward.handler(request("/archive"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { archived: 1, records });
  assert.deepEqual(asked, ["ward"]);
  const older = setup(other, "prototype", { viewer: async () => wardView });
  assert.deepEqual(await (await older.handler(request("/archive"))).json(), { archived: 0, records: [] });
});

test("an older store without session identity omits receipt scope even with finite access expiry", async () => {
  const { handler } = setup(coordinator, "prototype", {
    sessionLimitMinutes: null,
    receipt: async () => null,
    viewer: async () => ({ ...STATEWIDE_VIEW, actorId: coordinator, accessUntil: Date.now() + 60_000 }),
  });
  const response = await handler(request("", undefined, "Bearer unknown"));
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(Number.isFinite(value.accessUntil), true);
  assert.equal(Object.hasOwn(value, "receiptScope"), false);
});

async function workspaceWithSessionIdentity(identity) {
  const handler = createHandler({
    config: { coordinatorIds: [coordinator], workspaceId: "synthetic-workspace" },
    sharedStore: {
      viewer: async () => ({ ...STATEWIDE_VIEW, actorId: coordinator, accessUntil: Date.now() + 60_000 }),
      sessionLimitMinutes: null,
      read: async () => ({ dataMode: "prototype", revision: 1 }),
      receipt: async () => null,
    },
    authenticate: async (_token, { session }) => {
      Object.assign(session, identity);
      return coordinator;
    },
    log: () => {},
  });
  const response = await handler(request());
  assert.equal(response.status, 200);
  return response.json();
}

test("blank session IDs and nonfinite start times cannot enable receipt recovery", async () => {
  for (const identity of [
    { sessionId: "" },
    { sessionId: "   " },
    { sessionId: "", startedAt: Number.NaN },
    { startedAt: Number.POSITIVE_INFINITY },
  ]) {
    const value = await workspaceWithSessionIdentity(identity);
    assert.equal(Object.hasOwn(value, "receiptScope"), false);
  }
});

test("usable session identities preserve the original receipt hash bytes", async () => {
  const sessionId = " 11111111-1111-4111-8111-111111111111 ";
  const cases = [
    { identity: { sessionId, startedAt: 1_700_000_000_000 }, binding: sessionId },
    { identity: { startedAt: 1_700_000_000_000 }, binding: 1_700_000_000_000 },
    { identity: { sessionId: null, startedAt: 0 }, binding: 0 },
  ];
  const scopes = [];
  for (const { identity, binding } of cases) {
    const value = await workspaceWithSessionIdentity(identity);
    const expected = createHash("sha256")
      .update(JSON.stringify(["synthetic-workspace", coordinator, null, binding]))
      .digest("hex");
    assert.equal(value.receiptScope, expected);
    scopes.push(value.receiptScope);
  }
  assert.equal(new Set(scopes).size, cases.length);
});

test("an adapter without receipts does not advertise recovery", async () => {
  const { handler } = setup(coordinator, "prototype", { sessionLimitMinutes: null });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(Object.hasOwn(await response.json(), "receiptScope"), false);
});

test("an unsupported receipt lookup returns not found rather than an internal error", async () => {
  const { handler } = setup(coordinator, "prototype", { sessionLimitMinutes: null });
  const receipt = await handler(request(`/receipt?commandId=${commandId}`));
  assert.equal(receipt.status, 404);
});

test("the server logs each full read of a desk's list or TV board, and the TV's unchanged polls (H-0731)", async () => {
  const logged = [];
  let changed = false;
  const { calls, handler } = setup(coordinator, "prototype", {
    logList: async (view, surface) => {
      logged.push([view.actorId, surface]);
      return true;
    },
    poll: async () =>
      changed
        ? { snapshot: { revision: 8, dataMode: "prototype" } }
        : { notModified: true, dataMode: "prototype", revision: 7, now: 900 },
  });
  assert.equal((await handler(request())).status, 200);
  assert.equal((await handler(request("?since=7"))).status, 200);
  changed = true;
  assert.equal((await handler(request("?since=7"))).status, 200);
  const tv = request();
  tv.headers.set("x-ward-screen", "tv");
  assert.equal((await handler(tv)).status, 200);
  // Any other screen name reads as the list.
  const odd = request();
  odd.headers.set("x-ward-screen", "patient");
  assert.equal((await handler(odd)).status, 200);
  // A desk that moves to the TV board polls unchanged records, and the TV still logs them.
  changed = false;
  const tvPoll = request("?since=7");
  tvPoll.headers.set("x-ward-screen", "tv");
  assert.equal((await handler(tvPoll)).status, 200);
  assert.deepEqual(logged, [
    [coordinator, "list"],
    [coordinator, "list"],
    [coordinator, "tv"],
    [coordinator, "list"],
    [coordinator, "tv"],
  ]);
  assert.equal(calls.length, 3);
  // A log that cannot be written fails the read, so nothing goes out unlogged.
  const { handler: failing } = setup(coordinator, "prototype", {
    logList: async () => {
      throw new Error("Connection terminated unexpectedly");
    },
  });
  assert.equal((await failing(request())).status, 503);
});

test("a bootstrap coordinator past its end date has no role (H-0057)", async () => {
  const handler = createHandler({
    config: {
      coordinatorIds: [coordinator],
      coordinatorUntil: Date.now() - 1,
      origin: "https://ward-flow-production.up.railway.app",
    },
    sharedStore: {
      viewer: async (actorId, { bootstrap }) =>
        bootstrap ? bootstrapViewer(actorId, { bootstrap }) : { status: "none" },
      read: async () => ({ revision: 1, dataMode: "prototype" }),
      sessionLimitMinutes: 720,
    },
    authenticate: async (_token, /** @type {{ session?: any }} */ { session } = {}) => {
      if (session) session.signedInAt = session.startedAt = Date.now();
      return coordinator;
    },
    log: () => {},
  });
  assert.equal((await handler(request())).status, 403);
});

test("a save past the workspace size limit is refused as full, never as a server fault (H-0291)", async () => {
  const { handler, logs } = setup(coordinator, "prototype", {
    command: async () => {
      throw new Error("Workspace too large");
    },
  });
  const response = await handler(request("/commands", body));
  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, "workspace-full");
  assert.equal(logs.at(-1).outcome, "workspace_full");
});

test("turning phone alerts off never counts as working the role (fresh audit X-2)", async () => {
  const seen = [];
  const { handler } = setup(coordinator, "prototype", {
    viewer: async (actorId, options) => {
      seen.push(options.touch);
      return bootstrapViewer(actorId, options);
    },
  });
  await handler(request("/push-unsubscribe", { endpoint: "https://push.example/1" }));
  await handler(request());
  assert.deepEqual(seen, [false, undefined]);
});
