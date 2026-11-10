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
import { jsonByteLength, jsonCharacterLength, planSave } from "./records.mjs";
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

test("an unchanged statewide board is serialised once across minutes while clocks and committed revisions stay fresh", async () => {
  const world = engine.seedWorld(start);
  let serialisations = 0;
  const counting = {
    ...engine,
    scopeWorld: (...args) => {
      // Strip detail before installing the probe: the store's identical filter then returns
      // this object without spreading it, so only body serialisation reads the getter.
      const scoped = withoutRecordDetail(engine.scopeWorld(...args));
      return {
        ...scoped,
        get version() {
          serialisations += 1;
          return scoped.version;
        },
      };
    },
  };
  const { store, tick } = storeFor(world, { engine: counting });
  await store.viewer(actorId, {}).catch(() => {});
  const view = { actorId, membershipId: null, access: engine.STATEWIDE, grants: [] };
  const expectedPayload = withoutRecordDetail(engine.scopeWorld(world, view.access, start));
  let latest = await store.read(actorId, view);
  const initialReply = jsonResponse({ snapshot: latest }, { status: 200, headers: {} });
  assert.equal(serialisations, 0, "building an unread response must not read the serialisation probe");
  let decoded = await initialReply.json();
  assert.equal(serialisations, 1, "consuming the first body reads the serialisation probe once");
  const initialNow = decoded.snapshot.now;
  assert.deepEqual(decoded.snapshot.payload, expectedPayload);
  for (let minute = 1; minute <= 20; minute++) {
    tick(60_000);
    latest = await store.read(actorId, view);
    decoded = await jsonResponse({ snapshot: latest }, { status: 200, headers: {} }).json();
    assert.equal(decoded.snapshot.now, initialNow + minute);
    assert.deepEqual(decoded.snapshot.payload, expectedPayload);
  }
  const unchangedSerialisations = serialisations;
  const retained = jsonResponse({ snapshot: latest }, { status: 200, headers: {} });
  const saved = await store.command(actorId, crypto.randomUUID(), latest.revision, refresh(world.state.units[0].id), {
    revisionOnly: true,
  });
  assert.equal(saved.status, 200);
  tick(60_000);
  const next = await store.read(actorId, view);
  const nextDecoded = await jsonResponse({ snapshot: next }, { status: 200, headers: {} }).json();
  assert.equal(nextDecoded.snapshot.revision, latest.revision + 1);
  assert.equal(nextDecoded.snapshot.now, initialNow + 21);
  assert.notEqual(next.payload, latest.payload, "a committed revision rebuilds its board");
  const repeated = await store.read(actorId, view);
  assert.deepEqual(
    (await jsonResponse({ snapshot: repeated }, { status: 200, headers: {} }).json()).snapshot.payload,
    nextDecoded.snapshot.payload,
  );
  assert.deepEqual((await retained.json()).snapshot, decoded.snapshot, "an older response keeps its original board");
  assert.equal(
    unchangedSerialisations,
    1,
    "an unchanged statewide board must not allocate a new JSON part each minute",
  );
  assert.equal(serialisations, 2, "the new committed board is serialised once and then reused");
});

test("an incompatible read drops a serialized statewide board before a same-stamp repair", async () => {
  const world = engine.seedWorld(start);
  const { db, store, tick } = storeFor(world);
  await store.viewer(actorId, {}).catch(() => {});
  const view = { actorId, membershipId: null, access: engine.STATEWIDE, grants: [] };
  const first = await store.read(actorId, view);
  const initial = await jsonResponse({ snapshot: first }, { status: 200, headers: {} }).json();
  const retained = jsonResponse({ snapshot: first }, { status: 200, headers: {} });
  const revision = db.revision;
  const updatedAt = db.updatedAt.getTime();
  const version = db.core.version;
  db.core = { ...db.core, version: 0 };
  await assert.rejects(store.read(actorId, view), /Stored workspace is incompatible/);

  // A synthetic hand repair does not change the committed revision or update time.
  db.core = { ...db.core, version };
  const unit = [...db.records.values()].find((row) => row.collection === "units");
  assert.ok(unit);
  assert.ok(unit.body && typeof unit.body === "object" && "name" in unit.body && typeof unit.body.name === "string");
  unit.body = { ...unit.body, name: "SYN-CACHE-REPAIRED" };
  tick(61_000);
  const repaired = await store.read(actorId, view);
  const decoded = await jsonResponse({ snapshot: repaired }, { status: 200, headers: {} }).json();
  assert.equal(db.revision, revision);
  assert.equal(db.updatedAt.getTime(), updatedAt);
  assert.equal(decoded.snapshot.revision, first.revision);
  assert.equal(decoded.snapshot.now, initial.snapshot.now + 1);
  assert.equal(
    decoded.snapshot.payload.state.units.find((row) => row.id === unit.record_id)?.name,
    "SYN-CACHE-REPAIRED",
    "a valid repair after a refusal must replace the previously serialized board",
  );
  assert.notEqual(repaired.payload, first.payload);
  assert.deepEqual((await retained.json()).snapshot, initial.snapshot, "an older response remains immutable");
  assert.equal((await store.read(actorId, view)).payload, repaired.payload, "the repaired board is cached again");
});

test("a read crossing an incompatible refusal cannot repopulate the repaired statewide board cache", async () => {
  const world = engine.seedWorld(start);
  const { db, pool } = memoryDatabase(world);
  let at = new Date(start);
  let archiveReached = () => {};
  let resumeArchive = () => {};
  const archiveStarted = new Promise((resolve) => {
    archiveReached = () => resolve(undefined);
  });
  const archiveGate = new Promise((resolve) => {
    resumeArchive = () => resolve(undefined);
  });
  const query = pool.query;
  let holdArchive = true;
  pool.query = async (sql, params = []) => {
    const result = await query(sql, params);
    if (holdArchive && /count\(\*\)::integer AS archived FROM ward_flow\.archived_records/.test(sql)) {
      holdArchive = false;
      archiveReached();
      await archiveGate;
    }
    return result;
  };
  const store = createWorkspaceStore(pool, {
    workspaceId,
    engine,
    clock: () => new Date(at),
    log: () => {},
    alert: () => {},
    demoEvents: true,
  });
  await store.viewer(actorId, {}).catch(() => {});
  const view = { actorId, membershipId: null, access: engine.STATEWIDE, grants: [] };
  const earlierRead = store.read(actorId, view);
  await archiveStarted;
  const revision = db.revision;
  const updatedAt = db.updatedAt.getTime();
  const version = db.core.version;
  const unit = [...db.records.values()].find((row) => row.collection === "units");
  assert.ok(unit);
  assert.ok(unit.body && typeof unit.body === "object" && "name" in unit.body && typeof unit.body.name === "string");
  const originalName = unit.body.name;
  try {
    db.core = { ...db.core, version: 0 };
    await assert.rejects(store.read(actorId, view), /Stored workspace is incompatible/);
    db.core = { ...db.core, version };
    unit.body = { ...unit.body, name: "SYN-CACHE-RACE-REPAIRED" };
    at = new Date(start.getTime() + 61_000);
  } finally {
    resumeArchive();
  }
  // The old read captured its own world before the refusal and finishes after the repair.
  const earlier = await earlierRead;
  const olderReply = jsonResponse({ snapshot: earlier }, { status: 200, headers: {} });
  const repaired = await store.read(actorId, view);
  const decoded = await jsonResponse({ snapshot: repaired }, { status: 200, headers: {} }).json();
  assert.equal(db.revision, revision);
  assert.equal(db.updatedAt.getTime(), updatedAt);
  assert.equal(decoded.snapshot.revision, earlier.revision);
  assert.equal(decoded.snapshot.now, earlier.now + 1);
  assert.equal(
    decoded.snapshot.payload.state.units.find((row) => row.id === unit.record_id)?.name,
    "SYN-CACHE-RACE-REPAIRED",
    "a read crossing a refusal must not seed the repaired workspace's cache",
  );
  assert.equal(
    (await olderReply.json()).snapshot.payload.state.units.find((row) => row.id === unit.record_id)?.name,
    originalName,
    "the crossing read keeps its own immutable board",
  );
  assert.notEqual(repaired.payload, earlier.payload);
  assert.equal((await store.read(actorId, view)).payload, repaired.payload);
});

test("a late committed read keeps the newer board's cached JSON part", { timeout: 15_000 }, async () => {
  const world = engine.seedWorld(start);
  const expectedA = withoutRecordDetail(world);
  const { db, pool } = memoryDatabase(world);
  let at = new Date(start);
  let archiveReached = () => {};
  let resumeArchive = () => {};
  const archiveStarted = new Promise((resolve) => {
    archiveReached = () => resolve(undefined);
  });
  const archiveGate = new Promise((resolve) => {
    resumeArchive = () => resolve(undefined);
  });
  /** @template T @param {Promise<T>} promise @returns {Promise<T>} */
  const bounded = (promise) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Synthetic archive barrier timed out")), 5_000);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  const query = pool.query;
  let holdArchive = true;
  pool.query = async (sql, params = []) => {
    const result = await query(sql, params);
    if (holdArchive && /count\(\*\)::integer AS archived FROM ward_flow\.archived_records/.test(sql)) {
      holdArchive = false;
      archiveReached();
      await archiveGate;
    }
    return result;
  };
  const store = createWorkspaceStore(pool, {
    workspaceId,
    engine,
    clock: () => new Date(at),
    log: () => {},
    alert: () => {},
    demoEvents: true,
  });
  await store.viewer(actorId, {}).catch(() => {});
  const view = { actorId, membershipId: null, access: engine.STATEWIDE, grants: [] };
  const pendingA = store.read(actorId, { ...view });
  const stringify = JSON.stringify;
  let phase = "outside";
  let totalSerialisations = 0;
  let newerSerialisations = 0;
  let olderSerialisations = 0;
  try {
    await bounded(archiveStarted);
    assert.equal(db.revision, 1);
    at = new Date(start.getTime() + 1_000);
    const saved = await store.command(actorId, crypto.randomUUID(), 1, refresh(world.state.units[0].id), {
      revisionOnly: true,
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.outcome, "accepted");
    assert.equal(saved.body.commandRevision, 2);
    assert.equal(db.revision, 2);
    const b1 = await store.read(actorId, { ...view });
    const expectedB = structuredClone(b1.payload);
    assert.equal(b1.revision, 2);
    assert.notDeepEqual(expectedB, expectedA);
    // The command/size measurement is outside this observation window: only response parts count.
    JSON.stringify = function (value, ...rest) {
      if (value && typeof value === "object" && Object.hasOwn(value, "dayZero") && Object.hasOwn(value, "state")) {
        totalSerialisations++;
        if (phase === "B1" || phase === "B2") newerSerialisations++;
        if (phase === "A") olderSerialisations++;
      }
      return stringify.call(this, value, ...rest);
    };
    phase = "B1";
    const decodedB1 = await jsonResponse({ snapshot: b1 }, { status: 200, headers: {} }).json();
    assert.deepEqual(decodedB1.snapshot.payload, expectedB);
    assert.equal(newerSerialisations, 1);
    const retainedB = jsonResponse({ snapshot: b1 }, { status: 200, headers: {} });
    phase = "A";
    resumeArchive();
    const a = await bounded(pendingA);
    assert.equal(a.revision, 1);
    assert.deepEqual(a.payload, expectedA);
    const decodedA = await jsonResponse({ snapshot: a }, { status: 200, headers: {} }).json();
    assert.deepEqual(decodedA.snapshot.payload, expectedA);
    assert.equal(olderSerialisations, 1);
    const retainedA = jsonResponse({ snapshot: a }, { status: 200, headers: {} });
    phase = "B2";
    const b2 = await store.read(actorId, { ...view });
    const decodedB2 = await jsonResponse({ snapshot: b2 }, { status: 200, headers: {} }).json();
    assert.equal(b2.revision, 2);
    assert.deepEqual(decodedB2.snapshot.payload, expectedB);
    assert.deepEqual(b1.payload, expectedB);
    phase = "controls";
    assert.deepEqual((await retainedB.json()).snapshot, decodedB1.snapshot);
    assert.deepEqual((await retainedA.json()).snapshot, decodedA.snapshot);
    assert.equal(totalSerialisations, newerSerialisations + olderSerialisations);
    assert.equal(olderSerialisations, 1);
    assert.equal(db.revision, 2);
    assert.equal(newerSerialisations, 1, "a newer committed board stays serialised once after a late older read");
    assert.equal(b2.payload, b1.payload, "the newer committed board keeps its cached payload");
  } finally {
    JSON.stringify = stringify;
    resumeArchive();
    await pendingA.catch(() => {});
  }
});

test("a scoped board drops an expired opening when the workspace minute changes", async () => {
  const world = engine.seedWorld(start);
  const view = wardView(world.state.units[0].id);
  const own = new Set(engine.scopeWorld(world, view.access, start).state.patients.map((patient) => patient.id));
  const foreign = world.state.patients.find((patient) => !own.has(patient.id));
  assert.ok(foreign);
  const granted = { ...view, grants: [{ patientId: foreign.id, until: new Date(start.getTime() + 60_000) }] };
  const { store, tick } = storeFor(world);
  await store.viewer(actorId, {}).catch(() => {});
  const before = await jsonResponse(
    { snapshot: await store.read(actorId, granted) },
    { status: 200, headers: {} },
  ).json();
  assert.equal(
    before.snapshot.payload.state.patients.some((patient) => patient.id === foreign.id),
    true,
  );
  tick(61_000);
  const after = await jsonResponse(
    { snapshot: await store.read(actorId, granted) },
    { status: 200, headers: {} },
  ).json();
  assert.equal(after.snapshot.now, before.snapshot.now + 1);
  assert.equal(
    after.snapshot.payload.state.patients.some((patient) => patient.id === foreign.id),
    false,
  );
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

test("full replies defer serialising cached parts until their body is read", async () => {
  let serialisations = 0;
  const payload = registerPart({
    get value() {
      serialisations += 1;
      return 12345;
    },
  });
  const body = { snapshot: { payload } };
  const reply = jsonResponse(body, { status: 200, headers: {} });
  assert.equal(serialisations, 0, "constructing an unused reply must not allocate its full JSON body");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(serialisations, 0, "an unread response must stay lazy after stream scheduling");
  assert.equal((await reply.json()).snapshot.payload.value, 12345);
  assert.equal(serialisations, 1);
  assert.equal((await jsonResponse(body, { status: 200, headers: {} }).json()).snapshot.payload.value, 12345);
  assert.equal(serialisations, 1, "later readers reuse the registered JSON part");
});

test("a response body reader cannot change a later reply's cached parts", async () => {
  const payload = registerPart({ value: 12345 });
  const body = { snapshot: { payload } };
  const reply = jsonResponse(body, { status: 200, headers: {} });
  assert.ok(reply.body);
  const reader = reply.body.getReader();
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    chunk.value.fill(0);
  }
  reader.releaseLock();
  assert.equal((await jsonResponse(body, { status: 200, headers: {} }).json()).snapshot.payload.value, 12345);
});

test("segmented replies preserve uncompressed output and the listener's gzip threshold", async () => {
  const large = { snapshot: { payload: registerPart({ value: "é".repeat(1500) }) } };
  const small = { snapshot: { payload: registerPart({ value: 12345 }) } };
  const plain = { value: "é".repeat(1500) };
  const bodies = new Map(
    /** @type {Array<[string, unknown]>} */ ([
      ["/large", large],
      ["/small", small],
      ["/plain", plain],
    ]),
  );
  const server = listen(
    async (request) =>
      jsonResponse(bodies.get(new URL(request.url).pathname), { status: 200, headers: { vary: "Origin" } }),
    { port: 0, host: "127.0.0.1", trustedProxyAddresses: [] },
  );
  await once(server, "listening");
  try {
    const address = /** @type {import("node:net").AddressInfo} */ (server.address());
    for (const { path, encoding, expected, compressed } of [
      { path: "/large", encoding: "identity", expected: large, compressed: false },
      { path: "/large", encoding: "gzip;q=0", expected: large, compressed: false },
      { path: "/small", encoding: "gzip", expected: small, compressed: false },
      { path: "/plain", encoding: "gzip", expected: plain, compressed: true },
    ]) {
      const reply = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        headers: { "accept-encoding": encoding },
      });
      assert.equal(reply.status, 200);
      assert.equal(reply.headers.get("content-encoding"), compressed ? "gzip" : null);
      assert.equal(reply.headers.get("vary"), compressed ? "Origin, Accept-Encoding" : "Origin");
      assert.deepEqual(await reply.json(), expected);
      if (!compressed)
        assert.equal(Number(reply.headers.get("content-length")), Buffer.byteLength(JSON.stringify(expected)));
    }
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("gzip sends cached parts without consuming a whole uncompressed response body", async () => {
  const payload = registerPart({ value: "é".repeat(1500) });
  let fullBodyReads = 0;
  let sequence = 0;
  const responses = [];
  const server = listen(
    async () => {
      const response = jsonResponse({ sequence: ++sequence, payload }, { status: 200, headers: { vary: "Origin" } });
      const originalRead = response.arrayBuffer.bind(response);
      response.arrayBuffer = () => {
        fullBodyReads += 1;
        return originalRead();
      };
      responses.push(response);
      return response;
    },
    { port: 0, host: "127.0.0.1", trustedProxyAddresses: [] },
  );
  await once(server, "listening");
  try {
    const address = /** @type {import("node:net").AddressInfo} */ (server.address());
    for (let index = 1; index <= 2; index++) {
      const reply = await fetch(`http://127.0.0.1:${address.port}/v1/workspace`, {
        headers: { "accept-encoding": "gzip" },
      });
      assert.equal(reply.status, 200);
      assert.equal(reply.headers.get("content-encoding"), "gzip");
      assert.equal(reply.headers.get("vary"), "Origin, Accept-Encoding");
      const value = await reply.json();
      assert.equal(value.sequence, index, "per-request fields stay fresh while the part is reused");
      assert.equal(value.payload.value, payload.value);
    }
    assert.equal(fullBodyReads, 0, "compressed cached parts must not allocate a full uncompressed response body");
    assert.equal(
      responses.every((response) => response.bodyUsed),
      true,
      "the unused body is cancelled",
    );
  } finally {
    server.close();
    await once(server, "close");
  }
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

test("a revision-only save measures its world without serialising a whole-world JSON string", async () => {
  const world = engine.seedWorld(start);
  const unit = world.state.units[0];
  const expected = engine.applyCommand(world, refresh(unit.id), start).world;
  const expectedLength = Buffer.byteLength(JSON.stringify(expected), "utf8");
  const windows = [];
  const alerts = [];
  const watching = {
    ...engine,
    archiveClosed: (value, at, afterMinutes) => {
      windows.push(afterMinutes);
      return { world: value, archived: [] };
    },
  };
  const { store } = storeFor(world, {
    engine: watching,
    alert: (event) => alerts.push(event),
    sizeLimits: { pressureBytes: expectedLength, pressureAfterMinutes: 7 * 24 * 60, alertEveryMs: 3_600_000 },
  });
  await store.viewer(actorId, {}).catch(() => {});
  const first = await store.read(actorId);
  let wholeWorldSerialisations = 0;
  const stringify = JSON.stringify;
  JSON.stringify = function (value, ...rest) {
    if (value && typeof value === "object" && "dayZero" in value && "state" in value) wholeWorldSerialisations++;
    return stringify.call(this, value, ...rest);
  };
  let saved;
  try {
    saved = await store.command(actorId, crypto.randomUUID(), first.revision, refresh(unit.id), { revisionOnly: true });
  } finally {
    JSON.stringify = stringify;
  }
  assert.equal(saved.status, 200);
  assert.equal(saved.body.commandRevision, first.revision + 1);
  assert.equal(Object.hasOwn(saved.body, "snapshot"), false);
  const reloaded = await store.read(actorId);
  assert.equal(reloaded.revision, saved.body.commandRevision);
  assert.deepEqual(reloaded.payload, withoutRecordDetail(expected));
  assert.deepEqual(windows, [], "the exact native JSON byte length is not above its pressure threshold");
  assert.equal(alerts.length, 0);
  assert.equal(wholeWorldSerialisations, 0, "size measurement must not join a whole-world JSON string");
});

test("JSON character counting matches native UTF-16 lengths with bounded native string pieces", () => {
  const controls = String.fromCharCode(...Array.from({ length: 32 }, (_, index) => index));
  const shared = { nested: [1, { text: "é😀" }] };
  const longKey = "x".repeat(16_383) + "😀" + '\\"\n';
  const cases = [
    null,
    true,
    false,
    0,
    -0,
    1.25,
    1e30,
    NaN,
    Infinity,
    -Infinity,
    "",
    "é漢字😀",
    '"\\' + controls + "\u2028\u2029",
    "\ud800",
    "\udc00",
    "x".repeat(16_383) + "😀" + "tail",
    "\ud800".repeat(16_384) + "x",
    "\udc00".repeat(16_385),
    ("\\" + controls).repeat(1000),
    [],
    {},
    Object.assign(Object.create(null), { text: "é😀" }),
    [null, undefined, "", [], {}, [1, { text: "nested" }]],
    { omitted: undefined, empty: {}, array: [undefined, null], [longKey]: "é😀" },
    { first: shared, second: shared },
  ];
  const expected = cases.map((value) => JSON.stringify(value).length);
  const stringify = JSON.stringify;
  let largestStringPiece = 0;
  let containerSerialisations = 0;
  JSON.stringify = function (value, ...rest) {
    if (typeof value === "string") largestStringPiece = Math.max(largestStringPiece, value.length);
    if (value && typeof value === "object") containerSerialisations++;
    return stringify.call(this, value, ...rest);
  };
  let actual;
  try {
    actual = cases.map((value) => jsonCharacterLength(value));
  } finally {
    JSON.stringify = stringify;
  }
  assert.deepEqual(actual, expected);
  assert.equal(containerSerialisations, 0, "ordinary JSON containers must not be joined into native JSON text");
  assert.equal(largestStringPiece <= 16_384, true, "native escaping receives bounded UTF-16 string pieces");
  assert.notEqual(
    jsonCharacterLength("é😀"),
    Buffer.byteLength(JSON.stringify("é😀")),
    "legacy size counts UTF-16, not UTF-8",
  );
});

test("unsupported JSON shapes retain the native root fallback and callback context", () => {
  let getterCalls = 0;
  const getter = {
    nested: Object.defineProperty({}, "value", {
      enumerable: true,
      get() {
        getterCalls++;
        return "é😀";
      },
    }),
  };
  const getterLength = JSON.stringify(getter).length;
  getterCalls = 0;
  assert.equal(jsonCharacterLength(getter), getterLength);
  assert.equal(getterCalls, 1);

  let toJsonCalls = 0;
  const toJson = {
    outer: {
      toJSON(key) {
        toJsonCalls++;
        return { key, text: "é😀" };
      },
    },
  };
  const toJsonLength = JSON.stringify(toJson).length;
  toJsonCalls = 0;
  assert.equal(jsonCharacterLength(toJson), toJsonLength);
  assert.equal(toJsonCalls, 1, "toJSON receives its original nested key exactly once");

  let indexCalls = 0;
  const indexed = [1, 2];
  Object.defineProperty(indexed, "1", {
    enumerable: true,
    get() {
      indexCalls++;
      return "😀";
    },
  });
  const indexLength = JSON.stringify(indexed).length;
  indexCalls = 0;
  assert.equal(jsonCharacterLength(indexed), indexLength);
  assert.equal(indexCalls, 1);

  let proxyGets = 0;
  const proxy = new Proxy(
    { value: "é😀" },
    {
      get(target, key, receiver) {
        proxyGets++;
        return Reflect.get(target, key, receiver);
      },
    },
  );
  const proxyLength = JSON.stringify(proxy).length;
  const nativeGets = proxyGets;
  proxyGets = 0;
  assert.equal(jsonCharacterLength(proxy), proxyLength);
  assert.equal(proxyGets, nativeGets, "proxy classification must not trigger extra source reads");

  const sparse = new Array(3);
  Object.setPrototypeOf(sparse, Object.assign(Object.create(Array.prototype), { 1: "SYNTHETIC" }));
  let deep = {};
  for (let level = 0; level < 160; level++) deep = { nested: deep };
  const fallbackCases = [
    new Date("2026-11-05T00:00:00Z"),
    new Number(3),
    new String("é😀"),
    new Boolean(false),
    new Map([["synthetic", 1]]),
    new Set([1, 2]),
    sparse,
    deep,
    { omitted: undefined, fn: () => {}, symbol: Symbol("synthetic"), list: [undefined, () => {}, Symbol("synthetic")] },
  ];
  const rawJson = Object.getOwnPropertyDescriptor(JSON, "rawJSON")?.value;
  if (typeof rawJson === "function") fallbackCases.push({ value: rawJson("123456") });
  for (const value of fallbackCases) assert.equal(jsonCharacterLength(value), JSON.stringify(value).length);
  const cycle = {};
  cycle.self = cycle;
  for (const value of [undefined, () => {}, Symbol("synthetic"), 1n, cycle]) {
    const nativeLength = () => JSON.stringify(value).length;
    let nativeError;
    try {
      nativeLength();
    } catch (error) {
      nativeError = error;
    }
    assert.ok(nativeError instanceof Error);
    assert.throws(() => jsonCharacterLength(value), { name: nativeError.name });
  }
});

test("command size pressure uses the exact UTF-8 byte boundary of the native JSON (M162)", async () => {
  for (const offset of [-1, 0, 1]) {
    const seed = engine.seedWorld(start);
    const world = { ...seed, state: { ...seed.state, syntheticSizeProbe: "é😀\u0000" } };
    const unit = world.state.units[0];
    const expected = engine.applyCommand(world, refresh(unit.id), start).world;
    const oracleLength = Buffer.byteLength(JSON.stringify(expected), "utf8");
    assert.ok(oracleLength > JSON.stringify(expected).length, "Accented text weighs more in bytes than characters");
    const windows = [];
    const alerts = [];
    const { store } = storeFor(world, {
      engine: {
        ...engine,
        archiveClosed: (value, at, afterMinutes) => {
          windows.push(afterMinutes);
          return { world: value, archived: [] };
        },
      },
      alert: (event) => alerts.push(event),
      sizeLimits: { pressureBytes: oracleLength + offset, pressureAfterMinutes: 7 * 24 * 60, alertEveryMs: 3_600_000 },
    });
    await store.viewer(actorId, {}).catch(() => {});
    const first = await store.read(actorId);
    const saved = await store.command(actorId, crypto.randomUUID(), first.revision, refresh(unit.id), {
      revisionOnly: true,
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.commandRevision, first.revision + 1);
    assert.deepEqual(windows, offset < 0 ? [7 * 24 * 60] : []);
    assert.equal(alerts.length, offset < 0 ? 1 : 0);
  }
});

test("the maximum world byte boundary accepts equality and refuses one byte more", async () => {
  const limit = 8_388_608;
  for (const extra of [0, 1]) {
    const seed = engine.seedWorld(start);
    const world = { ...seed, state: { ...seed.state, syntheticSizeProbe: "" } };
    const unit = world.state.units[0];
    const base = engine.applyCommand(world, refresh(unit.id), start).world;
    world.state.syntheticSizeProbe = "x".repeat(limit + extra - Buffer.byteLength(JSON.stringify(base), "utf8"));
    const expected = engine.applyCommand(world, refresh(unit.id), start).world;
    assert.equal(Buffer.byteLength(JSON.stringify(expected), "utf8"), limit + extra);
    const { store, db } = storeFor(world, {
      engine: { ...engine, archiveClosed: (value) => ({ world: value, archived: [] }) },
    });
    await store.viewer(actorId, {}).catch(() => {});
    const first = await store.read(actorId);
    const save = () =>
      store.command(actorId, crypto.randomUUID(), first.revision, refresh(unit.id), { revisionOnly: true });
    if (extra === 0) {
      const saved = await save();
      assert.equal(saved.status, 200);
      assert.equal(saved.body.commandRevision, first.revision + 1);
      assert.equal((await store.read(actorId)).revision, saved.body.commandRevision);
    } else {
      await assert.rejects(save, { name: "WorkspaceTooLargeError" });
      assert.equal(db.revision, first.revision);
    }
  }
});

test("the 8 MiB cap counts UTF-8 bytes, so accented text under it in characters is still refused (M162)", async () => {
  const limit = 8_388_608;
  const seed = engine.seedWorld(start);
  const world = { ...seed, state: { ...seed.state, syntheticSizeProbe: "" } };
  const unit = world.state.units[0];
  const base = engine.applyCommand(world, refresh(unit.id), start).world;
  // "é" is one character but two bytes: a world just under the cap in characters, well over in bytes.
  world.state.syntheticSizeProbe = "é".repeat(limit - JSON.stringify(base).length);
  const expected = engine.applyCommand(world, refresh(unit.id), start).world;
  assert.equal(JSON.stringify(expected).length, limit);
  assert.ok(Buffer.byteLength(JSON.stringify(expected), "utf8") > limit);
  const { store, db } = storeFor(world, {
    engine: { ...engine, archiveClosed: (value) => ({ world: value, archived: [] }) },
  });
  await store.viewer(actorId, {}).catch(() => {});
  const first = await store.read(actorId);
  await assert.rejects(
    store.command(actorId, crypto.randomUUID(), first.revision, refresh(unit.id), { revisionOnly: true }),
    { name: "WorkspaceTooLargeError" },
  );
  assert.equal(db.revision, first.revision);
});

test("the byte count matches the native JSON's UTF-8 length for accented, emoji and escaped text (M162)", () => {
  for (const value of [
    "é😀\u0000",
    { name: "Zoë Ngā", note: ["café", "naïve", "\ud800", "x".repeat(40_000) + "ü"] },
    { clé: "é".repeat(20_000) + "😀".repeat(9_000) },
    [1, true, null, -0, 1e21, undefined, "Ōtautahi"],
  ])
    assert.equal(jsonByteLength(value), Buffer.byteLength(JSON.stringify(value), "utf8"));
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
  // Each ordinary size walk encodes the unique root dayZero key once. Recognising the legacy
  // whole-world call too preserves this three-measurement control across the implementation change.
  JSON.stringify = function (value, ...rest) {
    if (value === "dayZero" || (value && typeof value === "object" && "dayZero" in value && "state" in value))
      measured += 1;
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
