// @ts-check
// Master audit M58 (10 Nov 2026): break glass needs a reason from the list. The store refuses any
// other reason before it opens a transaction, so the pool below is never used. Offline, synthetic.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceStore } from "./postgres.mjs";

test("break glass without a listed reason is refused before the database is touched", async () => {
  const engine = await import("./dist/engine.mjs");
  const unused = () => Promise.reject(new Error("no database in this test"));
  const store = createWorkspaceStore(/** @type {any} */ ({ connect: unused, query: unused }), {
    workspaceId: "00000000-0000-4000-8000-000000000058",
    engine,
  });
  const view = {
    actorId: "00000000-0000-4000-8000-000000000001",
    access: { role: "ward", scope: { kind: "ward", unitIds: ["fre-adult-open"] } },
    membershipId: "00000000-0000-4000-8000-000000000002",
    grants: [],
  };
  for (const reason of [undefined, "", "because", "Other", 42]) {
    const answer = await store.breakGlass(view, "PT-SYN-1", reason);
    assert.equal(answer.status, 400, String(reason));
  }
  assert.ok(engine.BREAK_GLASS_REASON_IDS.length > 1);
});

// M58 fixed (D-125, 10 Nov 2026): cover asks why too, from its own short list, and the store refuses
// any other reason before it opens a transaction, as break glass does.
test("cover without a listed reason is refused before the database is touched", async () => {
  const engine = await import("./dist/engine.mjs");
  const unused = () => Promise.reject(new Error("no database in this test"));
  const store = createWorkspaceStore(/** @type {any} */ ({ connect: unused, query: unused }), {
    workspaceId: "00000000-0000-4000-8000-000000000058",
    engine,
  });
  const view = {
    actorId: "00000000-0000-4000-8000-000000000001",
    access: { role: "ward", scope: { kind: "ward", unitIds: ["fre-adult-open"] } },
    membershipId: "00000000-0000-4000-8000-000000000002",
    grants: [],
    version: 99,
  };
  const request = {
    actorId: "00000000-0000-4000-8000-000000000003",
    scope: { kind: "ward", unitIds: ["fre-adult-open"] },
    minutes: 60,
  };
  for (const reason of [undefined, "", "because", "Other", "bed-search", 42]) {
    const answer = await store.giveCover(view, { ...request, reason });
    assert.equal(answer.status, 400, String(reason));
  }
  assert.ok(engine.COVER_REASON_IDS.length > 1);
  assert.ok(!engine.COVER_REASON_IDS.includes(""));
});

test("each cover given is listed for the coordinator with its giver, its place and its reason", async () => {
  const engine = await import("./dist/engine.mjs");
  const now = new Date("2026-11-10T02:00:00Z");
  const given = new Date(now.getTime() - 30 * 60_000);
  const until = new Date(given.getTime() + 8 * 3_600_000);
  const queries = [];
  const pool = {
    connect: () => Promise.reject(new Error("no transaction in this test")),
    query: async (sql, params) => {
      queries.push({ sql, params });
      return {
        rows: [
          {
            id: "58",
            actor_role: "ward",
            actor_scope: { kind: "ward", unitIds: ["fre-adult-open"] },
            committed_at: given,
            changes: {
              role: "ward",
              scope: { kind: "ward", unitIds: ["fre-adult-open"] },
              expiresAt: until.toISOString(),
              reason: "staff-away",
            },
          },
        ],
      };
    },
  };
  const store = createWorkspaceStore(/** @type {any} */ (pool), {
    workspaceId: "00000000-0000-4000-8000-000000000058",
    engine,
    clock: () => now,
  });
  const rows = await store.coversGiven({
    actorId: "00000000-0000-4000-8000-000000000001",
    access: { role: "coordinator", scope: { kind: "statewide" } },
    membershipId: null,
    grants: [],
    version: 99,
  });
  assert.deepEqual(rows, [
    {
      id: "58",
      actor_role: "ward",
      actor_scope: { kind: "ward", unitIds: ["fre-adult-open"] },
      role: "ward",
      scope: { kind: "ward", unitIds: ["fre-adult-open"] },
      reason: "staff-away",
      minutes: { given: -30, until: 450 },
    },
  ]);
  assert.match(queries[0].sql, /action='ACCESS_COVER'/);
});
