// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";

import { planSave } from "./records.mjs";

/** Save rows keep their bodies, just as the immutable engine's unchanged records do. */
function storedFrom(plan) {
  return plan.upserts.map((part) => ({
    collection: part.collection,
    record_id: part.recordId,
    kind: part.kind,
    ordinal: part.ordinal,
    revision: part.revision,
    body: part.body,
  }));
}

test("planning a save does not traverse an unchanged record body", () => {
  let reads = 0;
  const unchanged = {
    id: "synthetic-unchanged",
    get details() {
      reads++;
      return { nested: ["synthetic", "unchanged"] };
    },
  };
  const world = { version: 1, state: { patients: [unchanged, { id: "synthetic-changed", value: 1 }] } };
  const initial = planSave([], world, 1);
  const rows = storedFrom(initial);
  const changed = {
    ...world,
    state: { patients: [unchanged, { id: "synthetic-changed", value: 2 }] },
  };
  reads = 0;
  const plan = planSave(rows, changed, 2, initial.core);
  assert.equal(reads, 0, "unchanged content must not be walked or serialized");
  assert.deepEqual(
    plan.upserts.map((part) => part.recordId),
    ["synthetic-changed"],
  );
  assert.equal(plan.upserts[0].revision, 2);
  assert.deepEqual(plan.deletes, []);
});

test("shared and distinct record references produce equivalent save plans", () => {
  const first = { id: "synthetic-one", details: { a: 1, b: [2, 3] } };
  const second = { id: "synthetic-two", details: { a: 4, b: [5, 6] } };
  const world = { version: 1, state: { patients: [first, second], statuses: { first: "booked" }, sequence: 2 } };
  const initial = planSave([], world, 7);
  const rows = storedFrom(initial);
  const states = [
    world.state,
    { ...world.state, patients: [first, { ...second, details: { a: 9, b: [5, 6] } }] },
    { ...world.state, patients: [second, first] },
    { ...world.state, patients: [first], statuses: { first: "arrived" }, sequence: 3 },
    { ...world.state, patients: [first, second, { id: "synthetic-three", details: { a: 8, b: [] } }] },
  ];
  for (const state of states) {
    const changed = { ...world, state };
    const plan = planSave(rows, changed, 8, initial.core);
    const distinct = planSave(structuredClone(rows), structuredClone(changed), 8, structuredClone(initial.core));
    assert.deepEqual(plan, distinct);
  }
});

test("distinct references retain canonical JSON equality and existing primitive semantics", () => {
  const cases = [
    [{ a: 1, b: [2, 3] }, { b: [2, 3], a: 1 }, false],
    [{ a: 1 }, { a: 2 }, true],
    [NaN, null, false],
    [Infinity, null, false],
    [-0, 0, false],
    [undefined, undefined, false],
    [null, undefined, true],
    [true, 1, true],
    [[undefined], [null], false],
  ];
  for (const [before, after, changed] of cases) {
    const world = { version: 1, state: { values: { sample: before } } };
    const initial = planSave([], world, 1);
    const plan = planSave(storedFrom(initial), { ...world, state: { values: { sample: after } } }, 2, initial.core);
    assert.equal(plan.upserts.length, changed ? 1 : 0);
    assert.deepEqual(plan.deletes, []);
  }
});
