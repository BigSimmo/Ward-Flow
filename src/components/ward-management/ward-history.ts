import type { Instant } from "@/components/ward-management/ward-clock";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent, WardFlowRole } from "@/components/ward-management/ward-flow-events";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";

/**
 * "both": the event changes a bed (held, occupied or freed) AND the patient's stay or movement, so
 * it belongs in both histories. The one rule, applied to every event: holding, occupying or freeing
 * a bed for a named movement or admission is "both"; a bed fact with no patient is "bed"; a patient
 * fact with no bed change is "patient"; an event the engine records nothing for, or that only logs a
 * request, is "neither".
 */
export type EventHistoryCategory = "bed" | "patient" | "both" | "neither";

export interface EventTypeHistoryConfig {
  category: EventHistoryCategory;
  plainWording: string;
}

export interface WardHistoryEntry {
  time: string;
  instant: Instant | "Not recorded";
  summary: string;
  who: string;
  role: WardFlowRole | "Not recorded";
  reason: string;
  /** D-14: no patient link. History is joined to a record (movement, admission, referral), never
   *  to a person, so the patient link is deliberately never copied here. */
  relatedLinks: {
    movementId?: string;
    bedId?: string;
    unitId?: string;
    referralId?: string;
    admissionId?: string;
  };
}

/**
 * Classification table mapping every Ward Flow event type into bed, patient, or neither,
 * with standard Australian clinical English plain wording for each.
 */
export const EVENT_HISTORY_TABLE: Record<WardFlowEvent["type"], EventTypeHistoryConfig> = {
  // 2.1 Discharge, admission records, audit access
  RECORD_ADMISSION_CARE: { category: "patient", plainWording: "Care journey fact recorded" },
  RECORD_ADMISSION_FOLLOW_UP: { category: "patient", plainWording: "Follow-up arrangement recorded" },
  RECORD_PATIENT_DISCHARGE: { category: "neither", plainWording: "Patient discharged from ward" },
  UPDATE_EXPECTED_DISCHARGE: { category: "patient", plainWording: "Expected discharge date updated" },
  OPEN_DISCHARGE_RECORD: { category: "neither", plainWording: "Discharge record viewed" },
  REVIEW_AUDIT_EVENT: { category: "neither", plainWording: "Governance audit review completed" },
  RECORD_LEAVING: { category: "both", plainWording: "Patient departed ward" },
  RECORD_AWAY_AT_EMERGENCY_DEPARTMENT: {
    category: "patient",
    plainWording: "Patient temporarily away at Emergency Department",
  },
  RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT: {
    category: "patient",
    plainWording: "Patient returned from Emergency Department",
  },
  SET_STEP_DOWN_CANDIDATE: { category: "patient", plainWording: "Step-down pathway candidate status updated" },
  SET_DISCHARGE_BARRIER: { category: "patient", plainWording: "Discharge barrier recorded" },
  RECORD_REPATRIATION: { category: "patient", plainWording: "Repatriation transfer arrangements logged" },

  // 2.2 Front-door referrals
  ADD_PATIENT: { category: "patient", plainWording: "Patient registered in system" },
  RECEIVE_REFERRAL: { category: "patient", plainWording: "New referral received" },
  ACCEPT_REFERRAL: { category: "patient", plainWording: "Referral accepted by destination service" },
  DECLINE_REFERRAL: { category: "patient", plainWording: "Referral declined by destination service" },
  RECORD_REFERRER_WITHDRAWAL: { category: "patient", plainWording: "Referral withdrawn by referrer" },
  ADD_REFERRAL_CORRECTION: { category: "patient", plainWording: "Referral details corrected" },
  RECORD_LOCAL_BED_SOUGHT: { category: "patient", plainWording: "Local bed search logged" },

  // 2.3 Movement and bed pipeline
  RAISE_REFERRAL: { category: "patient", plainWording: "Inpatient bed request raised" },
  RECORD_EXAMINATION: { category: "patient", plainWording: "Psychiatric examination outcome recorded" },
  RECORD_MEDICAL_CLEARANCE: { category: "patient", plainWording: "Medical clearance status updated" },
  RECORD_ARRIVED_IN_DEPARTMENT: { category: "patient", plainWording: "Patient arrived in department" },
  RECORD_TRANSPORT_NEED: { category: "patient", plainWording: "Transport requirement recorded" },
  RECORD_NO_REFERRAL: { category: "patient", plainWording: "No external referral noted" },
  RECORD_ED_OUTCOME: { category: "patient", plainWording: "Emergency Department outcome recorded" },
  REFER_TO_UNITS: { category: "patient", plainWording: "Candidate inpatient wards shortlisted" },
  ACCEPT_IN_PRINCIPLE: { category: "patient", plainWording: "Ward accepted request in principle" },
  PULL_PATIENT: { category: "both", plainWording: "Patient pulled and allocated to ward bed" },
  DECLINE: { category: "patient", plainWording: "Ward declined inpatient request" },
  HANDOVER_READY: { category: "patient", plainWording: "Patient marked ready for transfer handover" },
  PATIENT_ARRIVED: { category: "both", plainWording: "Patient arrived at ward bed" },
  RECORD_ESCALATION: { category: "patient", plainWording: "Bed placement escalated to coordinator" },
  RELEASE_PULL: { category: "both", plainWording: "Allocated bed released back to ward" },
  REFER_TO_COMMUNITY_TEAM: { category: "patient", plainWording: "Patient diverted to Community Mental Health" },
  RECORD_LEFT_DEPARTMENT: { category: "patient", plainWording: "Patient departed Emergency Department" },
  STEP_BACK_STAGE: { category: "patient", plainWording: "Movement stepped back to earlier stage" },
  WITHDRAW_ACCEPTANCE: { category: "patient", plainWording: "Ward acceptance withdrawn" },
  WITHDRAW_WARD_REQUEST: { category: "patient", plainWording: "Ward shortlist request withdrawn" },
  SET_ARRIVAL_DETAILS: { category: "patient", plainWording: "Estimated arrival time updated" },
  RECORD_ED_MEDICAL_DETERIORATION: {
    category: "both",
    plainWording: "Medical deterioration — allocation cancelled; referral paused",
  },
  RECORD_MOVEMENT_MEDICAL_CLEARANCE: { category: "patient", plainWording: "Movement medical clearance recorded" },
  EVALUATE_ARRIVAL_LATENESS: { category: "patient", plainWording: "Arrival lateness evaluated" },
  RELEASE_AND_REOPEN_SEARCH: { category: "both", plainWording: "Bed released and placement search reopened" },
  WITHDRAW_REFERRAL: { category: "patient", plainWording: "Bed request withdrawn" },
  RECORD_MOVEMENT_BLOCKER: { category: "patient", plainWording: "Placement obstruction noted" },
  CLEAR_MOVEMENT_BLOCKER: { category: "patient", plainWording: "Placement obstruction cleared" },

  // 2.4 Legal status and forms
  CHANGE_LEGAL_STATUS: { category: "patient", plainWording: "Mental Health Act legal status changed" },
  RECORD_LEGAL_FORM_RECEIVED: { category: "patient", plainWording: "Statutory mental health form received" },
  CORRECT_LEGAL_FORM_RECEIPT: { category: "patient", plainWording: "Statutory form receipt record corrected" },
  RECORD_LEGAL_FORM_EXPIRY: { category: "patient", plainWording: "Statutory form expiry date recorded" },
  RECORD_LEGAL_FORM_WRITTEN: { category: "patient", plainWording: "Statutory form completion recorded" },
  RECORD_COUNTRY_EXTENSION: { category: "patient", plainWording: "Country extension recorded" },
  RECORD_LEGAL_FORM_CONTINUATION: { category: "patient", plainWording: "Statutory form continuation recorded" },
  CLEAR_EXPECT_FLAG: { category: "patient", plainWording: "Expected patient flag cleared" },
  RAISE_EXPECT_FLAG: { category: "patient", plainWording: "Expected patient flag raised" },
  FLAG_LEGAL_MISMATCH: { category: "patient", plainWording: "Statutory placement mismatch flagged" },

  // 2.5 Capacity and bed release
  CONFIRM_CAPACITY: { category: "bed", plainWording: "Ward bed capacity confirmed" },
  RECORD_WARD_INTAKE_CONSTRAINTS: { category: "bed", plainWording: "Ward intake constraints updated" },
  FLAG_BED_RELEASE: { category: "bed", plainWording: "Upcoming bed release flagged" },
  CONFIRM_BED_RELEASE: { category: "bed", plainWording: "Bed release confirmed" },
  REVERT_BED_RELEASE: { category: "bed", plainWording: "Bed release reverted to expected" },
  BLOCK_BED_RELEASE: { category: "bed", plainWording: "Bed release blocked" },
  CLEAR_BED_RELEASE_BLOCK: { category: "bed", plainWording: "Bed release block cleared" },
  SET_BED_PREPARATION: { category: "bed", plainWording: "Bed cleaning and preparation status updated" },
  RELEASE_BED: { category: "bed", plainWording: "Bed freed and returned to unit capacity" },
  RECORD_LEAVE_BED: { category: "bed", plainWording: "Patient leave of absence bed hold recorded" },
  END_LEAVE_BED: { category: "bed", plainWording: "Leave of absence bed hold concluded" },
  REQUEST_CAPACITY_REFRESH: { category: "neither", plainWording: "Ward capacity update requested" },
  EVALUATE_LEAVE_BED_WARNINGS: { category: "bed", plainWording: "Leave bed warning thresholds evaluated" },
  CONFIRM_MORNING_ROLLUP: { category: "bed", plainWording: "Morning ward rollup confirmed" },
  SEND_WARD_BUZZ: { category: "neither", plainWording: "Direct ward capacity inquiry sent" },

  // 2.6 Transport
  TRANSPORT_ACCEPTED: { category: "patient", plainWording: "Transport job accepted by crew" },
  TRANSPORT_EN_ROUTE: { category: "patient", plainWording: "Transport crew en route to collect patient" },
  PATIENT_COLLECTED: { category: "patient", plainWording: "Patient collected by transport crew" },
  BOOK_TRANSPORT: { category: "patient", plainWording: "Patient transport booking requested" },
  CANCEL_TRANSPORT: { category: "patient", plainWording: "Patient transport booking cancelled" },
  STOP_TRANSPORT: { category: "patient", plainWording: "Patient transport stopped in transit" },
  RELEASE_HELD_BED: { category: "both", plainWording: "Held bed released after stopped transport" },
  RECORD_DIVERSION: { category: "patient", plainWording: "Transport diverted to alternative location" },
  RELEASE_DIVERTED_BED: { category: "both", plainWording: "Held bed released after transport diversion" },

  // 2.7 Urgency and gender flags
  CHANGE_URGENCY: { category: "patient", plainWording: "Clinical urgency priority changed" },
  FLAG_MOVEMENT_URGENT: { category: "patient", plainWording: "Movement flagged as clinically urgent" },
  CLEAR_MOVEMENT_URGENT_FLAG: { category: "patient", plainWording: "Clinical urgency flag cleared" },
  RECORD_MOVEMENT_GENDER: { category: "patient", plainWording: "Patient gender placement guidance recorded" },

  // 2.8 Inbox, notices, handover, broadcast, uploads
  MARK_NOTICE_READ: { category: "neither", plainWording: "Operational notice marked as read" },
  ACKNOWLEDGE_INBOX_ITEM: { category: "neither", plainWording: "Action item acknowledged" },
  COMPLETE_INBOX_ITEM: { category: "neither", plainWording: "Action item completed" },
  REOPEN_INBOX_ITEM: { category: "neither", plainWording: "Action item reopened" },
  UPLOAD_PATIENT_FORM: { category: "patient", plainWording: "Clinical document uploaded" },
  RECORD_HANDOVER_SIGN_OFF: { category: "patient", plainWording: "Ward transfer handover signed off" },
  RECORD_CLINICAL_CONTACT: { category: "patient", plainWording: "Clinical liaison contact recorded" },
  DISPATCH_BROADCAST_ALERT: { category: "neither", plainWording: "Statewide broadcast directive dispatched" },
  ACKNOWLEDGE_BROADCAST_ALERT: { category: "neither", plainWording: "Broadcast directive acknowledged" },
  STAND_DOWN_BROADCAST_ALERT: { category: "neither", plainWording: "Broadcast directive stood down" },

  // 2.9 World and admin
  ADVANCE_CLOCK: { category: "neither", plainWording: "Operational demonstration clock advanced" },
  RESET_SCENARIO: { category: "neither", plainWording: "Demonstration scenario reset" },
  SET_SCENARIO: { category: "neither", plainWording: "Demonstration scenario selected" },
  SET_CONFIGURATION: { category: "neither", plainWording: "Operational configuration parameters updated" },
};

/**
 * Helper to extract any recorded reason string from an event.
 */
function extractEventReason(event: WardFlowEvent): string {
  if (event.type === "RECORD_ED_MEDICAL_DETERIORATION") return "Medical Deterioration - ED Resuscitation Required";
  const ev = event as unknown as Record<string, unknown>;
  if (typeof ev.reason === "string" && ev.reason.trim().length > 0) return ev.reason.trim();
  if (typeof ev.declineReason === "string" && ev.declineReason.trim().length > 0) return ev.declineReason.trim();
  if (typeof ev.overrideReason === "string" && ev.overrideReason.trim().length > 0) return ev.overrideReason.trim();
  if (typeof ev.stopReason === "string" && ev.stopReason.trim().length > 0) return ev.stopReason.trim();
  if (typeof ev.blocker === "string" && ev.blocker.trim().length > 0) return ev.blocker.trim();
  if (typeof ev.leavingDestination === "string" && ev.leavingDestination.trim().length > 0)
    return `Destination: ${ev.leavingDestination}`;
  if (typeof ev.outcome === "string" && ev.outcome.trim().length > 0) return `Outcome: ${ev.outcome}`;
  return "Not recorded";
}

/**
 * Builds a single standardized history row from an event.
 * Follows the role-not-person rule and shows "Not recorded" for missing facts.
 */
export function buildHistoryEntry(event: WardFlowEvent, now: Instant): WardHistoryEntry {
  const config = EVENT_HISTORY_TABLE[event.type];
  const summary = config ? config.plainWording : event.type;

  const time =
    event.now !== undefined && typeof event.now === "number" && Number.isFinite(event.now)
      ? // A history row can be from any day, so its time always says which day relative to `now`.
        formatInstantWithDay(event.now, now)
      : "Not recorded";

  const instant =
    event.now !== undefined && typeof event.now === "number" && Number.isFinite(event.now) ? event.now : "Not recorded";

  const role = event.role ?? "Not recorded";
  const who = event.role ? (WARD_FLOW_ROLE_LABELS[event.role] ?? event.role) : "Not recorded";

  const reason = extractEventReason(event);

  const ev = event as unknown as Record<string, unknown>;
  const relatedLinks: WardHistoryEntry["relatedLinks"] = {};

  if (typeof ev.movementId === "string" && ev.movementId.length > 0) relatedLinks.movementId = ev.movementId;
  if (typeof ev.bedId === "string" && ev.bedId.length > 0) relatedLinks.bedId = ev.bedId;
  if (typeof ev.unitId === "string" && ev.unitId.length > 0) relatedLinks.unitId = ev.unitId;
  if (typeof ev.actingUnitId === "string" && ev.actingUnitId.length > 0) relatedLinks.unitId = ev.actingUnitId;
  if (typeof ev.referralId === "string" && ev.referralId.length > 0) relatedLinks.referralId = ev.referralId;
  if (typeof ev.admissionId === "string" && ev.admissionId.length > 0) relatedLinks.admissionId = ev.admissionId;

  return {
    time,
    instant,
    summary,
    who,
    role,
    reason,
    relatedLinks,
  };
}

/**
 * The standard boundary notice indicating that events occurring prior to the current log
 * are not recorded.
 */
export const EARLIER_HISTORY_NOT_RECORDED_ENTRY: WardHistoryEntry = {
  time: "Not recorded",
  instant: "Not recorded",
  summary: "Earlier history not recorded",
  who: "Not recorded",
  role: "Not recorded",
  reason: "Not recorded",
  relatedLinks: {},
};

/**
 * Pure read-only selector returning one patient's record history (by movement, admission or
 * referral id; D-14 keeps the patient link out) over a plain array of events.
 * Agnostic of storage; prepends "Earlier history not recorded".
 */
export function selectPatientHistory(
  events: readonly WardFlowEvent[],
  recordId: string,
  now: Instant,
): readonly WardHistoryEntry[] {
  if (!recordId) {
    return [EARLIER_HISTORY_NOT_RECORDED_ENTRY];
  }

  const matchingEntries: WardHistoryEntry[] = [];

  for (const event of events) {
    const config = EVENT_HISTORY_TABLE[event.type];
    if (!config || (config.category !== "patient" && config.category !== "both")) continue;

    const ev = event as unknown as Record<string, unknown>;
    // D-14 (patient link is default-deny): match on the record ids only, never the patient link.
    const matchesPatient = ev.movementId === recordId || ev.admissionId === recordId || ev.referralId === recordId;

    if (matchesPatient) {
      matchingEntries.push(buildHistoryEntry(event, now));
    }
  }

  return [EARLIER_HISTORY_NOT_RECORDED_ENTRY, ...matchingEntries];
}

/**
 * Pure read-only selector returning bed/unit history over a plain array of events.
 * Agnostic of storage; prepends "Earlier history not recorded".
 */
export function selectBedHistory(
  events: readonly WardFlowEvent[],
  unitId: string,
  now: Instant,
  bedId?: string,
): readonly WardHistoryEntry[] {
  if (!unitId) {
    return [EARLIER_HISTORY_NOT_RECORDED_ENTRY];
  }

  const matchingEntries: WardHistoryEntry[] = [];

  for (const event of events) {
    const config = EVENT_HISTORY_TABLE[event.type];
    if (!config || (config.category !== "bed" && config.category !== "both")) continue;

    const ev = event as unknown as Record<string, unknown>;
    const matchesUnit = ev.unitId === unitId || ev.actingUnitId === unitId;
    const matchesBed = bedId ? ev.bedId === bedId || ev.releaseId === bedId : true;

    if (matchesUnit && matchesBed) {
      matchingEntries.push(buildHistoryEntry(event, now));
    }
  }

  return [EARLIER_HISTORY_NOT_RECORDED_ENTRY, ...matchingEntries];
}
