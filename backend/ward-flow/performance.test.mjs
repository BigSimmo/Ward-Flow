// @ts-check
// Performance and scale audit fixes (26 Oct 2026: PS-02, PS-05, PS-11, PS-12, PS-15, H-0642).
// An in-memory stand-in for the database, so these run without PostgreSQL. Synthetic data only.
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import * as engine from "./dist/engine.mjs";
import { LATEST_MIGRATION } from "./migrations.mjs";
import { createWorkspaceStore, storedAuditChanges } from "./postgres.mjs";
import { planSave } from "./records.mjs";
import { withoutRecordDetail } from "./record-detail.mjs";
import { LruCache, gzipSegments, jsonResponse, registerPart, replySegments, segmentBytes } from "./reply-cache.mjs";
import { listen, processCacheNotice } from "./server.mjs";

const start = new Date("2026-10-25T04:00:00Z");
const actorId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const refresh = (unitId) => ({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId });

/** A workspace held in memory, answering the statements the store sends. */
function memoryDatabase(world) {
  const plan = planSave([], world, 1);
  const db = {
    revision: 1,
    updatedAt: new Date(start),
    core: plan.core,
    records: new Map(
      plan.upserts.map((part) => [
        `${part.collection}\0${part.recordId}`,
        {
          collection: part.collection,
          record_id: part.recordId,
          kind: part.kind,
          ordinal: part.ordinal,
          revision: String(part.revision),
          body: part.body,
        },
      ]),
    ),
    archived: /** @type {Array<{ generation: number, key: string }>} */ ([]),
    audits: /** @type {any[]} */ ([]),
    counts: 0,
  };
  const recordRows = (since) =>
    [...db.records.values()].map((row) => ({
      ...row,
      fresh: Number(row.revision) > since,
      body: Number(row.revision) > since ? structuredClone(row.body) : null,
    }));
  async function query(sql, params = []) {
    if (/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|ROLLBACK TO)/.test(sql)) return { rows: [], rowCount: 0 };
    if (/max\(version\)/.test(sql)) return { rows: [{ version: LATEST_MIGRATION }] };
    if (/count\(\*\)::integer AS archived FROM ward_flow\.archived_records/.test(sql)) {
      db.counts += 1;
      return { rows: [{ archived: db.archived.filter((row) => row.generation === params[1]).length }] };
    }
    if (/^INSERT INTO ward_flow\.archived_records/.test(sql)) {
      let added = 0;
      for (const row of JSON.parse(params[4])) {
        const key = `${params[1]}\0${row.collection}\0${row.record_id}`;
        if (db.archived.some((entry) => entry.key === key)) continue;
        db.archived.push({ generation: params[1], key });
        added += 1;
      }
      return { rows: [], rowCount: added };
    }
    if (/FROM ward_flow\.workspaces w WHERE/.test(sql)) {
      const same =
        db.revision === params[1] && params[2] instanceof Date && params[2].getTime() === db.updatedAt.getTime();
      return {
        rows: [
          {
            data_mode: "prototype",
            revision: String(db.revision),
            payload: structuredClone(db.core),
            cache_revision: String(db.revision),
            cache_updated_at: new Date(db.updatedAt),
            records: same ? null : recordRows(params[3]),
          },
        ],
      };
    }
    if (/FROM ward_flow\.workspaces WHERE id=\$1 AND data_mode='prototype' FOR (UPDATE|SHARE)/.test(sql))
      return {
        rows: [
          {
            data_mode: "prototype",
            revision: String(db.revision),
            payload: structuredClone(db.core),
            cache_updated_at: new Date(db.updatedAt),
          },
        ],
      };
    if (/FROM ward_flow\.workspace_records WHERE workspace_id=\$1/.test(sql))
      return { rows: recordRows(params.length > 1 ? params[1] : -1) };
    if (/^UPDATE ward_flow\.workspaces SET revision/.test(sql)) {
      db.revision = params[1];
      db.core = structuredClone(params[2]);
      db.updatedAt = new Date(params[3]);
      return { rows: [], rowCount: 1 };
    }
    if (/^DELETE FROM ward_flow\.workspace_records/.test(sql)) {
      params[1].forEach((collection, index) => db.records.delete(`${collection}\0${params[2][index]}`));
      return { rows: [], rowCount: params[1].length };
    }
    if (/^INSERT INTO ward_flow\.workspace_records/.test(sql)) {
      for (const row of JSON.parse(params[1]))
        db.records.set(`${row.collection}\0${row.record_id}`, { ...row, revision: String(row.revision) });
      return { rows: [], rowCount: 1 };
    }
    if (/^INSERT INTO ward_flow\.audit/.test(sql)) {
      db.audits.push({ action: params[3], changes: params[7] });
      return { rows: [], rowCount: 1 };
    }
    if (/FROM ward_flow\.commands/.test(sql)) return { rows: [], rowCount: 0 };
    if (/^INSERT INTO ward_flow\.commands/.test(sql)) return { rows: [], rowCount: 1 };
    assert.fail(`Unexpected query: ${sql.slice(0, 90)}`);
  }
  return { db, pool: { query, connect: async () => ({ query, release() {} }) } };
}

function storeFor(world, options = {}) {
  const { db, pool } = memoryDatabase(world);
  let at = new Date(start);
  const store = createWorkspaceStore(pool, {
    workspaceId,
    engine: options.engine ?? engine,
    clock: () => new Date(at),
    log: () => {},
    alert: options.alert ?? (() => {}),
    ...(options.sizeLimits ? { sizeLimits: options.sizeLimits } : {}),
    demoEvents: true,
  });
  return { db, store, tick: (ms) => (at = new Date(at.getTime() + ms)) };
}

const wardView = (unitId) => ({
  actorId,
  membershipId: null,
  access: engine.parseAccess("ward", { kind: "ward", unitIds: [unitId] }),
  grants: [],
});

test("PS-05: a full read reuses the scoped board per revision and access, and never across places", async () => {
  const world = engine.seedWorld(start);
  const units = world.state.units.map((unit) => unit.id);
  let scoped = 0;
  const counting = {
    ...engine,
    scopeWorld: (...args) => {
      scoped += 1;
      return engine.scopeWorld(...args);
    },
  };
  const { store } = storeFor(world, { engine: counting });
  await store.viewer(actorId, {}).catch(() => {}); // learns the schema version
  const first = wardView(units[0]);
  const second = wardView(units[1]);
  assert.ok(first.access && second.access);
  const a1 = await store.read(actorId, first);
  const a2 = await store.read(actorId, { ...first });
  const b1 = await store.read(actorId, second);
  assert.equal(scoped, 2, "the second read of the same desk reuses its scoped board");
  assert.equal(a1.payload, a2.payload);
  assert.notEqual(a1.payload, b1.payload);
  assert.deepEqual(a1.payload, withoutRecordDetail(engine.scopeWorld(world, first.access, start)));
  assert.deepEqual(b1.payload, withoutRecordDetail(engine.scopeWorld(world, second.access, start)));
  assert.notDeepEqual(a1.payload, b1.payload, "two places see different boards");
  // A save moves the revision: the next read scopes again.
  assert.equal((await store.command(actorId, crypto.randomUUID(), a1.revision, refresh(units[0]))).status, 200);
  const a3 = await store.read(actorId, first);
  assert.equal(scoped >= 3, true);
  assert.notEqual(a3.payload, a1.payload);
  assert.equal(a3.revision, a1.revision + 1);
  // A break glass opening changes the scoping inputs, so it is a different entry.
  const patientId = world.state.patients[0]?.id;
  if (patientId) {
    const opened = await store.read(actorId, {
      ...first,
      grants: [{ patientId, until: new Date(start.getTime() + 600_000) }],
    });
    assert.notEqual(opened.payload, a3.payload);
  }
});

test("PS-05: replies built from parts match plain JSON, and their spliced gzip decodes", async () => {
  const big = { rows: Array.from({ length: 3000 }, (_, index) => ({ id: `SYN-${index}`, note: 'é "}' })) };
  registerPart(big);
  const body = { role: "ward", snapshot: { revision: 3, payload: big, again: big }, tail: '"}' };
  const segments = replySegments(body);
  assert.ok(segments);
  assert.equal(segmentBytes(segments).toString("utf8"), JSON.stringify(body));
  assert.equal(gunzipSync(await gzipSegments(segments)).toString("utf8"), JSON.stringify(body));
  assert.equal(replySegments({ plain: [1, 2] }), null, "a reply without parts is serialised as before");
  // Through the real listener, decoded by fetch as a browser would.
  const server = listen(async () => jsonResponse(body, { status: 200, headers: {} }), {
    port: 0,
    host: "127.0.0.1",
    trustedProxyAddresses: [],
  });
  await once(server, "listening");
  try {
    const address = /** @type {import("node:net").AddressInfo} */ (server.address());
    const reply = await fetch(`http://127.0.0.1:${address.port}/v1/workspace`, {
      headers: { "accept-encoding": "gzip" },
    });
    assert.equal(reply.headers.get("content-encoding"), "gzip");
    assert.deepEqual(await reply.json(), JSON.parse(JSON.stringify(body)));
  } finally {
    server.close();
  }
  const lru = new LruCache(2);
  lru.set("a", 1);
  lru.set("b", 2);
  lru.get("a");
  lru.set("c", 3);
  assert.deepEqual([...lru.entries.keys()], ["a", "c"], "the least recently used entry goes first");
});

test("PS-11: the archive count is read once per revision and carried across this server's saves", async () => {
  const world = engine.seedWorld(start);
  const units = world.state.units.map((unit) => unit.id);
  const { db, store } = storeFor(world);
  await store.viewer(actorId, {}).catch(() => {});
  const first = await store.read(actorId);
  await store.read(actorId);
  assert.equal(first.archived, 0);
  assert.equal(db.counts, 1, "a second read at the same revision does not count again");
  let revision = first.revision;
  for (let step = 0; step < 3; step++) {
    const saved = await store.command(actorId, crypto.randomUUID(), revision, refresh(units[step % units.length]));
    assert.equal(saved.status, 200);
    assert.equal(saved.body.snapshot.archived, 0);
    revision += 1;
  }
  assert.equal((await store.read(actorId)).archived, 0);
  assert.equal(db.counts, 1, "this server's own saves carry the count forward");
  // Another server archives and moves the revision: the next read counts again.
  db.archived.push({ generation: world.state.worldGeneration, key: "elsewhere" });
  db.revision += 1;
  db.updatedAt = new Date(db.updatedAt.getTime() + 1000);
  assert.equal((await store.read(actorId)).archived, 1);
  assert.equal(db.counts, 2);
});

test("PS-12 and PS-02: one size measurement per save; past the threshold the short window and a limited alert", async () => {
  const world = engine.seedWorld(start);
  const units = world.state.units.map((unit) => unit.id);
  const windows = [];
  const watching = {
    ...engine,
    archiveClosed: (value, at, afterMinutes) => {
      windows.push(afterMinutes);
      return engine.archiveClosed(value, at, afterMinutes);
    },
  };
  const alerts = [];
  const { store, tick } = storeFor(world, {
    engine: watching,
    alert: (event) => alerts.push(event),
    sizeLimits: { pressureBytes: 1000, pressureAfterMinutes: 7 * 24 * 60, alertEveryMs: 3_600_000 },
  });
  await store.viewer(actorId, {}).catch(() => {});
  let revision = (await store.read(actorId)).revision;
  const stringify = JSON.stringify;
  let measured = 0;
  JSON.stringify = function (value, ...rest) {
    if (value && typeof value === "object" && "dayZero" in value && "state" in value) measured += 1;
    return stringify.call(this, value, ...rest);
  };
  try {
    for (let step = 0; step < 3; step++) {
      tick(60_000);
      const saved = await store.command(actorId, crypto.randomUUID(), revision, refresh(units[step]), {
        revisionOnly: true,
      });
      assert.equal(saved.status, 200);
      revision += 1;
    }
  } finally {
    JSON.stringify = stringify;
  }
  assert.equal(measured, 3, "each save measures the world once");
  assert.deepEqual(
    windows,
    [7 * 24 * 60, 7 * 24 * 60, 7 * 24 * 60],
    "every save past the threshold archives, with the short window",
  );
  assert.equal(alerts.length, 1, "the operator alert is rate limited");
  assert.deepEqual(alerts[0], { event: "ward_backend_workspace_size_alert", errorName: "WorkspaceNearLimit" });
});

test("PS-02: the shorter window archives closed records the 30 day window keeps, and never goes under a day", () => {
  const world = engine.seedWorld(start);
  const now = engine.worldNow(world, start);
  // One stood-down alert of our own, closed ten days ago in workspace minutes.
  const alert = {
    ...(world.state.broadcastAlerts[0] ?? {}),
    id: "SYN-ALERT-OLD",
    status: "stood_down",
    stoodDownAt: now - 10 * 24 * 60,
  };
  const state = { ...world.state, broadcastAlerts: [alert] };
  assert.deepEqual(engine.archiveClosedState(state, now).archived, [], "30 days: kept live");
  const short = engine.archiveClosedState(state, now, 7 * 24 * 60).archived;
  assert.deepEqual(
    short.map((record) => record.id),
    ["SYN-ALERT-OLD"],
  );
  assert.deepEqual(engine.archiveClosedState(state, now, 0).archived.length, 1, "a window under a day is a day");
  const recent = { ...alert, stoodDownAt: now - 60 };
  assert.deepEqual(engine.archiveClosedState({ ...state, broadcastAlerts: [recent] }, now, 0).archived, []);
});

test("H-0642: a reset keeps a count and hash of the new scenario's audit entries, not the list", async () => {
  const entries = [{ id: "a" }, { id: "b" }];
  const stored = storedAuditChanges({ reset: true, domainAudit: entries, facts: {} });
  assert.equal(stored.domainAudit.count, 2);
  assert.match(stored.domainAudit.sha256, /^[a-f0-9]{64}$/);
  assert.equal(stored.reset, true);
  const ordinary = { reset: false, domainAudit: entries, facts: {} };
  assert.equal(storedAuditChanges(ordinary), ordinary, "an ordinary command keeps its entries");
  assert.deepEqual(storedAuditChanges({}), {});

  const world = engine.seedWorld(start);
  const { db, store } = storeFor(world);
  await store.viewer(actorId, {}).catch(() => {});
  const { revision } = await store.read(actorId);
  const reset = await store.command(actorId, crypto.randomUUID(), revision, { type: "RESET_SCENARIO", role: "demo" });
  assert.equal(reset.status, 200);
  const row = db.audits.at(-1);
  assert.equal(row.action, "RESET_SCENARIO");
  assert.equal(row.changes.reset, true);
  assert.equal(Array.isArray(row.changes.domainAudit), false);
  assert.equal(row.changes.domainAudit.summary, true);
});

test("PS-15: a Railway replica says once at startup that caches are per process", () => {
  const lines = [];
  assert.equal(
    processCacheNotice({}, (line) => lines.push(line)),
    false,
  );
  assert.equal(
    processCacheNotice({ RAILWAY_REPLICA_ID: "synthetic" }, (line) => lines.push(line)),
    true,
  );
  assert.deepEqual(lines, [{ event: "ward_backend_process_cache_notice", caches: "per_process", expectedReplicas: 1 }]);
});
