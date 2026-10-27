// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { LATEST_MIGRATION } from "./migrations.mjs";
import { RECORD_DETAIL_FIELDS, recordDetailOf, withoutRecordDetail } from "./record-detail.mjs";

// H-0731 (Josh, 27 Oct 2026): no desk's board carries the detail no list shows; the server sends
// it for one record only with an opening it has logged.

test("a board is sent without the record detail, and the world it came from is unchanged", () => {
  const world = {
    version: 1,
    state: {
      patients: [
        { id: "PT-SYN-1", givenName: "Ada", address: "No. 7, Ashfield", interpreterLanguage: "Greek" },
        { id: "PT-SYN-2", givenName: "Bo" },
      ],
    },
  };
  const sent = withoutRecordDetail(world);
  assert.deepEqual(sent.state.patients, [
    { id: "PT-SYN-1", givenName: "Ada" },
    { id: "PT-SYN-2", givenName: "Bo" },
  ]);
  assert.equal(sent.state.patients[1], world.state.patients[1], "a patient with no detail is shared, not copied");
  assert.equal(world.state.patients[0].address, "No. 7, Ashfield");
  const bare = { state: { patients: [{ id: "PT-SYN-2" }] } };
  assert.equal(withoutRecordDetail(bare), bare);
});

test("the detail of one patient names only the detail fields it holds", () => {
  assert.deepEqual(recordDetailOf({ id: "PT-SYN-1", address: "No. 7", givenName: "Ada" }), { address: "No. 7" });
  assert.deepEqual(recordDetailOf(undefined), {});
  assert.deepEqual([...RECORD_DETAIL_FIELDS], ["address", "interpreterLanguage"]);
});

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

test("real PostgreSQL: the detail is sent only with a logged record opening", { skip: !url }, async (t) => {
  const engine = await import("./dist/engine.mjs");
  const pool = new Pool({ connectionString: url, max: 4 });
  const workspaceId = randomUUID();
  const at = new Date("2026-10-20T10:00:00Z");
  const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => new Date(at) });
  const view = {
    version: LATEST_MIGRATION,
    actorId: randomUUID(),
    membershipId: null,
    access: { role: "coordinator", scope: { kind: "statewide" } },
    grants: [],
  };
  try {
    await migrate(pool);
    await store.ready();
    const board = await store.read(view.actorId, view);
    const patients = board.payload.state.patients;
    /** @type {{ id: string, detail: Record<string, string> } | undefined} */
    let stored;
    for (const field of RECORD_DETAIL_FIELDS)
      assert.ok(
        patients.every((patient) => !(field in patient)),
        `no patient on the board carries ${field}`,
      );
    await t.test("an opening is logged and sends that patient's detail", async () => {
      for (const patient of patients) {
        const answer = await store.logView(view, patient.id, "patient");
        assert.equal(answer.status, 200);
        assert.equal(answer.body.logged, true);
        assert.equal(answer.body.opened, patient.id);
        if (typeof answer.body.detail.address !== "string") continue;
        stored = { id: patient.id, detail: answer.body.detail };
        break;
      }
      assert.ok(stored, "the seeded workspace records an address");
    });
    await t.test("a repeat within the minute is not logged again but still sends it", async () => {
      if (!stored) return;
      const answer = await store.logView(view, stored.id, "patient");
      assert.equal(answer.body.logged, false);
      assert.deepEqual(answer.body.detail, stored.detail);
    });
    await t.test("a movement page sends its patient's detail", async () => {
      const movement = board.payload.state.movements.find((candidate) => candidate.patientId === stored?.id);
      if (!movement) return;
      const answer = await store.logView(view, movement.id, "movement");
      assert.equal(answer.body.opened, stored?.id);
      assert.deepEqual(answer.body.detail, stored?.detail);
    });
    await t.test("an account at its limit is sent nothing for a new record", async () => {
      view.actorId = randomUUID();
      await pool.query(
        "INSERT INTO ward_flow.record_access(workspace_id, actor_id, actor_role, actor_scope, patient_id, surface, viewed_at) SELECT $1,$2,'coordinator',$3,'PT-SYN-LIMIT-' || n,'patient',$4 FROM generate_series(1,60) AS n",
        [workspaceId, view.actorId, view.access.scope, at],
      );
      const answer = await store.logView(view, patients[0].id, "patient");
      assert.deepEqual(answer.body, { logged: false });
    });
  } finally {
    await pool.end();
  }
});
