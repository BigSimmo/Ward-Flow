// @ts-check
// Master audit M31 (10 Nov 2026): two desks marking one bed meeting action done at once leave one
// outcome and a desk as the owner who did it. The shift-boundary half is in
// tests/ward-audit-m31-meeting-actions-across-shifts.test.ts. Synthetic seed records only.
// The PostgreSQL half runs when WARD_TEST_DATABASE_URL names a loopback server (CI's Postgres job).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

const AT = new Date("2026-10-10T10:00:00Z");

function fixture(engine) {
  const world = engine.seedWorld(AT);
  const admission = world.state.admissions.find((row) => row.state === "occupied");
  assert.ok(admission, "the seed has an occupied stay");
  const subject = { kind: "admission", id: admission.id };
  const record = {
    type: "RECORD_BED_MEETING_ACTION",
    role: "coordinator",
    subject,
    action: "chase_ndis",
    owner: "ward",
    unitId: admission.unitId,
    // Far enough ahead to be later than any clock the store applies.
    dueAt: 10 * 24 * 60,
  };
  const byWard = {
    type: "COMPLETE_BED_MEETING_ACTION",
    role: "ward",
    subject,
    action: "chase_ndis",
    actingUnitId: admission.unitId,
  };
  const byChair = { type: "COMPLETE_BED_MEETING_ACTION", role: "coordinator", subject, action: "chase_ndis" };
  return { world, subject, record, byWard, byChair };
}

function onlyAction(world, subject) {
  const actions = world.state.admissions.find((row) => row.id === subject.id).meetingActions ?? [];
  assert.equal(actions.length, 1, "one action, never a copy");
  return actions[0];
}

test("M31 offline: the second Mark done is refused in either order, and the first desk is kept", async () => {
  const engine = await import("./dist/engine.mjs");
  const { world, subject, record, byWard, byChair } = fixture(engine);
  const recorded = engine.applyCommand(world, { now: 0, ...record }, AT);
  assert.equal(recorded.outcome, "accepted");
  for (const [first, second] of [
    [byWard, byChair],
    [byChair, byWard],
  ]) {
    const one = engine.applyCommand(recorded.world, { now: 0, ...first }, AT);
    assert.equal(one.outcome, "accepted");
    const two = engine.applyCommand(one.world, { now: 0, ...second }, AT);
    assert.notEqual(two.outcome, "accepted", "an action is done once");
    const action = onlyAction(one.world, subject);
    assert.equal(typeof action.doneAt, "number");
    assert.equal(action.doneBy, first.role === "ward" ? "Nurse in charge" : "Bed coordinator");
  }
});

test(
  "M31 real PostgreSQL: two desks marking one action done at once leave one winner",
  { skip: !url, timeout: 60_000 },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 6 });
    pool.on("error", () => {});
    const { subject, record, byWard, byChair } = fixture(engine);
    try {
      await migrate(pool);
      for (let round = 0; round < 3; round++) {
        const workspaceId = randomUUID();
        const actorA = randomUUID();
        const actorB = randomUUID();
        const storeA = createWorkspaceStore(pool, { workspaceId, engine, clock: () => AT });
        const storeB = createWorkspaceStore(pool, { workspaceId, engine, clock: () => AT });
        await storeA.ready();
        const start = (await storeA.read(actorA)).revision;
        const recorded = await storeA.command(actorA, randomUUID(), start, { now: 0, ...record });
        assert.equal(recorded.status, 200, "the chair records the action");
        const revision = recorded.body.snapshot.revision;
        const results = await Promise.all([
          storeA.command(actorA, randomUUID(), revision, { now: 0, ...byWard }),
          storeB.command(actorB, randomUUID(), revision, { now: 0, ...byChair }),
        ]);
        const statuses = results.map((result) => result.status);
        assert.equal(statuses.filter((status) => status === 200).length, 1, `exactly one winner (${statuses})`);
        for (const status of statuses) assert.ok([200, 409, 422].includes(status), `unexpected status ${status}`);
        const action = onlyAction((await storeA.read(actorA)).payload, subject);
        assert.equal(typeof action.doneAt, "number");
        const winner = statuses[0] === 200 ? byWard : byChair;
        assert.equal(action.doneBy, winner.role === "ward" ? "Nurse in charge" : "Bed coordinator");
        const done = (await storeA.audit()).filter(
          (row) => row.action === "COMPLETE_BED_MEETING_ACTION" && row.outcome === "accepted",
        );
        assert.equal(done.length, 1, "one accepted Mark done in the audit");
      }
    } finally {
      await pool.end();
    }
  },
);
