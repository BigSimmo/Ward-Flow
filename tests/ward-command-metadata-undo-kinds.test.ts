import { describe, expect, it } from "vitest";

import { commandMetadata } from "@/components/ward-management/ward-command-metadata";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardCommandUndoSeq } from "@/components/ward-management/ward/use-ward-command-completion";
import type { UndoRecord } from "@/components/ward-management/ward-undo";

// H-0246 (27 Oct 2026), shared-board half: a scoped desk gets no Undo records back, so a ward's Move
// bed and referral decision toasts read their record's number from the command's own metadata.
// Synthetic records only.
const decision = { kind: "referral-decision", referralId: "RF-990", seq: 7 } as unknown as UndoRecord;
const placement = { kind: "bed-placement", admissionId: "AD-990", seq: 9 } as unknown as UndoRecord;
const legacy = { kind: "bed-placement", admissionId: "AD-991" } as unknown as UndoRecord;
const state = (undoRecords: UndoRecord[]) => ({ undoRecords }) as unknown as WardFlowState;

describe("command metadata for decision and bed move records", () => {
  it("names a new referral decision record", () => {
    expect(commandMetadata(state([]), state([decision]))).toEqual({
      undoStep: { undoType: "UNDO_REFERRAL_DECISION", subjectId: "RF-990", seq: 7 },
    });
  });

  it("names a new bed move record, and the ward toast reads its number", () => {
    const metadata = commandMetadata(state([decision]), state([decision, placement]));
    expect(metadata).toEqual({ undoStep: { undoType: "UNDO_PLACE_IN_BED", subjectId: "AD-990", seq: 9 } });
    const outcome = { commandId: "c", status: "accepted" as const, ...metadata };
    expect(wardCommandUndoSeq(outcome, "UNDO_PLACE_IN_BED", "AD-990")).toBe(9);
    expect(wardCommandUndoSeq(outcome, "UNDO_PLACE_IN_BED", "AD-other")).toBeUndefined();
    expect(wardCommandUndoSeq(outcome, "UNDO_REFERRAL_DECISION", "AD-990")).toBeUndefined();
  });

  it("names nothing for an old record or one without a number", () => {
    expect(commandMetadata(state([decision]), state([decision]))).toEqual({});
    expect(commandMetadata(state([]), state([legacy]))).toEqual({});
  });
});
