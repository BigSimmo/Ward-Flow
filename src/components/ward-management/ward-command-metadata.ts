import type { WardFlowState } from "./ward-flow-reducer";
import type { UndoStepType } from "./ward-undo";

/** Only the identity of this command's new records, never the private Undo snapshots. */
export type WardCommandMetadata = {
  createdReferralId?: string;
  undoStep?: { undoType: UndoStepType; subjectId: string; seq: number };
};

export function commandMetadata(before: WardFlowState, next: WardFlowState): WardCommandMetadata {
  const priorReferrals = new Set(before.referrals.map((row) => row.id));
  const created = next.referrals.filter((row) => !priorReferrals.has(row.id));
  const record = next.undoRecords?.find(
    (row) =>
      row.kind === "step" &&
      row.seq !== undefined &&
      !before.undoRecords?.some((prior) => prior.kind === "step" && prior.seq === row.seq),
  );
  return {
    ...(created.length === 1 ? { createdReferralId: created[0]!.id } : {}),
    ...(record?.kind === "step" && record.seq !== undefined
      ? { undoStep: { undoType: record.undoType, subjectId: record.subjectId, seq: record.seq } }
      : {}),
  };
}
