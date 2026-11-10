// @ts-check
// Compound drill 6 (master audit list item 7, 10 Nov 2026), server half: a save whose reply is
// lost, plus a Retry, plus another desk's Undo of the same record before the Retry lands. Real
// loopback HTTP and PostgreSQL; two backend processes stand in for two desks' servers. The client
// half is tests/ward-audit-drill-6-lost-reply-retry-undo.dom.test.tsx. Synthetic data only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { drillDatabaseUrl, drillFixture } from "./ward-audit-drill.test-support.mjs";

const stateOf = (snapshot, id) => snapshot.payload.state.admissions.find((row) => row.id === id)?.state;

test(
  "real PostgreSQL HTTP: a Retry after another desk's Undo replays the kept receipt and never re-applies",
  { skip: !drillDatabaseUrl, timeout: 60_000 },
  async (t) => {
    const f = await drillFixture(t, { actors: 2 });
    const [deskA, deskB] = f.actors;
    const one = await f.startBackend();
    const two = await f.startBackend();
    let board = (await f.request(one.base, deskA)).body.snapshot;
    const movement = board.payload.state.movements.find((row) => row.id === "WF-011");
    assert.ok(movement, "the seeded synthetic journey");
    const setup = await f.request(
      one.base,
      deskA,
      f.command({ type: "RECORD_TRANSPORT_NEED", movementId: movement.id, needed: false }, board.revision),
    );
    assert.equal(setup.status, 200);
    board = setup.body.snapshot;

    // Desk A records the arrival. It commits, but desk A never reads the reply.
    const arrival = f.command({ type: "PATIENT_ARRIVED", movementId: movement.id }, board.revision);
    const lost = await f.request(one.base, deskA, arrival);
    assert.equal(lost.status, 200);
    const arrivedRevision = lost.body.commandRevision ?? lost.body.snapshot.revision;
    assert.equal(stateOf(lost.body.snapshot, movement.admissionId), "occupied");

    // Desk B, on the other server, undoes that arrival before desk A's Retry lands.
    const seenByB = (await f.request(two.base, deskB)).body.snapshot;
    const undo = await f.request(
      two.base,
      deskB,
      f.command({ type: "UNDO_TRANSPORT_STEP", movementId: movement.id }, seenByB.revision),
    );
    assert.equal(undo.status, 200, undo.body?.error);
    assert.notEqual(stateOf(undo.body.snapshot, movement.admissionId), "occupied");
    const afterUndo = undo.body.snapshot.revision;

    // Desk A presses Retry: the same command identity and body, sent again.
    const retried = await f.request(one.base, deskA, arrival);
    assert.equal(retried.status, 200);
    assert.equal(retried.body.replayed, true, "the kept receipt is replayed");
    assert.equal(retried.body.commandRevision ?? arrivedRevision, arrivedRevision);
    // The replay carries today's board: the Undo stands, the arrival is not applied again.
    assert.equal(retried.body.snapshot.revision, afterUndo);
    assert.notEqual(stateOf(retried.body.snapshot, movement.admissionId), "occupied");

    // An independent read on the other server agrees, and the arrival has exactly one receipt.
    const reread = (await f.request(two.base, deskB)).body.snapshot;
    assert.equal(reread.revision, afterUndo);
    assert.notEqual(stateOf(reread, movement.admissionId), "occupied");
    const kept = (await f.receipts()).filter((row) => row.id === arrival.commandId);
    assert.deepEqual(kept, [{ id: arrival.commandId, status: 200 }]);
    assert.ok(f.engine.validWorld(reread.payload));
  },
);

test(
  "real PostgreSQL HTTP: a second Retry racing the first still gives one receipt and one revision",
  { skip: !drillDatabaseUrl, timeout: 60_000 },
  async (t) => {
    const f = await drillFixture(t, { actors: 1 });
    const [desk] = f.actors;
    const one = await f.startBackend();
    const two = await f.startBackend();
    const board = (await f.request(one.base, desk)).body.snapshot;
    const unitId = board.payload.state.units[0].id;
    const save = f.command({ type: "REQUEST_CAPACITY_REFRESH", unitId }, board.revision);
    // The first send and two Retries arrive at both servers at once.
    const answers = await Promise.all([
      f.request(one.base, desk, save),
      f.request(two.base, desk, save),
      f.request(one.base, desk, save),
    ]);
    for (const answer of answers) assert.equal(answer.status, 200, JSON.stringify(answer.body));
    assert.equal(answers.filter((answer) => answer.body.replayed !== true).length, 1, "exactly one first answer");
    const after = (await f.request(two.base, desk)).body.snapshot;
    assert.equal(after.revision, board.revision + 1, "applied once");
    assert.deepEqual(
      (await f.receipts()).filter((row) => row.id === save.commandId),
      [{ id: save.commandId, status: 200 }],
    );
  },
);
