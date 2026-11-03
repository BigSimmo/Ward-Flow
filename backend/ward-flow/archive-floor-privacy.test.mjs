// @ts-check
// Synthetic store/engine boundary only; no database, network or hosted resources.
import assert from "node:assert/strict";
import test from "node:test";

import * as engine from "./dist/engine.mjs";
import { ARCHIVE_READ_LIMIT, createWorkspaceStore } from "./postgres.mjs";

const at = new Date("2026-11-01T12:00:00Z");
const world = engine.seedWorld(at);
const access = { role: "ward", scope: { kind: "ward", unitIds: ["fre-adult-open"] } };
const actorId = "11111111-1111-4111-8111-111111111111";
const membershipId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "33333333-3333-4333-8333-333333333333";
const emptySum = "000000000000";

function record(body, id, closedAt = 500, archivedRevision = 7) {
  return { collection: "movements", id, closedAt, archivedRevision, body: { ...body, id } };
}

const visible = world.state.movements.find(
  (movement) => movement.closure && engine.scopeArchive(world, [record(movement, movement.id)], access, at).length,
);
const hidden = world.state.movements.find(
  (movement) => movement.closure && !engine.scopeArchive(world, [record(movement, movement.id)], access, at).length,
);
assert.ok(visible && hidden, "Seed has closed movements inside and outside the synthetic ward");
assert.ok(engine.validWorld(world));

/**
 * The SQL double accepts only the archive read's schema, workspace and archive queries. Its rows
 * obey the actual SQL limit/order; unrelated archived bodies fill a retained 5,000-record window.
 * @param {ReturnType<typeof record>[]} records
 * @param {{ count?: number, since?: number, roleAccess?: { role: string, scope: Record<string, unknown> }, through?: number }} [options]
 */
async function readArchive(
  records,
  { count = records.length, since = undefined, roleAccess = access, through = 7 } = {},
) {
  if (count > ARCHIVE_READ_LIMIT && records.length < ARCHIVE_READ_LIMIT) {
    const edge = Math.min(...records.map((row) => row.closedAt));
    records = [
      ...records,
      ...Array.from({ length: ARCHIVE_READ_LIMIT - records.length }, (_, index) =>
        record(hidden, `WF-SYN-PADDING-${String(index).padStart(4, "0")}`, edge - 1 - index, through),
      ),
    ];
  }
  records = [...records].sort(
    (a, b) =>
      b.closedAt - a.closedAt ||
      (a.collection < b.collection ? -1 : a.collection > b.collection ? 1 : 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  assert.equal(records.length, Math.min(count, ARCHIVE_READ_LIMIT), "SQL LIMIT returns the retained population");
  const query = async (sql, values = []) => {
    if (sql.startsWith("SELECT max(version)")) return { rows: [{ version: 14 }] };
    if (sql.includes("FROM ward_flow.workspaces w")) {
      assert.equal(values[0], workspaceId);
      return {
        rows: [
          {
            data_mode: "prototype",
            revision: through,
            payload: structuredClone(world),
            cache_revision: through,
            cache_updated_at: at,
            records: [],
          },
        ],
      };
    }
    if (sql.startsWith("SELECT collection, record_id, closed_at, body, archived_revision,")) {
      assert.equal(values[0], workspaceId);
      assert.equal(values[1], world.state.worldGeneration);
      assert.equal(values[2], 0, "Each new store starts with no retained archive revision");
      assert.equal(values[3], ARCHIVE_READ_LIMIT);
      return {
        rows: records.map((row) => ({
          collection: row.collection,
          record_id: row.id,
          closed_at: row.closedAt,
          body: row.body,
          archived_revision: row.archivedRevision,
          archived: count,
          through,
        })),
      };
    }
    assert.fail(`Unexpected SQL in archive floor fixture: ${sql.slice(0, 90)}`);
  };
  const store = createWorkspaceStore(
    { query },
    { workspaceId, engine, clock: () => new Date(at), log: () => assert.fail("No diagnostic expected") },
  );
  return store.archive(
    {
      version: 14,
      actorId,
      membershipId,
      access: roleAccess,
      accessUntil: at.getTime() + 60_000,
      grants: [],
    },
    since,
  );
}

const ids = (reply) => reply.records.map((row) => row.body.id);

test("a capped archive reveals no hidden retention identity when all 5,000 retained records are outside the ward", async () => {
  const rows = Array.from({ length: ARCHIVE_READ_LIMIT }, (_, index) =>
    record(hidden, `WF-SYN-HIDDEN-${String(index).padStart(4, "0")}`, 10000 - index),
  );
  const reply = await readArchive(rows, { count: ARCHIVE_READ_LIMIT + 1 });
  assert.deepEqual(reply.records, []);
  assert.equal(Object.hasOwn(reply, "floor"), false);
  assert.equal(reply.sum, emptySum);
  assert.equal(reply.archived, ARCHIVE_READ_LIMIT + 1, "Existing global polling count remains compatible");
});

test("a sparse scoped archive names only its oldest authorised record as its retention floor", async () => {
  const own = record(visible, "WF-SYN-OWN-OLD", 8000);
  const reply = await readArchive([own, record(hidden, "WF-SYN-HIDDEN-TAIL", 200)], {
    count: ARCHIVE_READ_LIMIT + 1,
  });
  assert.deepEqual(reply.floor, [own.closedAt, "movements", own.id]);
  assert.deepEqual(ids(reply), [own.id]);
  assert.match(reply.records[0].hash, /^[0-9a-f]{12}$/);
});

test("a retention delta supplies the authorised floor, fresh records and whole-scope checksum", async () => {
  const old = record(visible, "WF-SYN-OWN-REMOVED", 300);
  const kept = record(visible, "WF-SYN-OWN-KEPT", 500);
  const fresh = record(visible, "WF-SYN-OWN-NEW", 700, 8);
  const before = await readArchive([kept, old]);
  assert.deepEqual(ids(before), [kept.id, old.id]);
  const rows = [fresh, kept, record(hidden, "WF-SYN-HIDDEN-TAIL", 200)];
  const delta = await readArchive(rows, { count: ARCHIVE_READ_LIMIT + 1, since: 7, through: 8 });
  const full = await readArchive(rows, { count: ARCHIVE_READ_LIMIT + 1, through: 8 });
  assert.equal(delta.since, 7);
  assert.equal(delta.through, 8);
  assert.deepEqual(delta.floor, [kept.closedAt, "movements", kept.id]);
  assert.ok(delta.floor);
  assert.ok(Number(delta.floor[0]) > old.closedAt, "The existing delta consumer can remove the old retained record");
  assert.deepEqual(ids(delta), [fresh.id]);
  assert.deepEqual(ids(full), [fresh.id, kept.id]);
  assert.equal(delta.sum, full.sum, "Checksum includes retained authorised rows omitted from the delta body");
});

test("an empty scoped delta has no hidden floor and its checksum signals a full reread to clear stale rows", async () => {
  const before = await readArchive([record(visible, "WF-SYN-OWN-EXPIRED", 300)]);
  assert.notEqual(before.sum, emptySum);
  const rows = [record(hidden, "WF-SYN-HIDDEN-ONLY", 500)];
  const delta = await readArchive(rows, { count: ARCHIVE_READ_LIMIT + 1, since: 7, through: 8 });
  assert.equal(delta.since, 7);
  assert.equal(Object.hasOwn(delta, "floor"), false);
  assert.deepEqual(delta.records, []);
  assert.equal(delta.sum, emptySum);
  assert.notEqual(delta.sum, before.sum);
  const full = await readArchive(rows, { count: ARCHIVE_READ_LIMIT + 1, through: 8 });
  assert.equal(Object.hasOwn(full, "since"), false);
  assert.deepEqual(full.records, []);
  assert.equal(full.sum, delta.sum);
});

test("equal closing times retain collection/id ordering within the authorised archive floor", async () => {
  const a = record(visible, "WF-SYN-OWN-A", 500);
  const b = record(visible, "WF-SYN-OWN-B", 500);
  const reply = await readArchive([b, record(hidden, "WF-SYN-Z-HIDDEN", 500), a], {
    count: ARCHIVE_READ_LIMIT + 1,
  });
  assert.deepEqual(ids(reply), [a.id, b.id]);
  assert.deepEqual(reply.floor, [500, "movements", b.id]);
});

test("an untruncated scoped archive preserves the existing no-floor reply", async () => {
  const own = record(visible, "WF-SYN-OWN-UNTRUNCATED", 500);
  const reply = await readArchive([own, record(hidden, "WF-SYN-HIDDEN-UNTRUNCATED", 400)]);
  assert.deepEqual(ids(reply), [own.id]);
  assert.equal(Object.hasOwn(reply, "floor"), false);
});

test("a statewide coordinator keeps the global retention floor because every retained row is authorised", async () => {
  const reply = await readArchive(
    [record(visible, "WF-SYN-STATEWIDE-A", 500), record(hidden, "WF-SYN-STATEWIDE-B", 400)],
    { count: ARCHIVE_READ_LIMIT + 1, roleAccess: { role: "coordinator", scope: { kind: "statewide" } } },
  );
  assert.equal(reply.records.length, ARCHIVE_READ_LIMIT);
  const oldest = reply.records.at(-1);
  assert.ok(oldest);
  assert.deepEqual(reply.floor, [oldest.closedAt, oldest.collection, oldest.body.id]);
});
