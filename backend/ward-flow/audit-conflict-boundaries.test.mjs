import { test } from "node:test";
import assert from "node:assert/strict";
import { planSave, conflictingCollection, assembleWorld } from "./records.mjs";

function store(plan) {
  return plan.upserts.map(({ recordId, ...row }) => ({ ...row, record_id: recordId }));
}
const receipt = (i) => ({ kind: "step", undoType: "UNDO_RECORD_BLOCKER", subjectId: `m-${i}`, seq: i, changes: [] });
function world(history = []) {
  return {
    state: {
      worldGeneration: 1,
      movements: [
        { id: "A", value: 0 },
        { id: "B", value: 1 },
      ],
      undoRecords: history,
    },
  };
}
function check(before, after, event, revision = 2) {
  const plan = planSave([], before, 1);
  const rows = store(plan);
  for (const row of rows) row.revision = revision;
  // A was unchanged since this form opened. The unrelated B and history are newer.
  rows.find((row) => row.collection === "movements" && row.record_id === "A").revision = 1;
  assert.deepEqual(assembleWorld(plan.core, rows), before);
  return conflictingCollection({
    stored: rows,
    core: plan.core,
    before,
    after,
    event,
    expectedRevision: 1,
    priorRevision: revision,
  });
}
test("prose equal to another id never creates a dependency, but actual references do", () => {
  const before = world();
  const after = structuredClone(before);
  after.state.movements[0].value = 2;
  assert.equal(check(before, after, { type: "RECORD_BLOCKER", movementId: "A", reason: "B" }), null);
  assert.equal(check(before, after, { type: "RECORD_BLOCKER", movementId: "A", reason: "mention B here" }), null);
  for (const reference of [
    { movementId: "B" },
    { unitIds: ["B"] },
    { payload: { sourceAdmissionId: "B" } },
    // Review of #1437: fields outside the explicit list still name records.
    { receivingUnitId: "B" },
    { noticeIds: ["B"] },
    { exceptMovementId: "B" },
    { requestId: "B" },
    { contactId: "B" },
    { serviceId: "B" },
  ])
    assert.equal(check(before, after, { type: "TEST", ...reference }), "movements");
  const staleTarget = structuredClone(before);
  staleTarget.state.movements[1].value = 5;
  assert.equal(check(before, staleTarget, { type: "TEST", movementId: "B" }), "movements");
  assert.equal(check(before, staleTarget, { type: "TEST", movementId: "B" }, 1), null);
});
for (const count of [49, 50])
  test(`unrelated retention at ${count} receipts does not invalidate a held form`, () => {
    const before = world(Array.from({ length: count }, (_, i) => receipt(i)));
    const after = structuredClone(before);
    after.state.movements[0].value++;
    after.state.undoRecords = [...before.state.undoRecords, receipt(100)].slice(-50);
    assert.equal(check(before, after, { type: "RECORD_BLOCKER", movementId: "A" }), null);
    // Genuine target changes still conflict.
    after.state.movements[1].value++;
    assert.equal(check(before, after, { type: "RECORD_BLOCKER", movementId: "B" }), "movements");
  });
test("explicit Undo and same-subject replacement remain checked", () => {
  const before = world(Array.from({ length: 50 }, (_, i) => receipt(i)));
  const after = structuredClone(before);
  after.state.undoRecords = [...before.state.undoRecords.slice(1), receipt(100)];
  assert.equal(check(before, after, { type: "UNDO_RECORD_BLOCKER", movementId: "A" }), "undoRecords");
  after.state.undoRecords = [...before.state.undoRecords.slice(1), { ...receipt(0), seq: 100 }];
  assert.equal(check(before, after, { type: "RECORD_BLOCKER", movementId: "A" }), "undoRecords");
});

for (const initialCount of [0, 20])
  for (const intervening of [49, 50])
    test(`real held command after ${intervening} unrelated saves, ${initialCount} initial receipts`, async () => {
      const engine = await import("./dist/engine.mjs");
      const at = new Date("2026-11-04T10:00:00Z");
      let before = engine.seedWorld(at);
      const stays = before.state.admissions.filter((stay) => stay.state === "occupied");
      assert.ok(stays.length > intervening + initialCount);
      const target = stays[0];
      const change = (stay, value) => ({
        type: "UPDATE_EXPECTED_DISCHARGE",
        role: "coordinator",
        admissionId: stay.id,
        expectedDischargeAt: value,
      });
      for (const stay of stays.slice(1, initialCount + 1)) {
        const applied = engine.applyCommand(before, change(stay, 3000), at);
        assert.equal(applied.outcome, "accepted");
        before = applied.world;
      }
      let plan = planSave([], before, 1);
      let rows = store(plan),
        core = plan.core;
      for (const [index, stay] of stays.slice(initialCount + 1, initialCount + intervening + 1).entries()) {
        const applied = engine.applyCommand(before, change(stay, 3000), at);
        assert.equal(applied.outcome, "accepted");
        before = applied.world;
        plan = planSave(rows, before, index + 2, core);
        const keys = new Map(rows.map((row) => [`${row.collection}/${row.record_id}`, row]));
        for (const row of plan.deletes) keys.delete(`${row.collection}/${row.recordId}`);
        for (const row of store(plan)) keys.set(`${row.collection}/${row.record_id}`, row);
        rows = [...keys.values()];
        core = plan.core;
      }
      const event = change(target, 3500);
      const applied = engine.applyCommand(before, event, at);
      assert.equal(applied.outcome, "accepted");
      assert.deepEqual(assembleWorld(core, rows), before);
      assert.equal(
        conflictingCollection({
          stored: rows,
          core,
          before,
          after: applied.world,
          event,
          expectedRevision: 1,
          priorRevision: intervening + 1,
        }),
        null,
      );
    });
