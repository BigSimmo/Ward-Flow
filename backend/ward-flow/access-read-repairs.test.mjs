// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceStore } from "./postgres.mjs";
import * as engine from "./dist/engine.mjs";

// SQL scheduling double: real store/resolver/projector, no claim of PostgreSQL locking proof.
function fixture(role = "coordinator", count = 1) {
  let now = new Date("2026-11-04T12:00:00Z");
  const world = engine.seedWorld(now);
  let active = true;
  let gate = null;
  const statements = [];
  const membership = (i) => ({
    id: `desk-${i}`,
    role,
    scope: { kind: "statewide" },
    kind: "role",
    last_used_at: now,
    granted_at: now,
    expires_at: new Date(now.getTime() + 3600000),
  });
  const rows = Array.from({ length: count }, (_, i) => membership(i));
  async function query(sql) {
    statements.push(sql);
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
    if (sql.includes("FROM ward_flow.workspaces")) {
      if (sql.includes("FOR SHARE") && gate) await gate();
      return { rows: [{ data_mode: "prototype", revision: 1, payload: world, cache_updated_at: now }] };
    }
    if (sql.includes("max(version)")) return { rows: [{ version: 9 }] };
    if (sql.includes("FROM ward_flow.memberships") && sql.includes("actor_id=$2")) {
      // Honour a LIMIT if introduced before membership selection again.
      const limit = /LIMIT (\d+)/.exec(sql);
      return { rows: active ? rows.slice(0, limit ? Number(limit[1]) : undefined) : [] };
    }
    if (sql.includes("FROM ward_flow.memberships")) return { rows: [] };
    if (
      sql.includes("FROM ward_flow.break_glass") ||
      sql.includes("FROM ward_flow.record_access") ||
      sql.includes("FROM ward_flow.audit") ||
      sql.includes("FROM ward_flow.access_requests") ||
      sql.includes("FROM ward_flow.forecast_")
    )
      return { rows: [] };
    assert.fail(`Unexpected SQL ${sql.slice(0, 100)}`);
  }
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const store = createWorkspaceStore(pool, { workspaceId: "synthetic-access-workspace", engine, clock: () => now });
  const view = () => ({
    status: "ok",
    actorId: "synthetic-actor",
    membershipId: "desk-0",
    version: 16,
    access: engine.parseAccess(role, { kind: "statewide" }),
    grants: [],
  });
  return {
    store,
    view,
    statements,
    rows,
    revoke: () => {
      active = false;
    },
    expire: () => {
      active = false;
      now = new Date(now.getTime() + 7200000);
    },
    pause: (fn) => {
      gate = fn;
    },
  };
}

for (const method of [
  "auditPage",
  "deskAuditPage",
  "recordViews",
  "breakGlassOpenings",
  "listAccess",
  "listCovers",
  "forecastHistory",
]) {
  for (const ended of ["revoke", "expire"])
    test(`${method}: ${ended} while waiting for authority boundary refuses`, async () => {
      const f = fixture(method === "listAccess" ? "admin" : "coordinator");
      f.pause(async () => {
        f[ended]();
      });
      await assert.rejects(f.store[method](f.view()), /role-ended/);
      assert.equal(
        f.statements.some((sql) => /FROM ward_flow\.(audit|record_access|forecast_|access_requests)/.test(sql)),
        false,
        "no protected read after withdrawn authority",
      );
      assert.ok(f.statements.includes("ROLLBACK"));
    });
  test(`${method}: valid authority reads through the locked connection`, async () => {
    const f = fixture(method === "listAccess" ? "admin" : "coordinator");
    const result = await f.store[method](f.view());
    assert.ok(result);
    assert.ok(f.statements.some((sql) => sql.includes("FOR SHARE")));
    assert.ok(f.statements.includes("COMMIT"));
  });
}

test("21st active membership is selectable and listed", async () => {
  const f = fixture("coordinator", 21);
  const selected = await f.store.viewer("synthetic-actor", { workingAs: "desk-20" });
  assert.equal(selected.status, "ok");
  assert.equal(selected.membershipId, "desk-20");
  const choices = await f.store.viewer("synthetic-actor");
  assert.equal(choices.status, "choose");
  assert.equal(choices.choices?.length, 21);
});

test("21st cover contributes to the legitimate ward membership", async () => {
  const f = fixture("ward", 21);
  for (const [i, row] of f.rows.entries()) {
    row.scope = { kind: "ward", unitIds: [i === 20 ? "fsh-adult-open" : "rph-adult-secure"] };
    if (i === 20) row.kind = "cover";
  }
  const selected = await f.store.viewer("synthetic-actor", { workingAs: "desk-0" });
  assert.equal(selected.status, "ok");
  assert.ok(selected.access.scope.unitIds.includes("fsh-adult-open"));
  assert.ok(selected.access.scope.unitIds.includes("rph-adult-secure"));
});
