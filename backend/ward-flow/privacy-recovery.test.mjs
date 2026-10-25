// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceStore } from "./postgres.mjs";
import { LATEST_MIGRATION } from "./migrations.mjs";

test("scoped audit assembles migration-10 record rows before testing place membership", async () => {
  const payload = { version: 1, state: { units: { $records: "item" } } };
  const own = { id: "synthetic-unit", service: "Own" };
  let assembled = false;
  const pool = {
    query: async (sql) => {
      if (sql.includes("max(version)")) return { rows: [{ version: LATEST_MIGRATION }] };
      if (sql.includes("FROM ward_flow.workspaces"))
        return {
          rows: [
            {
              payload,
              ...(sql.includes("jsonb_agg")
                ? {
                    cache_revision: 1,
                    cache_updated_at: new Date("2026-10-26T00:00:00.000Z"),
                    records: [
                      {
                        collection: "units",
                        record_id: own.id,
                        kind: "item",
                        ordinal: 0,
                        revision: 1,
                        fresh: true,
                        body: own,
                      },
                    ],
                  }
                : {}),
            },
          ],
        };
      return {
        rows: [
          { sequence: "9007199254740999", changes: { role: "admin", scope: { kind: "service", service: "Own" } } },
        ],
      };
    },
  };
  const engine = {
    validWorld: (world) => Array.isArray(world.state.units),
    wholeNetwork: () => false,
    parseAccess: (role, scope) => ({ role, scope }),
    scopeWithin: (world, scope, parent) => {
      // Cached record reads return copies; require the exact assembled list and body values.
      assert.deepEqual(world.state.units, [own]);
      assembled = true;
      return assembled && scope.service === parent.service;
    },
  };
  const store = createWorkspaceStore(pool, { workspaceId: "synthetic", engine });
  const result = await store.audit({
    version: LATEST_MIGRATION,
    access: { role: "admin", scope: { kind: "service", service: "Own" } },
  });
  assert.equal(assembled, true);
  assert.deepEqual(
    result.map((row) => row.sequence),
    ["9007199254740999"],
  );
});

test("scoped audit finds its retained event after more than 200 unrelated access changes", async () => {
  const events = Array.from({ length: 205 }, (_, i) => ({
    sequence: 300 - i,
    changes: { role: "admin", scope: { kind: "service", service: "Other" } },
  }));
  events.push({ sequence: 1, changes: { role: "admin", scope: { kind: "service", service: "Own" } } });
  const pool = {
    query: async (sql, values) => {
      if (sql.includes("SELECT payload")) return { rows: [{ payload: {} }] };
      const before = values?.[1];
      return { rows: events.filter((row) => before == null || row.sequence < before).slice(0, 200) };
    },
  };
  const engine = {
    validWorld: () => true,
    wholeNetwork: () => false,
    parseAccess: (role, scope) => ({ role, scope }),
    scopeWithin: (_payload, scope, parent) => scope.service === parent.service,
  };
  const store = createWorkspaceStore(pool, { workspaceId: "synthetic", engine });
  const result = await store.audit({
    version: 9,
    access: { role: "admin", scope: { kind: "service", service: "Own" } },
  });
  assert.deepEqual(
    result.map((row) => row.sequence),
    [1],
  );
});
import { createSharedHandler } from "./shared-http.mjs";

const actor = "11111111-1111-4111-8111-111111111111";
const command = "22222222-2222-4222-8222-222222222222";
const httpRequest = (path) =>
  new Request(`https://example.test/v1/workspace${path}`, { headers: { authorization: "Bearer synthetic" } });
function handler(store, authenticated = actor) {
  return createSharedHandler({
    config: { coordinatorIds: [actor], workspaceId: "synthetic-workspace" },
    store: {
      sessionLimitMinutes: 720,
      viewer: async () => ({
        status: "ok",
        actorId: authenticated,
        membershipId: null,
        access: { role: "coordinator", scope: { kind: "statewide" } },
        grants: [],
      }),
      ...store,
    },
    authenticate: async (_token, context) => {
      context.session.startedAt = Date.now() - 60000;
      return authenticated;
    },
    readBody: async (request) => request.json(),
    verifierUnavailable: () => false,
    log: () => {},
  });
}
test("receipt retrieval minimises result and binds SQL to workspace, authenticated actor and command", async () => {
  const calls = [];
  const pool = {
    query: async (sql, args) => {
      calls.push([sql, args]);
      return {
        rows: [{ status: 200, result: { outcome: "accepted", commandRevision: 2, error: "synthetic private detail" } }],
      };
    },
  };
  const store = createWorkspaceStore(pool, { workspaceId: "synthetic-workspace", engine: {} });
  const response = await handler({ receipt: store.receipt })(httpRequest(`/receipt?commandId=${command}`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { receipt: { outcome: "accepted", commandRevision: 2 } });
  assert.deepEqual(calls[0][1], ["synthetic-workspace", actor, command]);
});
test("audit reports an explicit continuation cursor at its scoped cap and accepts that cursor", async () => {
  const calls = [];
  const response = await handler({
    audit: async (...args) => {
      calls.push(args);
      return Array.from({ length: 200 }, (_, i) => ({ sequence: String(300 - i) }));
    },
  })(httpRequest("/audit?before=9007199254740999"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.complete, false);
  assert.equal(body.nextCursor, "101");
  assert.equal(calls[0][1], "9007199254740999");
});
test("outage authorisation ends no later than session, membership, cover or temporary opening", async () => {
  const until = Date.now() + 5000;
  const response = await handler({
    viewer: async () => ({
      status: "ok",
      membershipId: "synthetic-role",
      access: { role: "ward", scope: { kind: "ward", unitIds: ["synthetic-ward"] } },
      accessUntil: until + 5000,
      grants: [{ until: new Date(until) }],
    }),
    read: async () => ({ dataMode: "prototype" }),
  })(httpRequest(""));
  const body = await response.json();
  assert.equal(body.accessUntil, until);
  assert.match(body.receiptScope, /^[0-9a-f]{64}$/);
});
