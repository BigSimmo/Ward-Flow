/**
 * **EVERY SAVE WRITES ONE HISTORY LINE, UNLESS EXCLUDED (owner ruling item 10, D-222).**
 *
 * The History category of every Ward Flow event type, in one compile-checked table. History used to
 * be an allow-list: `classifyAuditEvent` (`ward-audit.ts`) named 56 event types and every other save
 * wrote nothing. This table flips the default. `AUDIT_CATEGORY` is a `Record` over every
 * `WardFlowEvent["type"]`, so a new event type does not compile until someone decides its line or
 * excludes it with a reason.
 *
 * Phase 1 (post-demo build, 14 Nov 2026): this module is pure and not yet read by the reducer. Phase
 * 2 makes `classifyAuditEvent` keep its refinements for the four conditional events (an override,
 * or a legal form on a raise) and fall back to this table for everything else.
 *
 * Rules carried by the table (D-222):
 * - The six new categories are History-only. They never enter the coordinator's Review list, so
 *   the review counts stay as they are (`isReviewableCategory`).
 * - The six new categories record accepted saves only; existing categories keep writing refusals
 *   (`historyWritesOutcome`). The signed-in `ward_flow.audit` table keeps every refusal anyway.
 * - Five exclusions, each with a reason: notice read, referral opened, and the three demonstration
 *   controls.
 */
import type { AuditCategory } from "@/components/ward-management/ward-audit";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

/** The six History categories added by D-222. Each is History-only (never in the Review list). */
export const NEW_HISTORY_CATEGORIES = [
  "bed-call",
  "pulled-bed",
  "care-record",
  "journey",
  "beds-and-wards",
  "handover",
] as const;
export type NewHistoryCategory = (typeof NEW_HISTORY_CATEGORIES)[number];

/** Every category a History line can carry: today's audit categories plus the six new ones. */
export type HistoryCategory = AuditCategory | NewHistoryCategory;

/** The plain label each new category shows on its filter chip and line. */
export const NEW_HISTORY_CATEGORY_LABELS: Readonly<Record<NewHistoryCategory, string>> = {
  "bed-call": "Bed call",
  "pulled-bed": "Pulled bed",
  "care-record": "Care record",
  journey: "Journey step",
  "beds-and-wards": "Beds and wards",
  handover: "Handover",
};

/** An event type that writes no History line, and why. The reason is for reviewers, never shown. */
export type HistoryExclusion = { readonly excluded: true; readonly reason: string };

const VIEW_NOT_SAVE = "A view, not a save";
const DEMO_CONTROL = "A demonstration control, never a clinical save";

export const HISTORY_EXCLUSIONS = {
  MARK_NOTICE_READ: {
    excluded: true,
    reason: `${VIEW_NOT_SAVE}: a read receipt sent by viewing the bell.`,
  },
  MARK_REFERRAL_OPENED: {
    excluded: true,
    reason: `${VIEW_NOT_SAVE}: sent automatically when a ward opens a referral; the referral timeline already shows who opened it.`,
  },
  ADVANCE_CLOCK: { excluded: true, reason: `${DEMO_CONTROL}: moves the demonstration clock.` },
  SET_SCENARIO: { excluded: true, reason: `${DEMO_CONTROL}: loads a demonstration scenario.` },
  RESET_SCENARIO: {
    excluded: true,
    reason: `${DEMO_CONTROL}: a reset starts a new world with an empty History.`,
  },
} as const satisfies Partial<Record<WardFlowEvent["type"], HistoryExclusion>>;

/**
 * The four event types whose category is refined from the event itself before this table is read
 * (`classifyAuditEvent`): an override reason makes the first three `override`, and a legal form on
 * a raise makes `RAISE_REFERRAL` `legal-form`. The table holds the category when no refinement
 * applies.
 */
export const REFINED_HISTORY_EVENT_TYPES = [
  "PULL_PATIENT",
  "ACCEPT_IN_PRINCIPLE",
  "ACCEPT_REFERRAL",
  "RAISE_REFERRAL",
] as const satisfies readonly WardFlowEvent["type"][];

const E = HISTORY_EXCLUSIONS;

/**
 * The History category of every event type, or its exclusion. Grouped by category; the comment on
 * each group names who reads it. Order inside a group carries no meaning.
 */
export const AUDIT_CATEGORY: Readonly<Record<WardFlowEvent["type"], HistoryCategory | HistoryExclusion>> = {
  // --- Exclusions (5) ---------------------------------------------------------------------------
  MARK_NOTICE_READ: E.MARK_NOTICE_READ,
  MARK_REFERRAL_OPENED: E.MARK_REFERRAL_OPENED,
  ADVANCE_CLOCK: E.ADVANCE_CLOCK,
  SET_SCENARIO: E.SET_SCENARIO,
  RESET_SCENARIO: E.RESET_SCENARIO,

  // --- Existing categories, as `classifyAuditEvent` writes them today ---------------------------
  REFER_TO_UNITS: "referral",
  CHANGE_LEGAL_STATUS: "legal-status",
  RECORD_LEGAL_FORM_EXPIRY: "legal-form",
  RECORD_COUNTRY_EXTENSION: "legal-form",
  RECORD_LEGAL_FORM_CONTINUATION: "legal-form",
  CORRECT_LEGAL_FORM_RECEIPT: "legal-form",
  FLAG_BED_RELEASE: "discharge",
  CONFIRM_BED_RELEASE: "discharge",
  REVERT_BED_RELEASE: "discharge",
  BLOCK_BED_RELEASE: "discharge",
  CLEAR_BED_RELEASE_BLOCK: "discharge",
  SET_BED_PREPARATION: "discharge",
  SEND_RELEASE_SUPPORT_NOTICE: "discharge",
  RECORD_LEAVING: "discharge",
  RECORD_ADMISSION_CARE: "discharge",
  RECORD_ADMISSION_FOLLOW_UP: "discharge",
  RECORD_PATIENT_DISCHARGE: "discharge",
  OPEN_DISCHARGE_RECORD: "record-access",
  REVIEW_AUDIT_EVENT: "review",
  UNDO_AUDIT_REVIEW: "review",
  UNDO_REFERRAL_DECISION: "undo",
  UNDO_REFER_TO_UNITS: "undo",
  UNDO_ACCEPT_IN_PRINCIPLE: "undo",
  UNDO_LEGAL_FORM_RECORD: "undo",
  UNDO_SUPPORT_NOTIFICATION: "undo",
  UNDO_REPATRIATION: "undo",
  UNDO_FLAG_RETURN_EARLY: "undo",
  UNDO_HANDOVER_SIGN_OFF: "undo",
  UNDO_SITE_HANDOVER_SIGN_OFF: "undo",
  UNDO_ED_STEP: "undo",
  UNDO_TRANSPORT_STEP: "undo",
  UNDO_DEPARTURE: "undo",
  UNDO_ABSENT_WITHOUT_LEAVE: "undo",
  UNDO_BED_MEETING_ACTION: "undo",
  UNDO_BED_STEP: "undo",
  UNDO_RELEASE_STEP: "undo",
  UNDO_PATIENT_RECORD: "undo",
  PLACE_IN_BED: "bed-placement",
  UNDO_PLACE_IN_BED: "bed-placement",
  HOLD_REFERRAL_BED: "bed-placement",
  RELEASE_REFERRAL_BED: "bed-placement",
  SET_CONFIGURATION: "configuration",
  DECLINE: "referral-answer",
  DECLINE_REFERRAL: "referral-answer",
  PATIENT_ARRIVED: "arrival",
  ARCHIVE_PATIENT: "patient-record",
  RECORD_OBSERVATION_LEVEL: "patient-record",
  ACKNOWLEDGE_INBOX_ITEM: "inbox",
  TAKE_INBOX_ITEM_OWNERSHIP: "inbox",
  RELEASE_INBOX_ITEM_OWNERSHIP: "inbox",
  SNOOZE_INBOX_ITEM: "inbox",
  UNSNOOZE_INBOX_ITEM: "inbox",

  // --- The four refined events, when no override or legal form applies -------------------------
  PULL_PATIENT: "pulled-bed",
  ACCEPT_IN_PRINCIPLE: "referral-answer",
  ACCEPT_REFERRAL: "referral-answer",
  RAISE_REFERRAL: "referral",

  // --- New: bed call (A2-4) ---------------------------------------------------------------------
  DISPATCH_BROADCAST_ALERT: "bed-call",
  EXTEND_BROADCAST_ALERT: "bed-call",
  STAND_DOWN_BROADCAST_ALERT: "bed-call",
  ADD_BROADCAST_ALERT_UNITS: "bed-call",
  ACKNOWLEDGE_BROADCAST_ALERT: "bed-call",
  REPLY_BROADCAST_ALERT: "bed-call",
  RAISE_PULL_NOW: "bed-call",
  SEND_WARD_BUZZ: "bed-call",
  REQUEST_CAPACITY_REFRESH: "bed-call",

  // --- New: pulled bed (A2-4) -------------------------------------------------------------------
  RELEASE_PULL: "pulled-bed",
  RELEASE_HELD_BED: "pulled-bed",
  RELEASE_DIVERTED_BED: "pulled-bed",
  RELEASE_AND_REOPEN_SEARCH: "pulled-bed",
  EXTEND_PULL: "pulled-bed",

  // --- New: care record (R5-3) ------------------------------------------------------------------
  RECORD_COMMUNITY_TREATMENT_ORDER: "care-record",
  END_COMMUNITY_TREATMENT_ORDER: "care-record",
  RECORD_TRIBUNAL_HEARING: "care-record",
  RECORD_TRIBUNAL_OUTCOME: "care-record",
  RECORD_CARE_PLAN: "care-record",
  RECORD_FOLLOW_UP_REPLY: "care-record",
  SET_CULTURAL_SUPPORT_REQUEST: "care-record",
  RECORD_TRIAGE_SIGNED: "care-record",
  RECORD_WARD_DIAGNOSIS: "care-record",
  RECORD_CLINICAL_CONTACT: "care-record",
  RECORD_CARER_CALLBACK: "care-record",
  MARK_CARER_CALLBACK_MADE: "care-record",
  RECORD_SUPPORT_NOTIFICATION: "care-record",
  UPLOAD_PATIENT_FORM: "care-record",
  RECORD_RESTRICTIVE_PRACTICE_START: "care-record",
  RECORD_RESTRICTIVE_PRACTICE_END: "care-record",
  RECORD_RESTRICTIVE_PRACTICE_FOLLOW_UP: "care-record",
  RECORD_ABSENT_WITHOUT_LEAVE: "care-record",
  RECORD_ABSENCE_STEP: "care-record",
  RECORD_CHIEF_PSYCHIATRIST_NOTIFIED: "care-record",
  RECORD_REPATRIATION: "care-record",
  RECORD_HOME_SERVICE_RETURN: "care-record",
  FLAG_RETURN_EARLY: "care-record",
  RECORD_AWAY_AT_EMERGENCY_DEPARTMENT: "care-record",
  RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT: "care-record",
  RECORD_LEAVE_BED: "care-record",
  END_LEAVE_BED: "care-record",

  // --- New: journey step (LG-6) -----------------------------------------------------------------
  RECORD_EXAMINATION: "journey",
  RECORD_MEDICAL_CLEARANCE: "journey",
  RECORD_ARRIVED_IN_DEPARTMENT: "journey",
  RECORD_TRANSPORT_NEED: "journey",
  RECORD_NO_REFERRAL: "journey",
  RECORD_ED_OUTCOME: "journey",
  RECORD_ED_MEDICAL_DETERIORATION: "journey",
  RECORD_MOVEMENT_MEDICAL_CLEARANCE: "journey",
  RECORD_LEFT_DEPARTMENT: "journey",
  RECORD_CREW_TIMES: "journey",
  RECORD_ARRIVAL_MODE: "journey",
  HANDOVER_READY: "journey",
  TRANSPORT_ACCEPTED: "journey",
  TRANSPORT_EN_ROUTE: "journey",
  PATIENT_COLLECTED: "journey",
  MARK_TRANSPORT_COLLECTED: "journey",
  BOOK_TRANSPORT: "journey",
  CANCEL_TRANSPORT: "journey",
  STOP_TRANSPORT: "journey",
  RECORD_TRANSPORT_CAD: "journey",
  RECORD_DIVERSION: "journey",
  SET_ARRIVAL_DETAILS: "journey",
  EVALUATE_ARRIVAL_LATENESS: "journey",
  STEP_BACK_STAGE: "journey",
  CHANGE_URGENCY: "journey",
  FLAG_MOVEMENT_URGENT: "journey",
  CLEAR_MOVEMENT_URGENT_FLAG: "journey",
  FLAG_MOVEMENT_TURNAROUND_PRIORITY: "journey",
  RECORD_MOVEMENT_BLOCKER: "journey",
  CLEAR_MOVEMENT_BLOCKER: "journey",
  RECORD_MOVEMENT_GENDER: "journey",
  RECORD_ESCALATION: "journey",
  RECORD_ESCALATION_CALL: "journey",
  REQUEST_PSYCH_REVIEW: "journey",
  RECORD_PSYCH_REVIEW_SEEN: "journey",
  RAISE_EXPECT_FLAG: "journey",
  CLEAR_EXPECT_FLAG: "journey",
  FLAG_LEGAL_MISMATCH: "journey",
  MARK_CANCELLED_MOVE_CHECK: "journey",
  RECORD_ARRIVAL_CHECK: "journey",
  RECORD_ACCEPTANCE_CONDITION: "journey",
  MARK_ACCEPTANCE_CONDITION_MET: "journey",
  WITHDRAW_ACCEPTANCE: "journey",
  WITHDRAW_WARD_REQUEST: "journey",
  WITHDRAW_REFERRAL: "journey",
  REFER_TO_COMMUNITY_TEAM: "journey",

  // --- New: beds and wards (RV2-8, AC1-6) -------------------------------------------------------
  CONFIRM_CAPACITY: "beds-and-wards",
  CONFIRM_MORNING_ROLLUP: "beds-and-wards",
  RECORD_WARD_INTAKE_CONSTRAINTS: "beds-and-wards",
  SET_INTAKE_WINDOW: "beds-and-wards",
  CLOSE_WARD_TO_ADMISSIONS: "beds-and-wards",
  REOPEN_WARD_TO_ADMISSIONS: "beds-and-wards",
  SET_BED_CLOSED: "beds-and-wards",
  MARK_WARD_READY_FOR_NEXT: "beds-and-wards",
  SET_SECLUSION_ROOM_STATUS: "beds-and-wards",
  RECORD_WARD_INCIDENT: "beds-and-wards",
  RECORD_RESTRICTION_REVIEW: "beds-and-wards",
  MARK_CLOSURE_TRANSITION_ITEM: "beds-and-wards",
  EVALUATE_LEAVE_BED_WARNINGS: "beds-and-wards",
  BOOK_PLANNED_ADMISSION: "beds-and-wards",
  CHANGE_PLANNED_ADMISSION: "beds-and-wards",
  CANCEL_PLANNED_ADMISSION: "beds-and-wards",
  CONVERT_PLANNED_ADMISSION: "beds-and-wards",
  RECORD_BED_MEETING_ACTION: "beds-and-wards",
  COMPLETE_BED_MEETING_ACTION: "beds-and-wards",
  REQUEST_WARD_STAFF: "beds-and-wards",
  CLOSE_WARD_STAFF_REQUEST: "beds-and-wards",

  // --- New: handover ----------------------------------------------------------------------------
  HAND_OVER_ITEM: "handover",
  ACCEPT_HANDED_ITEM: "handover",
  RECORD_HANDOVER_SIGN_OFF: "handover",
  RECORD_SITE_HANDOVER_SIGN_OFF: "handover",

  // --- Existing categories, newly written -------------------------------------------------------
  RECORD_LEGAL_FORM_RECEIVED: "legal-form",
  RECORD_LEGAL_FORM_WRITTEN: "legal-form",
  RECORD_LEGAL_FORM_CODE: "legal-form",
  RECORD_LEGAL_FORM_DETAILS: "legal-form",
  RECORD_ED_PRESENTATION: "legal-form",
  RECEIVE_REFERRAL: "referral",
  ASK_MORE_WARDS: "referral",
  ASSIGN_REFERRAL: "referral",
  LOG_REFERRAL_CONTACT: "referral",
  RECORD_REFERRAL_COMMITMENT: "referral",
  REQUEST_REFERRAL_INFORMATION: "referral",
  MARK_REFERRAL_INFORMATION_MET: "referral",
  FLAG_REFERRAL_TURNAROUND_PRIORITY: "referral",
  ADD_REFERRAL_CORRECTION: "referral",
  RECORD_REFERRER_WITHDRAWAL: "referral",
  RECORD_LOCAL_BED_SOUGHT: "referral",
  UPDATE_EXPECTED_DISCHARGE: "discharge",
  RECORD_STAY_DISCHARGE_BLOCKER: "discharge",
  CLEAR_STAY_DISCHARGE_BLOCKER: "discharge",
  SET_DISCHARGE_BARRIER: "discharge",
  SET_CLINICALLY_READY: "discharge",
  SET_DISCHARGE_CRITERIA: "discharge",
  SET_STEP_DOWN_CANDIDATE: "discharge",
  MARK_WEEKEND_DISCHARGE_REVIEWED: "discharge",
  RECORD_DISCHARGE_CHECK: "discharge",
  RECORD_DISCHARGE_DEPENDENCY: "discharge",
  RECORD_DISCHARGE_PLAN_CHANGE: "discharge",
  COMPLETE_INBOX_ITEM: "inbox",
  REOPEN_INBOX_ITEM: "inbox",
  ADD_PATIENT: "patient-record",
  SET_SITE_FEATURE_SWITCH: "configuration",
  RECORD_OUTAGE_WINDOW: "configuration",
  RECORD_DOWNTIME_PACK_PRINTED: "configuration",
  RECORD_DIRECTORY_CHECK: "configuration",
};

/** True when the table row is an exclusion rather than a category. */
export function isHistoryExclusion(row: HistoryCategory | HistoryExclusion): row is HistoryExclusion {
  return typeof row === "object" && row !== null && row.excluded === true;
}

/**
 * The table's category for an event type, or `null` when the type is excluded or unknown. Takes a
 * plain string so a stored or replayed type the engine no longer knows reads as no line, never as
 * a throw.
 */
export function historyCategoryForType(type: string): HistoryCategory | null {
  if (!Object.hasOwn(AUDIT_CATEGORY, type)) return null;
  const row = AUDIT_CATEGORY[type as WardFlowEvent["type"]];
  return isHistoryExclusion(row) ? null : row;
}

const NEW_CATEGORY_SET: ReadonlySet<string> = new Set(NEW_HISTORY_CATEGORIES);

function isNewHistoryCategory(category: string): category is NewHistoryCategory {
  return NEW_CATEGORY_SET.has(category);
}

/**
 * Whether a line in this category belongs on the coordinator's Review list. A review of a review is
 * never reviewed (today's rule), and the six new categories are History-only, so they never swell
 * the review counts.
 */
export function isReviewableCategory(category: HistoryCategory): boolean {
  return category !== "review" && !isNewHistoryCategory(category);
}

/**
 * Whether a save with this outcome writes a History line in this category (D-222 choice 4). The new
 * categories record accepted saves only; existing categories keep today's behaviour and record
 * refusals too.
 */
export function historyWritesOutcome(
  category: HistoryCategory,
  outcome: "accepted" | "partial" | "denied" | "stale",
): boolean {
  return isNewHistoryCategory(category) ? outcome === "accepted" : true;
}
