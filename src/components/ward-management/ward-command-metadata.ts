import type { WardFlowState } from "./ward-flow-reducer";
import type { UndoRecord, UndoStepType } from "./ward-undo";

/** The Undo events a command's own record can be taken back by, as its toast names them. */
export type CommandUndoType = UndoStepType | "UNDO_REFERRAL_DECISION" | "UNDO_PLACE_IN_BED";

/** Only this command's own Undo step identity, never the private Undo snapshots. */
export type WardCommandMetadata = {
  undoStep?: { undoType: CommandUndoType; subjectId: string; seq: number };
};

/** The Undo identity of a record, or undefined for one without a sequence number (older saves). */
function undoIdentity(record: UndoRecord): WardCommandMetadata["undoStep"] {
  if (record.seq === undefined) return undefined;
  if (record.kind === "step") return { undoType: record.undoType, subjectId: record.subjectId, seq: record.seq };
  // H-0246: a ward's Move bed and referral decision toasts send this too, so an older toast's Undo
  // is refused once a newer move or decision replaced its record, on a shared board as well.
  if (record.kind === "referral-decision")
    return { undoType: "UNDO_REFERRAL_DECISION", subjectId: record.referralId, seq: record.seq };
  if (record.kind === "bed-placement")
    return { undoType: "UNDO_PLACE_IN_BED", subjectId: record.admissionId, seq: record.seq };
  return undefined;
}

export function commandMetadata(before: WardFlowState, next: WardFlowState): WardCommandMetadata {
  const priorSeqs = new Set((before.undoRecords ?? []).map((record) => record.seq).filter((seq) => seq !== undefined));
  for (const record of next.undoRecords ?? []) {
    if (record.seq === undefined || priorSeqs.has(record.seq)) continue;
    const undoStep = undoIdentity(record);
    if (undoStep) return { undoStep };
  }
  return {};
}
