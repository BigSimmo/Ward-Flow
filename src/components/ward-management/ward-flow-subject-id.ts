import type { WardFlowEvent } from "./ward-flow-events";
import { PATIENT_RECORD_UNDO_TYPES, undoStepSubjectId } from "./ward-undo";

/*
 * Moved out of ward-flow-reducer.ts unchanged (19 Oct 2026) to keep the reducer under its line cap
 * (eslint-rules/max-lines-baseline.mjs). Every event that is not about one movement names its
 * subject here, so a rejection is filed against the right record.
 */

/**
 * The subject a step and its Undo are filed against (Tier 1 item 6, 4 Nov 2026). A community
 * treatment order or an archive is filed against its patient record, read here because this file is
 * on the archived D-14 allowlist; every other step keeps `undoStepSubjectId`.
 */
export function stepUndoSubjectId(event: object): string {
  const fields = event as { type?: unknown; patientId?: unknown };
  if (
    typeof fields.type === "string" &&
    PATIENT_RECORD_UNDO_TYPES.has(fields.type) &&
    typeof fields.patientId === "string" &&
    fields.patientId.length > 0
  )
    return `patient:${fields.patientId}`;
  return undoStepSubjectId(event);
}

/** The id a rejection is filed against, for events that are not about one specific movement. */
export function subjectId(event: WardFlowEvent): string {
  switch (event.type) {
    case "RECORD_PATIENT_DISCHARGE":
    case "RECORD_ADMISSION_CARE":
    case "RECORD_ADMISSION_FOLLOW_UP":
    case "OPEN_DISCHARGE_RECORD":
    case "REVIEW_AUDIT_EVENT":
    case "UNDO_AUDIT_REVIEW":
    case "SET_CONFIGURATION":
      return "none";
    // v10 pass 2: undo and Bed board placement name the referral or the stay they act on.
    case "UNDO_REFERRAL_DECISION":
      return event.referralId;
    case "PLACE_IN_BED":
    case "UNDO_PLACE_IN_BED":
      return event.admissionId;
    // v10 pass 3: a step undo is filed against the subject it names; a handover sign-off has none.
    case "UNDO_REPATRIATION":
    case "UNDO_FLAG_RETURN_EARLY":
    case "UNDO_DEPARTURE":
    case "UNDO_ABSENT_WITHOUT_LEAVE":
    case "UNDO_BED_STEP":
    case "UNDO_RELEASE_STEP":
    case "UNDO_PATIENT_RECORD":
    case "UNDO_ED_STEP":
    case "UNDO_SUPPORT_NOTIFICATION":
      return stepUndoSubjectId(event);
    case "UNDO_HANDOVER_SIGN_OFF":
      return "none";
    // Q61 (31 Oct 2026): a site handover sign-off and its Undo are filed against the site.
    case "RECORD_SITE_HANDOVER_SIGN_OFF":
    case "UNDO_SITE_HANDOVER_SIGN_OFF":
      return event.siteCode;
    case "RAISE_REFERRAL":
      // D-76: a journey from an accepted community referral starts at no ED; its ward is the subject.
      return event.edId ?? event.acceptedUnitId ?? "none";
    case "CONFIRM_CAPACITY":
    case "RECORD_WARD_INTAKE_CONSTRAINTS":
    case "SET_INTAKE_WINDOW":
    case "CLOSE_WARD_TO_ADMISSIONS":
    case "REOPEN_WARD_TO_ADMISSIONS":
    case "MARK_WARD_READY_FOR_NEXT":
    case "SET_BED_CLOSED":
    case "FLAG_BED_RELEASE":
    case "RECORD_LEAVE_BED":
    case "REQUEST_CAPACITY_REFRESH":
    case "CONFIRM_MORNING_ROLLUP":
    case "SEND_WARD_BUZZ":
      return event.unitId;
    case "CONFIRM_BED_RELEASE":
    case "REVERT_BED_RELEASE":
    case "BLOCK_BED_RELEASE":
    case "CLEAR_BED_RELEASE_BLOCK":
    case "SET_BED_PREPARATION":
    case "SEND_RELEASE_SUPPORT_NOTICE":
    case "RECORD_DISCHARGE_DEPENDENCY":
    case "RECORD_DISCHARGE_PLAN_CHANGE":
      return event.releaseId;
    // Admission-scoped: an admission id is not a unit or release id, so these keep their own group.
    case "RECORD_LEAVING":
    case "MARK_TRANSPORT_COLLECTED":
    case "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT":
    case "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT":
    case "RECORD_STAY_DISCHARGE_BLOCKER":
    case "CLEAR_STAY_DISCHARGE_BLOCKER":
    case "RECORD_REPATRIATION":
      return event.admissionId;
    case "END_LEAVE_BED":
      return event.leaveBedId;
    case "RECORD_ABSENT_WITHOUT_LEAVE":
    case "RECORD_ABSENCE_STEP":
      return event.admissionId;
    case "RECORD_COMMUNITY_TREATMENT_ORDER":
    case "END_COMMUNITY_TREATMENT_ORDER":
    case "ARCHIVE_PATIENT":
    case "RECORD_CARE_PLAN":
    case "RECORD_TRIBUNAL_HEARING":
    case "RECORD_TRIBUNAL_OUTCOME":
    case "SET_CULTURAL_SUPPORT_REQUEST":
      return event.patientId;
    // Triage and risk (7 Nov 2026): a signed triage is filed against its person. A malformed one
    // (no person named) is refused, and its rejection must not carry an `undefined` subject.
    case "RECORD_TRIAGE_SIGNED":
      return typeof event.patientId === "string" ? event.patientId : "none";
    case "ACCEPT_REFERRAL":
    case "HOLD_REFERRAL_BED":
    case "DECLINE_REFERRAL":
    case "RECORD_LOCAL_BED_SOUGHT":
    // Referral-scoped with no `movementId`: the `default` branch would stamp a rejection whose
    // subject is `undefined`.
    case "RECORD_REFERRER_WITHDRAWAL":
    // RB7: referral-scoped too, carrying `referralId` and no `movementId`.
    case "ADD_REFERRAL_CORRECTION":
    case "FLAG_REFERRAL_TURNAROUND_PRIORITY":
    case "MARK_REFERRAL_OPENED":
    case "REQUEST_REFERRAL_INFORMATION":
    case "MARK_REFERRAL_INFORMATION_MET":
    case "ASSIGN_REFERRAL":
    case "LOG_REFERRAL_CONTACT":
    case "RECORD_REFERRAL_COMMITMENT":
    case "ASK_MORE_WARDS":
      return event.referralId;
    case "RECORD_BED_MEETING_ACTION":
    case "COMPLETE_BED_MEETING_ACTION":
      return event.subject.id;
    // H-0150: an Undo comes from a toast or the wire, so a missing subject is refused, never thrown on.
    case "UNDO_BED_MEETING_ACTION":
      return typeof event.subject === "object" && event.subject !== null && typeof event.subject.id === "string"
        ? event.subject.id
        : "none";
    case "RECORD_RESTRICTIVE_PRACTICE_START":
    case "RECORD_RESTRICTIVE_PRACTICE_END":
    case "RECORD_RESTRICTIVE_PRACTICE_FOLLOW_UP":
    case "RECORD_WARD_INCIDENT":
    case "SET_SECLUSION_ROOM_STATUS":
    // Closing the loop, package D (24 Oct 2026): ward-scoped records. The movement-scoped three
    // fall through to `movementId` below.
    case "RECORD_RESTRICTION_REVIEW":
    case "MARK_CLOSURE_TRANSITION_ITEM":
      return event.unitId;
    case "ADVANCE_CLOCK":
    case "RESET_SCENARIO":
    case "SET_SCENARIO":
    // No referral exists yet to name a rejection against; the intake itself is what is rejected.
    case "RECEIVE_REFERRAL":
    // A patient is not filed against a movement, and that is the point of the record rather than an
    // omission: they exist before any movement does.
    case "ADD_PATIENT":
      return "none";
    // Referral-scoped, not movement-scoped: a clearance is recorded against the referral the
    // inbox renders, and this event carries no `movementId` to return.
    case "RECORD_MEDICAL_CLEARANCE":
    // This event carries no `movementId`, so without this line `default` would stamp a rejection
    // with an `undefined` subject, and only on the unhappy path.
    case "RECORD_ARRIVED_IN_DEPARTMENT":
      return event.referralId;
    // These carry no `movementId`: the subject is the action-inbox row (`InboxItem.id`), which may
    // no longer match an open movement.
    case "ACKNOWLEDGE_INBOX_ITEM":
    case "COMPLETE_INBOX_ITEM":
    case "REOPEN_INBOX_ITEM":
    case "TAKE_INBOX_ITEM_OWNERSHIP":
    case "RELEASE_INBOX_ITEM_OWNERSHIP":
    case "SNOOZE_INBOX_ITEM":
    case "UNSNOOZE_INBOX_ITEM":
      return event.inboxItemId;
    // Notice-scoped (owner answer 48): carries no `movementId`.
    case "MARK_NOTICE_READ":
      return event.noticeId;
    case "SET_STEP_DOWN_CANDIDATE":
    case "RECORD_WARD_DIAGNOSIS":
    case "MARK_WEEKEND_DISCHARGE_REVIEWED":
    case "RECORD_CHIEF_PSYCHIATRIST_NOTIFIED":
    case "RECORD_DISCHARGE_CHECK":
    case "RECORD_FOLLOW_UP_REPLY":
    // Closing-the-loop (package E).
    case "RECORD_HOME_SERVICE_RETURN":
    case "FLAG_RETURN_EARLY":
    case "SET_DISCHARGE_BARRIER":
    case "SET_CLINICALLY_READY":
    case "SET_DISCHARGE_CRITERIA":
      return event.admissionId;
    case "RECORD_SUPPORT_NOTIFICATION":
      return event.movementId ?? event.admissionId ?? "none";
    case "EVALUATE_LEAVE_BED_WARNINGS":
    case "EVALUATE_ARRIVAL_LATENESS":
    case "RECORD_HANDOVER_SIGN_OFF":
      return "none";
    case "RECORD_CLINICAL_CONTACT":
      return event.teamId;
    // Closing-the-loop (package E).
    case "RECORD_DIRECTORY_CHECK":
      return event.entryId;
    // Staff needed (feature 10): a request is filed against its ward, its closing against itself.
    // The ward, not the request id, so a refused close stays in the desk's scoped refusal feed.
    case "REQUEST_WARD_STAFF":
    case "CLOSE_WARD_STAFF_REQUEST":
      return event.unitId;
    case "DISPATCH_BROADCAST_ALERT":
      return "broadcast";
    case "ACKNOWLEDGE_BROADCAST_ALERT":
    case "STAND_DOWN_BROADCAST_ALERT":
    case "EXTEND_BROADCAST_ALERT":
    case "ADD_BROADCAST_ALERT_UNITS":
    case "REPLY_BROADCAST_ALERT":
      return event.alertId;
    case "RAISE_PULL_NOW":
      return event.movementId;
    case "BOOK_PLANNED_ADMISSION":
      return event.unitId;
    case "CHANGE_PLANNED_ADMISSION":
    case "CANCEL_PLANNED_ADMISSION":
    case "CONVERT_PLANNED_ADMISSION":
      return event.plannedAdmissionId;
    case "RECORD_OBSERVATION_LEVEL":
      return event.target.kind === "movement" ? event.target.movementId : event.target.admissionId;
    default:
      return "movementId" in event ? (event.movementId as string) : "none";
  }
}
