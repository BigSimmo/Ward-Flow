import type { WardFlowState } from "./ward-flow-reducer";
import type { UndoStepType } from "./ward-undo";

/** Only this command's own Undo step identity, never the private Undo snapshots. */
export type WardCommandMetadata = {
  undoStep?: { undoType: UndoStepType; subjectId: string; seq: number };
};

export function commandMetadata(before: WardFlowState, next: WardFlowState): WardCommandMetadata {
  const record = next.undoRecords?.find(
    (row) =>
      row.kind === "step" &&
      row.seq !== undefined &&
      !before.undoRecords?.some((prior) => prior.kind === "step" && prior.seq === row.seq),
  );
  return {
    ...(record?.kind === "step" && record.seq !== undefined
      ? { undoStep: { undoType: record.undoType, subjectId: record.subjectId, seq: record.seq } }
      : {}),
  };
}
