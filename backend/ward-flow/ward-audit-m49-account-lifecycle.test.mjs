// @ts-check
// Master audit M49 (10 Nov 2026): the account lifecycle through the shared HTTP layer, offline with a
// fake store. A new account, its first role, a role change, leaving and disabling never grant access
// the account's current record does not hold, and never shut out a desk that holds one. Synthetic
// ids only. Password reset is the browser's (tests/ward-supabase-auth.test.ts) and the second step is
// second-step.test.mjs; the real-database grant and revoke paths are in postgres.test.mjs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandler } from "./server.mjs";

const lead = "22222222-2222-4222-8222-222222222222";
const person = "55555555-5555-4555-8555-555555555555";
const ward = { role: "ward", scope: { kind: "ward", unitIds: ["fre-adult-open"] } };
const view = (access) => ({
  status: "ok",
  version: 9,
  membershipId: "66666666-6666-4666-8666-666666666666",
  access,
  grants: [],
  recentGrant: false,
});

/** A handler whose store answers `viewer()` from `holds`, which a test changes between requests. */
function setup() {
  const holds = { current: /** @type {any} */ ({ status: "none" }) };
  const reached = [];
  const store = {
    viewer: async (actorId, { bootstrap = false } = {}) =>
      bootstrap
        ? { ...view({ role: "coordinator", scope: { kind: "statewide" } }), membershipId: null }
        : holds.current,
    read: async (_actor, seen) => {
      reached.push(["read", seen.access]);
      return { revision: 1, dataMode: "prototype" };
    },
    command: async (_actor, _id, _revision, _event, options) => {
      reached.push(["command", options?.view?.access]);
      return { status: 409, body: { outcome: "stale" } };
    },
    grantAccess: async () => {
      reached.push(["grant"]);
      return { status: 200, body: {} };
    },
    requestAccess: async (_actor, asked) => {
      reached.push(["request", asked.role]);
      return { status: 200, body: { request: { id: "1" } } };
    },
    ownRequest: async () => ({ status: 200, body: { request: null } }),
    stepUpMinutes: 10,
    sessionLimitMinutes: 720,
  };
  const handler = createHandler({
    config: { coordinatorIds: [lead], origin: "https://ward-flow-production.up.railway.app" },
    sharedStore: store,
    /** @param {string} token @param {{ session?: { signedInAt?: number, startedAt?: number } }} [context] */
    authenticate: async (token, { session } = {}) => {
      if (!token) throw new Error("Unauthorized");
      if (session) session.signedInAt = session.startedAt = Date.now();
      return token === "Bearer lead" ? lead : person;
    },
    log: () => {},
  });
  const call = (path = "", data, token = "Bearer person") =>
    handler(
      new Request(`http://localhost/v1/workspace${path}`, {
        method: data ? "POST" : "GET",
        headers: { authorization: token, "content-type": "application/json" },
        ...(data ? { body: JSON.stringify(data) } : {}),
      }),
    );
  return { holds, reached, call };
}
const command = {
  classification: "synthetic",
  commandId: "44444444-4444-4444-8444-444444444444",
  expectedRevision: 1,
  event: { type: "REQUEST_CAPACITY_REFRESH", role: "ward", unitId: "fre-adult-open", actingUnitId: "fre-adult-open" },
};
const grant = { actorId: lead, role: "ward", scope: ward.scope, expiresInMinutes: 60 };

test("a new account (signed up or invited) with no role reads and changes nothing, and may only ask for one", async () => {
  const { reached, call } = setup();
  for (const [path, data] of /** @type {Array<[string, unknown]>} */ ([
    ["", undefined],
    ["/commands", command],
    ["/access/grant", grant],
    ["/break-glass", { patientId: "PT-SYN-1", reason: "handover" }],
  ])) {
    const response = await call(path, data);
    assert.equal(response.status, 403, path || "/");
  }
  assert.deepEqual(reached, [], "no store read or change for an account with no role");
  const asked = await call("/access/request", { role: "ward", scope: ward.scope });
  assert.equal(asked.status, 200);
  assert.deepEqual(reached, [["request", "ward"]]);
});

test("its first role works on the next request, with no new sign-in, and only as that role", async () => {
  const { holds, reached, call } = setup();
  assert.equal((await call()).status, 403);
  holds.current = view(ward);
  const response = await call();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.role, "ward");
  assert.deepEqual(body.access, ward);
  assert.deepEqual(reached, [["read", ward]]);
  // Holding a role, it may no longer file a request for itself: a second role comes from an admin.
  assert.equal((await call("/access/request", { role: "coordinator", scope: { kind: "statewide" } })).status, 403);
});

test("a role change is read on the very next request, so a narrowed desk loses the wider one at once", async () => {
  const { holds, reached, call } = setup();
  holds.current = view({ role: "coordinator", scope: { kind: "service", service: "East Metro" } });
  await call("/commands", command);
  holds.current = view(ward);
  await call("/commands", command);
  assert.deepEqual(
    reached.map(([, access]) => access?.role),
    ["coordinator", "ward"],
  );
});

test("leaving or being disabled (every role ended) refuses the next request, but sign-out still answers", async () => {
  const { holds, reached, call } = setup();
  holds.current = view(ward);
  assert.equal((await call()).status, 200);
  holds.current = { status: "none" };
  for (const [path, data] of /** @type {Array<[string, unknown]>} */ ([
    ["", undefined],
    ["/commands", command],
  ]))
    assert.equal((await call(path, data)).status, 403, path || "/");
  assert.equal(reached.length, 1, "only the read made while the role was held reached the store");
  const out = await call("/sign-out", {});
  assert.equal(out.status, 200);
});

test("a bootstrap coordinator is never locked out by an empty membership table", async () => {
  const { reached, call } = setup();
  const response = await call("", undefined, "Bearer lead");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).role, "coordinator");
  assert.equal(reached.length, 1);
});
