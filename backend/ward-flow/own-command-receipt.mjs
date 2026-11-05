// @ts-check
/** Receipt detail is an attribution, never an authorisation to undo. The command path rechecks it. */
const UNDO_TYPES = new Set([
  "UNDO_REFERRAL_DECISION",
  "UNDO_PLACE_IN_BED",
  "UNDO_REFER_TO_UNITS",
  "UNDO_ACCEPT_IN_PRINCIPLE",
  "UNDO_LEGAL_FORM_RECORD",
  "UNDO_SUPPORT_NOTIFICATION",
  "UNDO_REPATRIATION",
  "UNDO_FLAG_RETURN_EARLY",
  "UNDO_HANDOVER_SIGN_OFF",
  "UNDO_SITE_HANDOVER_SIGN_OFF",
  "UNDO_ED_STEP",
  "UNDO_TRANSPORT_STEP",
  "UNDO_DEPARTURE",
  "UNDO_ABSENT_WITHOUT_LEAVE",
  "UNDO_BED_MEETING_ACTION",
  "UNDO_BED_STEP",
  "UNDO_RELEASE_STEP",
  "UNDO_PATIENT_RECORD",
]);

/** @param {any} row @param {string | null | undefined} context @param {boolean} sameActor */
export function ownCommandReceipt(row, context, sameActor) {
  if (!row) return null;
  const result = row.result ?? {};
  const outcome = row.status === 200 ? (result.outcome === "partly" ? "partly" : "accepted") : "refused";
  const step = result.undoStep;
  const attributable =
    sameActor &&
    outcome !== "refused" &&
    typeof context === "string" &&
    result.receiptAccessContext === context &&
    UNDO_TYPES.has(step?.undoType) &&
    typeof step.subjectId === "string" &&
    step.subjectId.length > 0 &&
    step.subjectId.length <= 256 &&
    Number.isSafeInteger(step.seq) &&
    step.seq >= 1;
  return {
    outcome,
    commandRevision: result.commandRevision,
    ...(attributable ? { undoStep: { undoType: step.undoType, subjectId: step.subjectId, seq: step.seq } } : {}),
  };
}
