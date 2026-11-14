// @ts-check
// Desks-R5-1 and Together-X1a-2 (master stress test, 14 Nov 2026): a stored world whose day zero is
// a UTC midnight reads every board, referral, letter and legal clock 8 hours behind Perth. The held
// fix rebases it onto the Perth midnight before it (proposals/019-perth-day-zero.sql). These tests
// pin the engine's reference rebase and, given a loopback PostgreSQL and psql, the SQL against it.
// Synthetic data only.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { WARD_TIME_ZONE as CONFIG_TIME_ZONE } from "./config.mjs";
import { MIGRATIONS as SCHEMA } from "./migrations.mjs";
import { assembleWorld, planSave } from "./records.mjs";

const PROPOSAL = fileURLToPath(new URL("./proposals/019-perth-day-zero.sql", import.meta.url));
const MIGRATIONS = fileURLToPath(new URL("./migrations/", import.meta.url));
const engine = () => import("./dist/engine.mjs");

// The live world's day zero as the stress test read it, and its 16:41 Perth letter time.
const UTC_DAY_ZERO = "2026-10-17T00:00:00.000Z";
const PERTH_DAY_ZERO = "2026-10-16T16:00:00.000Z";
const LETTER_AT = new Date("2026-11-14T08:41:00Z");
const face = (instant) =>
  `${String(Math.floor((((instant % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}:${String(((instant % 60) + 60) % 60).padStart(2, "0")}`;
const json = (value) => JSON.parse(JSON.stringify(value));

/** A seeded world stored the way the live one was: the same state, day zero at a UTC midnight. */
async function utcWorld() {
  const { seedWorld } = await engine();
  return json({ ...seedWorld(new Date("2026-10-17T02:00:00Z")), dayZero: UTC_DAY_ZERO });
}

/** Every numeric instant in a value, in walk order, so two worlds can be compared pairwise. */
function instants(value, fields, found = []) {
  if (Array.isArray(value)) for (const entry of value) instants(entry, fields, found);
  else if (value && typeof value === "object")
    for (const [key, entry] of Object.entries(value))
      if (fields.has(key) && typeof entry === "number") found.push(entry);
      else instants(entry, fields, found);
  return found;
}

test("the finding: a UTC-midnight day zero reads 8 hours behind Perth whatever the device zone", async () => {
  const { worldNow, dayZeroDriftMinutes } = await engine();
  const world = await utcWorld();
  const now = worldNow(world, LETTER_AT);
  assert.equal(now, 40_841, "the stress test's workspace minute");
  assert.equal(face(now), "08:41", "the letter read 08:41 AWST at 16:41 Perth");
  assert.equal(dayZeroDriftMinutes(world.dayZero), 480);
  assert.equal(dayZeroDriftMinutes("not a date"), null);
});

test("every new world starts on a Perth midnight, at any hour of the Perth day", async () => {
  const { seedWorld, dayZeroDriftMinutes, worldNow } = await engine();
  for (const at of ["2026-11-13T16:00:00Z", "2026-11-14T08:41:00Z", "2026-11-14T15:59:00Z", "2026-11-14T20:00:00Z"]) {
    const world = seedWorld(new Date(at));
    assert.equal(dayZeroDriftMinutes(world.dayZero), 0, at);
    const perth = new Date(Date.parse(at) + 8 * 3_600_000);
    assert.equal(face(worldNow(world, new Date(at))), perth.toISOString().slice(11, 16), at);
  }
});

test("the rebase moves day zero back 480 minutes and every instant forward 480, so real moments stay put", async () => {
  const { rebaseOntoPerthMidnight, worldNow, INSTANT_FIELDS } = await engine();
  const world = await utcWorld();
  const { world: rebased, shiftMinutes } = rebaseOntoPerthMidnight(world);
  assert.equal(shiftMinutes, 480);
  assert.equal(rebased.dayZero, PERTH_DAY_ZERO);
  assert.equal(face(worldNow(rebased, LETTER_AT)), "16:41", "the board now reads Perth time");
  assert.equal(worldNow(rebased, LETTER_AT) - worldNow(world, LETTER_AT), 480);
  const before = instants(world.state, INSTANT_FIELDS);
  const after = instants(rebased.state, INSTANT_FIELDS);
  assert.ok(before.length > 500, `the seed carries many instants (${before.length})`);
  assert.equal(after.length, before.length);
  for (const [index, value] of before.entries()) {
    assert.equal(after[index] - value, 480);
    // History prints day zero + minutes: the same real moment before and after.
    assert.equal(Date.parse(PERTH_DAY_ZERO) + after[index] * 60_000, Date.parse(UTC_DAY_ZERO) + value * 60_000);
  }
  assert.equal(rebased.state.clockOffsetMinutes, world.state.clockOffsetMinutes, "a duration is not moved");
  assert.equal(rebased.state.worldGeneration, world.state.worldGeneration);
  assert.equal(rebased.startedAt, world.startedAt, "a real timestamp is not moved");
});

test("the rebase is a no-op on a Perth world and exactly undone by rebasing back", async () => {
  const { rebaseOntoPerthMidnight, rebaseWorldDayZero, seedWorld } = await engine();
  const perth = json(seedWorld(LETTER_AT));
  const same = rebaseOntoPerthMidnight(perth);
  assert.equal(same.shiftMinutes, 0);
  assert.deepEqual(json(same.world), perth);
  const world = await utcWorld();
  const back = rebaseWorldDayZero(rebaseOntoPerthMidnight(world).world, new Date(UTC_DAY_ZERO));
  assert.equal(back.shiftMinutes, -480);
  assert.deepEqual(json(back.world), world);
  assert.throws(() => rebaseWorldDayZero(world, new Date(Date.parse(UTC_DAY_ZERO) - 30_000)), /whole-minutes/);
});

test("the backend config reader's copy of the time zone matches the app's one setting", async () => {
  const { WARD_TIME_ZONE } = await engine();
  assert.equal(CONFIG_TIME_ZONE, WARD_TIME_ZONE, "change backend/ward-flow/config.mjs with src/lib/ward-time-zone.ts");
  assert.equal(WARD_TIME_ZONE, "Australia/Perth", "AWST is the default (Josh, 14 Nov 2026)");
});

test("the SQL lists exactly the app's instant field names", async () => {
  const { INSTANT_FIELDS } = await engine();
  const sql = readFileSync(PROPOSAL, "utf8");
  const list = /wf_instant_fields\(\)[\s\S]*?ARRAY\[([\s\S]*?)\]::text\[\]/.exec(sql);
  assert.ok(list, "the instant list is in the proposal");
  const names = [...list[1].matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1]);
  assert.deepEqual([...names].sort(), [...INSTANT_FIELDS].sort());
  assert.equal(new Set(names).size, names.length, "no name twice");
  assert.ok(
    !SCHEMA.some((migration) => migration.version >= 19 && /day-zero/.test(migration.file)),
    "held, not a migration",
  );
});

// ---- Real PostgreSQL through psql: the held SQL against the engine's rebase on the real seed. ----

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");
const psqlFound = spawnSync("psql", ["--version"], { encoding: "utf8" }).status === 0;

/**
 * Runs SQL (or `file`) through psql on `database`; returns its output, or throws unless `allowFail`.
 * @param {string} database
 * @param {string} sql
 * @param {Record<string, string>} [variables]
 * @param {{ allowFail?: boolean, file?: string | null }} [options]
 */
function psql(database, sql, variables = {}, { allowFail = false, file = null } = {}) {
  const target = new URL(/** @type {string} */ (url));
  target.pathname = `/${database}`;
  const args = [target.href, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "--single-transaction"];
  for (const [name, value] of Object.entries(variables)) args.push("-v", `${name}=${value}`);
  if (file) args.push("-f", file);
  const run = spawnSync("psql", args, { input: file ? undefined : sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0 && !allowFail) throw new Error(run.stderr);
  return { status: run.status, out: run.stdout.trim(), err: run.stderr };
}

const quote = (value) => `$wfjson$${JSON.stringify(value)}$wfjson$`;

test(
  "real PostgreSQL: the held SQL rebases a stored world exactly as the engine does, once, and rolls back",
  { skip: !url || !psqlFound ? "needs a loopback WARD_TEST_DATABASE_URL and psql" : false, timeout: 120_000 },
  async () => {
    const { rebaseOntoPerthMidnight, rebaseArchivedBody } = await engine();
    const database = `wardflow_rebase_${randomUUID().replaceAll("-", "")}`;
    spawnSync("psql", [String(url), "-X", "-q", "-c", `CREATE DATABASE ${database}`], { encoding: "utf8" });
    try {
      const files = SCHEMA.map((migration) => migration.file);
      assert.ok(files.length >= 18);
      psql(database, files.map((name) => readFileSync(`${MIGRATIONS}${name}`, "utf8")).join("\n"));

      const workspaceId = randomUUID();
      const actor = randomUUID();
      const world = await utcWorld();
      const plan = planSave([], world, 7);
      const closed = world.state.movements.find((movement) => movement.closure);
      assert.ok(closed && /^[A-Za-z0-9-]+$/.test(closed.id), "the seed has a closed movement to archive");
      const scope = "a".repeat(64);
      psql(
        database,
        `INSERT INTO ward_flow.workspaces(id, revision, payload) VALUES ('${workspaceId}', 7, ${quote(plan.core)}::jsonb);
         INSERT INTO ward_flow.workspace_records(workspace_id, collection, record_id, kind, ordinal, revision, body)
           SELECT '${workspaceId}', r.collection, r.record_id, r.kind, r.ordinal, r.revision, r.body
           FROM jsonb_to_recordset(${quote(plan.upserts.map((part) => ({ collection: part.collection, record_id: part.recordId, kind: part.kind, ordinal: part.ordinal, revision: part.revision, body: part.body })))}::jsonb)
           AS r(collection text, record_id text, kind text, ordinal integer, revision bigint, body jsonb);
         INSERT INTO ward_flow.archived_records(workspace_id, world_generation, collection, record_id, closed_at, body, archived_revision)
           VALUES ('${workspaceId}', ${world.state.worldGeneration}, 'movements', '${closed.id}', 39000, ${quote(closed)}::jsonb, 5);
         INSERT INTO ward_flow.forecast_snapshots(workspace_id, world_generation, scope_key, demo_day, taken_at, ready_gap_now, tomorrow_low, tomorrow_likely, tomorrow_high)
           VALUES ('${workspaceId}', 0, '${scope}', 27, 38900, 1, 1, 2, 3);
         INSERT INTO ward_flow.forecast_miss_reasons(workspace_id, world_generation, scope_key, demo_day, reason, chosen_by, chosen_at, actor_id)
           VALUES ('${workspaceId}', 0, '${scope}', 26, 'other', 'coordinator', 38950, '${actor}');`,
      );

      const read = () => {
        const out = psql(
          database,
          `SELECT json_build_object(
             'revision', (SELECT revision FROM ward_flow.workspaces WHERE id='${workspaceId}'),
             'payload', (SELECT payload FROM ward_flow.workspaces WHERE id='${workspaceId}'),
             'rows', (SELECT coalesce(json_agg(json_build_object('collection', collection, 'record_id', record_id, 'kind', kind, 'ordinal', ordinal, 'revision', revision, 'body', body)), '[]') FROM ward_flow.workspace_records WHERE workspace_id='${workspaceId}'),
             'archived', (SELECT json_build_object('closed_at', closed_at, 'body', body, 'archived_revision', archived_revision) FROM ward_flow.archived_records WHERE workspace_id='${workspaceId}'),
             'taken', (SELECT json_build_object('day', demo_day, 'at', taken_at) FROM ward_flow.forecast_snapshots WHERE workspace_id='${workspaceId}'),
             'chosen', (SELECT json_build_object('day', demo_day, 'at', chosen_at) FROM ward_flow.forecast_miss_reasons WHERE workspace_id='${workspaceId}'),
             'audit', (SELECT coalesce(json_agg(changes ORDER BY sequence), '[]') FROM ward_flow.audit WHERE workspace_id='${workspaceId}' AND action='REBASE_DAY_ZERO'))`,
        ).out;
        const value = JSON.parse(out);
        return { ...value, world: assembleWorld(value.payload, value.rows) };
      };
      const original = read();
      assert.deepEqual(json(original.world), world, "the stored world reads back as written");

      // Without an approving account, or as a dry run, nothing changes.
      assert.notEqual(psql(database, "", { dry_run: "off" }, { allowFail: true, file: PROPOSAL }).status, 0);
      const dry = psql(database, "", { actor_id: actor, dry_run: "on" }, { allowFail: true, file: PROPOSAL });
      assert.notEqual(dry.status, 0);
      assert.match(dry.err, /day zero 2026-10-17T00:00:00.000Z -> 2026-10-16T16:00:00.000Z \(instants \+480 min\)/);
      assert.match(dry.err, /Dry run only/);
      assert.deepEqual(read(), original);

      psql(database, "", { actor_id: actor, dry_run: "off" }, { file: PROPOSAL });
      const after = read();
      const expected = rebaseOntoPerthMidnight(world);
      assert.deepEqual(json(after.world), json(expected.world), "the SQL matches the engine's rebase exactly");
      assert.equal(after.revision, 8);
      const moved = after.rows.filter((row) => row.revision === 8).length;
      assert.ok(moved > 0 && moved <= after.rows.length);
      for (const row of after.rows) {
        const before = original.rows.find(
          (old) => old.collection === row.collection && old.record_id === row.record_id,
        );
        assert.equal(row.revision === 8, JSON.stringify(before.body) !== JSON.stringify(row.body), row.record_id);
      }
      assert.equal(after.archived.closed_at, 39_480);
      assert.deepEqual(after.archived.body, json(rebaseArchivedBody("movements", closed, 480)));
      assert.equal(after.archived.archived_revision, 5);
      assert.deepEqual(after.taken, { day: 27, at: 39_380 });
      assert.deepEqual(after.chosen, { day: 26, at: 39_430 });
      assert.equal(after.audit.length, 1);
      assert.equal(after.audit[0].fromDayZero, UTC_DAY_ZERO);
      assert.equal(after.audit[0].toDayZero, PERTH_DAY_ZERO);
      assert.equal(after.audit[0].shiftMinutes, 480);

      // A second run finds a Perth day zero and changes nothing.
      psql(database, "", { actor_id: actor, dry_run: "off" }, { file: PROPOSAL });
      assert.deepEqual(read(), after);

      // Rollback: the same file onto the old day zero restores every stored value.
      psql(database, "", { actor_id: actor, dry_run: "off", rollback_to: UTC_DAY_ZERO }, { file: PROPOSAL });
      const undone = read();
      assert.deepEqual(json(undone.world), world);
      assert.deepEqual(undone.archived.body, json(closed));
      assert.equal(undone.archived.closed_at, 39_000);
      assert.deepEqual(undone.taken, original.taken);
      assert.deepEqual(undone.chosen, original.chosen);
      assert.equal(undone.audit.length, 2);
      assert.equal(undone.audit[1].shiftMinutes, -480);
    } finally {
      spawnSync("psql", [String(url), "-X", "-q", "-c", `DROP DATABASE IF EXISTS ${database}`], { encoding: "utf8" });
    }
  },
);
