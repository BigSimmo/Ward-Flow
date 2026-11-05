import { describe, expect, it } from "vitest";
import { sheetBasis, type SheetSeen } from "@/components/ward-management/ward-shared-pending-command";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { redactTypedTextForDevice } from "@/components/ward-management/ward-flow-typed-text-scrub";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { withUndoRecord } from "@/components/ward-management/ward-undo";
import { TYPED_TEXT_FIXTURES } from "./helpers/ward-typed-text-fixtures";

describe("held-view common knowledge", () => {
  it.each([false, true])("preserves common proof regardless of dialog order (%s)", (reverse) => {
    const inline = {},
      dialog = {};
    const knowledge = new WeakMap<object, SheetSeen>([
      [inline, { revision: 1, records: new Map([["blocker", 3]]) }],
      [dialog, { revision: 3, records: new Map() }],
    ]);
    expect(sheetBasis(knowledge, reverse ? [dialog, inline] : [inline, dialog])).toEqual({
      revision: 1,
      records: { blocker: 3 },
    });
    const uninformed = {};
    knowledge.set(uninformed, { revision: 1, records: new Map() });
    expect(sheetBasis(knowledge, [dialog, inline, uninformed])).toEqual({ revision: 1, records: {} });
  });
});

describe("fresh-import generic Undo persistence", () => {
  it("scrubs a blocker copied by a later undoable action, with no session ledger", () => {
    const fixture = TYPED_TEXT_FIXTURES.find((entry) => entry.type === "RECORD_MOVEMENT_BLOCKER")!;
    const { before, event } = fixture.build(seedWardFlowState());
    const live = wardFlowReducer(before, event);
    const movement = live.movements.find((row) => row.id === (event as { movementId: string }).movementId)!;
    live.undoRecords = withUndoRecord(live.undoRecords, {
      kind: "step",
      undoType: "UNDO_LEGAL_FORM_RECORD",
      action: "RECORD_LEGAL_FORM_RECEIVED",
      unitId: null,
      subjectId: movement.id,
      role: "coordinator",
      at: NOW_ANCHOR,
      seq: 999,
      changes: [{ slice: "movements", mode: "id", id: movement.id, index: 0, before: movement, after: movement }],
    } as Parameters<typeof withUndoRecord>[1]);
    const imported = JSON.parse(JSON.stringify(live));
    const copy = redactTypedTextForDevice(imported, [], () => [seedWardFlowState()], true);
    expect(copy).not.toBeNull();
    for (const marker of fixture.markers) expect(JSON.stringify(copy)).not.toContain(marker);
    expect(isValidStoredWardFlowState(copy)).toBe(true);
  });
  it.each((["id", "whole", "append"] as const).flatMap((mode) => [false, true].map((typed) => ({ mode, typed }))))(
    "keeps validity in $mode snapshots with typed contact=$typed",
    ({ mode, typed }) => {
      const live = seedWardFlowState();
      const referral = live.referrals.find((row) => row.id === "RF-009")!;
      expect(referral.intake).toBeDefined();
      const row = structuredClone(referral);
      if (typed) row.intake!.referrer.phone = "Synthetic contact marker 7kq";
      const change =
        mode === "id"
          ? { slice: "referrals", mode, id: row.id, index: 0, before: row, after: row }
          : mode === "whole"
            ? { slice: "referrals", mode, before: [row], after: [row] }
            : { slice: "referrals", mode, start: 0, rows: [row] };
      live.undoRecords = withUndoRecord([], {
        kind: "step",
        undoType: "UNDO_ED_STEP",
        action: "RECORD_MEDICAL_CLEARANCE",
        unitId: null,
        subjectId: row.id,
        role: "coordinator",
        at: NOW_ANCHOR,
        seq: 999,
        changes: [change],
      } as Parameters<typeof withUndoRecord>[1]);
      const copy = redactTypedTextForDevice(JSON.parse(JSON.stringify(live)), [], () => [seedWardFlowState()], true);
      expect(copy).not.toBeNull();
      expect(isValidStoredWardFlowState(copy)).toBe(true);
      if (typed) expect(JSON.stringify(copy!.undoRecords)).not.toContain("Synthetic contact marker 7kq");
      else expect(JSON.stringify(copy!.undoRecords)).toContain(JSON.stringify(referral.intake));
      expect(copy!.referrals).toEqual(live.referrals);
    },
  );
});
