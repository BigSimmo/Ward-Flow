import assert from "node:assert/strict";
import { test } from "node:test";
import { ownCommandReceipt } from "./own-command-receipt.mjs";

const step = { undoType: "UNDO_ED_STEP", subjectId: "WF-SYNTHETIC", seq: 9 };
const row = {
  status: 200,
  result: { outcome: "accepted", commandRevision: 4, undoStep: step, receiptAccessContext: "desk-a", error: "private" },
};

test("a command receipt exposes only its outcome and the exact current desk's Undo identity", () => {
  assert.deepEqual(ownCommandReceipt(row, "desk-a", true), { outcome: "accepted", commandRevision: 4, undoStep: step });
  for (const context of ["desk-b", null, undefined])
    assert.deepEqual(ownCommandReceipt(row, context, true), { outcome: "accepted", commandRevision: 4 });
  assert.deepEqual(ownCommandReceipt(row, "desk-a", false), { outcome: "accepted", commandRevision: 4 });
  assert.equal(ownCommandReceipt(undefined, "desk-a", true), null);
});

test("refused and malformed receipts cannot offer an Undo", () => {
  assert.deepEqual(ownCommandReceipt({ ...row, status: 409 }, "desk-a", true), {
    outcome: "refused",
    commandRevision: 4,
  });
  for (const undoStep of [
    { ...step, seq: -1 },
    { ...step, subjectId: "" },
    { ...step, undoType: "DELETE_ALL" },
  ])
    assert.deepEqual(ownCommandReceipt({ ...row, result: { ...row.result, undoStep } }, "desk-a", true), {
      outcome: "accepted",
      commandRevision: 4,
    });
});
