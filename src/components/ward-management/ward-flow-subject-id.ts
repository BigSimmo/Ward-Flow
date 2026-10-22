import type { WardFlowEvent } from "./ward-flow-events";
import { undoStepSubjectId } from "./ward-undo";

/*
 * Moved out of ward-flow-reducer.ts unchanged (19 Oct 2026) to keep the reducer under its line cap
 * (eslint-rules/max-lines-baseline.mjs). Every event that is not about one movement names its
 * subject here, so a rejection is filed against the right record.
 */

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
    case "UNDO_DEPARTURE":
    case "UNDO_ABSENT_WITHOUT_LEAVE":
    case "UNDO_ED_STEP":
    case "UNDO_SUPPORT_NOTIFICATION":
      return undoStepSubjectId(event);
    case "UNDO_HANDOVER_SIGN_OFF":
      return "none";
    case "RAISE_REFERRAL":
      return event.edId;
    case "CONFIRM_CAPACITY":
    case "RECORD_WARD_INTAKE_CONSTRAINTS":
    case "CLOSE_WARD_TO_ADMISSIONS":
    case "REOPEN_WARD_TO_ADMISSIONS":
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
      return event.releaseId;
    case "RELEASE_BED":
      return event.releaseId;
    // Admission-scoped: an admission id is not a unit or release id, so these keep their own group.
    case "RECORD_LEAVING":
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
      return event.patientId;
    case "ACCEPT_REFERRAL":
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
      return event.referralId;
    case "RECORD_BED_MEETING_ACTION":
    case "COMPLETE_BED_MEETING_ACTION":
      return event.subject.id;
    case "RECORD_RESTRICTIVE_PRACTICE_START":
    case "RECORD_RESTRICTIVE_PRACTICE_END":
    case "RECORD_WARD_INCIDENT":
    case "SET_SECLUSION_ROOM_STATUS":
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
    case "SNOOZE_INBOX_ITEM":
    case "UNSNOOZE_INBOX_ITEM":
      return event.inboxItemId;
    // Notice-scoped (owner answer 48): carries no `movementId`.
    case "MARK_NOTICE_READ":
      return event.noticeId;
    case "SET_STEP_DOWN_CANDIDATE":
    case "SET_DISCHARGE_BARRIER":
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
    case "DISPATCH_BROADCAST_ALERT":
      return "broadcast";
    case "ACKNOWLEDGE_BROADCAST_ALERT":
    case "STAND_DOWN_BROADCAST_ALERT":
    case "EXTEND_BROADCAST_ALERT":
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
    default:
      return "movementId" in event ? (event.movementId as string) : "none";
  }
}
