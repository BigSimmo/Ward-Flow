// @ts-check
// P056: a ward desk's Activity reads the server audit for its own place only (desk-audit.mjs).
import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceStore } from "./postgres.mjs";
import { createSharedHandler } from "./shared-http.mjs";
import { LATEST_MIGRATION } from "./migrations.mjs";

const actor = "11111111-1111-4111-8111-111111111111";
const own = { kind: "ward", unitIds: ["own-ward"] };
const other = { kind: "ward", unitIds: ["other-ward"] };
const rows = [
  {
    sequence: "9",
    actor_role: "ward",
    actor_scope: own,
    action: "CLOSE_UNIT",
    outcome: "accepted",
    committed_at: "2026-10-27T12:00:00.000Z",
    changes: { patients: [{ umrn: "SYN0001" }] },
    actor_id: actor,
  },
  {
    sequence: "8",
    actor_role: "ward",
    actor_scope: other,
    action: "CLOSE_UNIT",
    outcome: "accepted",
    committed_at: "2026-10-27T11:00:00.000Z",
    changes: {},
  },
  {
    sequence: "7",
    actor_role: "ward",
    actor_scope: own,
    action: "BREAK_GLASS_OPEN",
    outcome: "accepted",
    committed_at: "2026-10-27T10:00:00.000Z",
    changes: {},
  },
  {
    sequence: "6",
    actor_role: "ward",
    actor_scope: { kind: "broken" },
    action: "CONFIRM_CAPACITY",
    outcome: "accepted",
    committed_at: "2026-10-27T09:00:00.000Z",
    changes: {},
  },
  {
    sequence: "5",
    actor_role: "ward",
    actor_scope: own,
    action: "CONFIRM_CAPACITY",
    outcome: "rejected",
    committed_at: "2026-10-27T08:00:00.000Z",
    changes: {},
  },
];
function fixture(world = { valid: true }) {
  const sql = [];
  const pool = {
    query: async (text, values) => {
      sql.push(text);
      if (text.includes("FROM ward_flow.workspaces")) return { rows: [{ payload: world }] };
      const before = values?.[1];
      // The SQL leaves out role changes and rows without a sender place; mirror it here.
      return {
        rows: rows.filter(
          (row) =>
            row.actor_scope &&
            !row.action.startsWith("ACCESS_") &&
            (before == null || BigInt(row.sequence) < BigInt(before)),
        ),
      };
    },
  };
  const engine = {
    validWorld: (payload) => payload?.valid === true,
    wholeNetwork: (access) => access.role === "coordinator" && access.scope.kind === "statewide",
    parseAccess: (role, scope) => (scope && Array.isArray(scope.unitIds) ? { role, scope } : null),
    scopeWithin: (_world, inner, outer) => inner.unitIds.every((id) => outer.unitIds.includes(id)),
  };
  return { store: createWorkspaceStore(pool, { workspaceId: "synthetic", engine }), sql };
}
/** Only the audit reads: the rest of the store would ask the fake pool for sessions. */
const pick = (store) => ({
  ...(store.auditPage ? { auditPage: store.auditPage } : {}),
  ...(store.deskAuditPage ? { deskAuditPage: store.deskAuditPage } : {}),
});
function endpoint(store, access) {
  return createSharedHandler({
    config: { coordinatorIds: [], workspaceId: "synthetic" },
    store: {
      sessionLimitMinutes: 720,
      viewer: async () => ({
        status: "ok",
        actorId: actor,
        membershipId: "synthetic-role",
        version: LATEST_MIGRATION,
        access,
        grants: [],
      }),
      ...pick(store),
    },
    authenticate: async (_token, context) => {
      context.session.startedAt = Date.now() - 60000;
      return actor;
    },
    readBody: async (request) => request.json(),
    verifierUnavailable: () => false,
    log: () => {},
  });
}
const get = (path = "/audit") =>
  new Request(`https://example.test/v1/workspace${path}`, { headers: { authorization: "Bearer synthetic" } });

test("a ward desk reads the kind and time of changes made inside its own place", async () => {
  const { store } = fixture();
  const response = await endpoint(store, { role: "ward", scope: own })(get());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    events: [
      { sequence: "9", action: "CLOSE_UNIT", outcome: "accepted", committed_at: "2026-10-27T12:00:00.000Z" },
      { sequence: "5", action: "CONFIRM_CAPACITY", outcome: "rejected", committed_at: "2026-10-27T08:00:00.000Z" },
    ],
    complete: true,
    nextCursor: null,
  });
  // No change facts, patient numbers, sender or sender place reach the desk.
  const text = JSON.stringify(body);
  for (const leaked of ["SYN0001", "changes", "actor_id", "actor_scope", "own-ward"])
    assert.equal(text.includes(leaked), false, leaked);
});

test("a ward desk cannot read changes made outside its place, break glass or unreadable senders", async () => {
  const { store } = fixture();
  const body = await (await endpoint(store, { role: "ward", scope: other })(get())).json();
  assert.deepEqual(
    body.events.map((row) => row.sequence),
    ["8"],
  );
});

test("a desk reads nothing when the world cannot be read to test its place", async () => {
  const { store } = fixture({ valid: false });
  const body = await (await endpoint(store, { role: "ward", scope: own })(get())).json();
  assert.deepEqual(body, { events: [], complete: true, nextCursor: null });
});

test("the executive, other statewide desks and stores without a scoped read are still refused", async () => {
  const { store } = fixture();
  for (const access of [
    { role: "executive", scope: { kind: "statewide" } },
    { role: "ward", scope: { kind: "statewide" } },
  ]) {
    const response = await endpoint(store, access)(get());
    assert.equal(response.status, 403, access.role);
    assert.deepEqual(await response.json(), { error: "The audit record is not part of your role" });
  }
  const response = await endpoint({ auditPage: store.auditPage }, { role: "ward", scope: own })(get());
  assert.equal(response.status, 403);
});

test("a desk's audit read keeps the cursor rules and leaves out role changes in SQL", async () => {
  const { store, sql } = fixture();
  assert.equal((await endpoint(store, { role: "ward", scope: own })(get("/audit?before=0"))).status, 400);
  const body = await (await endpoint(store, { role: "ward", scope: own })(get("/audit?before=9"))).json();
  assert.deepEqual(
    body.events.map((row) => row.sequence),
    ["5"],
  );
  const auditSql = sql.find((text) => text.includes("FROM ward_flow.audit"));
  assert.ok(auditSql.includes("NOT LIKE 'ACCESS\\_%'"));
  assert.ok(auditSql.includes("actor_scope IS NOT NULL"));
  assert.equal(auditSql.includes("changes"), false);
});

// Codex P1 on #1039: the real engine's role-grant rule (`scopeWithin`) only lets a statewide or
// service place contain anything, so ward, ED and site desks read nothing. These use the real engine.
test("ward, ED and site desks read only changes made inside their place, with the real engine", async () => {
  const engine = await import("./dist/engine.mjs");
  const { deskAuditPage } = await import("./desk-audit.mjs");
  const world = engine.seedWorld(new Date("2026-10-27T04:00:00Z"));
  const places = engine.accessPlaces(world);
  const edSite = places.edSiteCode("jhc-ed");
  assert.ok(edSite);
  const senders = {
    rph: { kind: "ward", unitIds: ["rph-adult-secure"] },
    rphOlder: { kind: "ward", unitIds: ["rph-older-adult"] },
    scgh: { kind: "ward", unitIds: ["scgh-adult-open"] },
    both: { kind: "ward", unitIds: ["rph-adult-secure", "scgh-adult-open"] },
    ed: { kind: "ed", edId: "jhc-ed" },
    rphSite: { kind: "site", siteCode: "RPH" },
    edSiteDesk: { kind: "site", siteCode: edSite },
    service: { kind: "service", service: places.unitService("rph-adult-secure") },
    statewide: { kind: "statewide" },
  };
  const auditRows = Object.entries(senders).map(([name, scope], index) => ({
    sequence: String(100 - index),
    actor_role:
      scope.kind === "statewide"
        ? "coordinator"
        : scope.kind === "ed"
          ? "ed"
          : scope.kind === "site"
            ? "bed_manager"
            : "ward",
    actor_scope: scope,
    action: `CLOSE_UNIT`,
    outcome: "accepted",
    committed_at: "2026-10-27T12:00:00.000Z",
    name,
  }));
  const pool = { query: async () => ({ rows: auditRows }) };
  const read = async (scope) => {
    const page = await deskAuditPage({
      pool,
      workspaceId: "synthetic",
      engine,
      readPayload: async () => world,
      view: { version: LATEST_MIGRATION, access: { role: "ward", scope } },
      minimumVersion: 1,
    });
    return page.events.map((event) => auditRows.find((row) => row.sequence === event.sequence).name);
  };
  assert.deepEqual(await read(senders.rph), ["rph"]);
  assert.deepEqual(await read(senders.both), ["rph", "scgh", "both"]);
  assert.deepEqual(await read(senders.ed), ["ed"]);
  assert.deepEqual(
    await read(senders.rphSite),
    ["rph", "rphOlder", "rphSite"].concat(edSite === "RPH" ? ["ed", "edSiteDesk"] : []),
  );
  // Access scoping never widens: no desk below a service reads a service or statewide sender.
  for (const scope of [senders.rph, senders.ed, senders.rphSite, senders.edSiteDesk])
    for (const wider of ["service", "statewide"]) assert.equal((await read(scope)).includes(wider), false, wider);
  assert.equal((await read(senders.scgh)).includes("rph"), false);
});
