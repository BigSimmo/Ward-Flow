import type { CommandUndoType, WardCommandMetadata } from "../ward-command-metadata";
import type { WardFlowEvent, WardFlowRole } from "../ward-flow-events";
import type { WardFlowState } from "../ward-flow-reducer";
import type { PatientId } from "../ward-patients";
import { roleLimitReason } from "../ward-role-permissions";
import { undoRoleRefusal, undoWindowRefusal, type UndoRecord } from "../ward-undo";
import { BED_MEETING_ACTION_KINDS } from "../bed-meeting/bed-meeting-actions";

type Subjects = Pick<WardFlowState, "movements" | "referrals" | "admissions">;
// This forwarding surface cannot submit a placement/override command. If an Undo later gains an
// override reason, its construction fails here until that new product decision is reviewed.
type ActivityUndoEvent = Extract<WardFlowEvent, { type: CommandUndoType; overrideReason?: never }>;
type Offer = { event: ActivityUndoEvent; reason?: never } | { event?: never; reason: string };

/** The receipt supplies attribution; the current record, role, sequence and clock supply guards. */
export function activityUndo(
  step: WardCommandMetadata["undoStep"],
  records: readonly UndoRecord[] | undefined,
  subjects: Subjects,
  role: WardFlowRole,
  placeId: string | undefined,
  now: number,
): Offer {
  if (!step) return { reason: "No Undo record is available for this change in the current working role." };
  const record = records?.find(
    (candidate) =>
      candidate.seq === step.seq &&
      (candidate.kind === "step"
        ? candidate.undoType === step.undoType && candidate.subjectId === step.subjectId
        : candidate.kind === "referral-decision"
          ? step.undoType === "UNDO_REFERRAL_DECISION" && candidate.referralId === step.subjectId
          : step.undoType === "UNDO_PLACE_IN_BED" && candidate.admissionId === step.subjectId),
  );
  if (!record) return { reason: "A later change replaced this one, or its Undo record is no longer available." };
  const actingUnitId = role === "ward" ? placeId : undefined;
  const refusal =
    roleLimitReason(role, step.undoType) ??
    undoWindowRefusal(record.at, now) ??
    undoRoleRefusal(record, role, actingUnitId);
  if (refusal) return { reason: refusal };
  const base = { role, now, recordSeq: step.seq, ...(actingUnitId ? { actingUnitId } : {}) };
  if (record.kind === "referral-decision")
    return { event: { ...base, type: "UNDO_REFERRAL_DECISION", referralId: record.referralId } };
  if (record.kind === "bed-placement")
    return { event: { ...base, type: "UNDO_PLACE_IN_BED", admissionId: record.admissionId } };
  const id = record.subjectId;
  const movement = subjects.movements.some((row) => row.id === id);
  const admission = subjects.admissions.some((row) => row.id === id);
  const referral = subjects.referrals.some((row) => row.id === id);
  switch (record.undoType) {
    case "UNDO_REFER_TO_UNITS":
    case "UNDO_ACCEPT_IN_PRINCIPLE":
    case "UNDO_LEGAL_FORM_RECORD":
    case "UNDO_TRANSPORT_STEP":
      if (movement) return { event: { ...base, type: record.undoType, movementId: id } };
      break;
    case "UNDO_SUPPORT_NOTIFICATION":
      if (movement) return { event: { ...base, type: record.undoType, movementId: id } };
      if (admission) return { event: { ...base, type: record.undoType, admissionId: id } };
      break;
    case "UNDO_ED_STEP":
      if (movement) return { event: { ...base, type: record.undoType, movementId: id } };
      if (referral) return { event: { ...base, type: record.undoType, referralId: id } };
      break;
    case "UNDO_REPATRIATION":
    case "UNDO_FLAG_RETURN_EARLY":
    case "UNDO_DEPARTURE":
    case "UNDO_ABSENT_WITHOUT_LEAVE":
      if (admission) return { event: { ...base, type: record.undoType, admissionId: id } };
      break;
    case "UNDO_HANDOVER_SIGN_OFF":
      if (id === "network") return { event: { ...base, type: record.undoType } };
      if (id.startsWith("handover:")) return { event: { ...base, type: record.undoType, unitId: id.slice(9) } };
      break;
    case "UNDO_SITE_HANDOVER_SIGN_OFF":
      if (id.startsWith("site-handover:")) return { event: { ...base, type: record.undoType, siteCode: id.slice(14) } };
      break;
    case "UNDO_BED_STEP": {
      if (id.startsWith("leave:")) return { event: { ...base, type: record.undoType, leaveBedId: id.slice(6) } };
      const bed = /^bed:(.+):(\d+)$/.exec(id);
      if (bed && Number(bed[2]) >= 1)
        return { event: { ...base, type: record.undoType, unitId: bed[1], bedNumber: Number(bed[2]) } };
      break;
    }
    case "UNDO_RELEASE_STEP":
      if (id.startsWith("planned:"))
        return { event: { ...base, type: record.undoType, plannedAdmissionId: id.slice(8) } };
      if (movement) return { event: { ...base, type: record.undoType, movementId: id } };
      break;
    case "UNDO_PATIENT_RECORD":
      if (id.startsWith("patient:PT-"))
        return { event: { ...base, type: record.undoType, patientId: id.slice(8) as PatientId } };
      break;
    case "UNDO_BED_MEETING_ACTION": {
      const kind = BED_MEETING_ACTION_KINDS.find((entry) => id.endsWith(`:${entry.id}`));
      const subjectId = kind ? id.slice(0, -kind.id.length - 1) : "";
      const subjectKind = subjects.movements.some((row) => row.id === subjectId)
        ? "movement"
        : subjects.admissions.some((row) => row.id === subjectId)
          ? "admission"
          : undefined;
      if (kind && subjectKind)
        return {
          event: { ...base, type: record.undoType, subject: { kind: subjectKind, id: subjectId }, action: kind.id },
        };
      break;
    }
  }
  return { reason: "This change's record is no longer available to undo from this desk." };
}
