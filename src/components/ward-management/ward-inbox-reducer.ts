import type { AuditDecision } from "./ward-audit";
import type { Instant } from "./ward-clock";
import type { WardFlowEvent } from "./ward-flow-events";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Movement, Notice } from "./ward-model";
import { isOnOrder, stayLegalStatus } from "./ward-stay-legal";
import { SNOOZE_MAX_MINUTES } from "./ward-operational-defaults";
import { duplicateBedRequestSince } from "./ward-duplicate-bed-requests";
import {
  BED_MEETING_ACTION_INBOX_PREFIX,
  meetingActionOfInboxId,
  openMeetingAction,
  type BedMeetingAction,
} from "./bed-meeting/bed-meeting-actions";
import {
  activeSnooze,
  currentInboxOwner,
  snoozeAllowed,
  SNOOZE_REASON_IDS,
  type InboxOwnershipEntry,
  type InboxSnoozeEntry,
} from "./ward-inbox-snooze";

type InboxAcknowledgement = {
  at: Instant;
  by: string;
};

export type InboxCompletionEntry = {
  at: Instant;
  by: string;
  kind: "completed" | "reopened";
};

export type InboxItemKind = "fact" | "commitment";

export type RejectFn = (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;

function findNotice(state: WardFlowState, noticeId: string): Notice | undefined {
  return state.notices.find((candidate: Notice) => candidate.id === noticeId);
}

/**
 * Returns "complete" if the last completion entry is "completed", otherwise "open".
 * No entries (undefined or []) means "never completed".
 */
export function inboxItemCompletionState(entries: readonly InboxCompletionEntry[] | undefined): "complete" | "open" {
  if (!entries || entries.length === 0) return "open";
  return entries[entries.length - 1].kind === "completed" ? "complete" : "open";
}

/**
 * WHAT KIND OF THING AN ACTION-INBOX ROW IS — ward-lead task, 2026-09-06.
 *
 * - "fact" — a live clinical or legal truth the inbox COMPUTES from movements and units.
 *   Leaves the list when the underlying situation changes, and never because somebody ticked it.
 * - "commitment" — a human undertaking. Leaves when the person says they finished.
 */
export const INBOX_CATEGORIES = {
  /** An accepted destination that is not authorised to hold this patient's legal status. */
  destination_unlawful: { idPrefix: "destination-unlawful-", kind: "fact" },
  /** A statutory form past its recorded deadline. */
  legal_timing_breached: { idPrefix: "legal-", kind: "fact" },
  /** A bed hold that has lapsed. */
  bed_pull_expired: { idPrefix: "bed-pull-", kind: "fact" },
  /** Destinations declined by units. */
  destinations_declined: { idPrefix: "declines-", kind: "fact" },
  /** Transport accepted and not yet departed. */
  transport_awaiting_departure: { idPrefix: "transport-", kind: "fact" },
  /** A planned admission whose expected arrival has passed without the arrival being recorded.
   *  Its row's remainder is a planned-admission id, not a movement id (stream D). */
  planned_arrival_overdue: { idPrefix: "planned-arrival-", kind: "fact" },
  /** Stream A, 9 Oct 2026: a referral not answered within its decision target (default, set in Settings). */
  target_referral_decision: { idPrefix: "target-referral-decision-", kind: "fact" },
  /** An accepted transfer whose bed has not been pulled within its target. */
  target_transfer_acceptance: { idPrefix: "target-transfer-acceptance-", kind: "fact" },
  /** A pulled bed with no transport booked within its target. */
  target_transport_booked: { idPrefix: "target-transport-booked-", kind: "fact" },
  /**
   * The same three targets while still running (a countdown, amber). Their own ids, so snoozing a
   * countdown never hides the overdue row that replaces it, and a review-level row for the cap.
   */
  target_pending_referral_decision: { idPrefix: "target-pending-referral-decision-", kind: "fact" },
  target_pending_transfer_acceptance: { idPrefix: "target-pending-transfer-acceptance-", kind: "fact" },
  target_pending_transport_booked: { idPrefix: "target-pending-transport-booked-", kind: "fact" },
  /** An involuntary patient's admission or transfer with a carer, PSP or MHAS notification not yet
   *  recorded (advisory). Leaves when every party has a record. Remainder is the movement id. */
  support_notification_arrival: { idPrefix: "notify-arrival-", kind: "fact" },
  /** The same, for a discharge. Remainder is the discharged stay's admission id (a stay may have
   *  no movement), checked against `state.admissions` by `ACKNOWLEDGE_INBOX_ITEM`. */
  support_notification_discharge: { idPrefix: "notify-discharge-", kind: "fact" },
  /** Audit A3-1 (13 Oct 2026): a person on an order recorded absent without leave. Act now. Leaves
   *  when the return is recorded. Remainder is the stay's admission id (`ward-absence-tasks.ts`). */
  absent_without_leave: { idPrefix: "awol-", kind: "fact" },
  /** Clinical owner ruling (14 Oct 2026): an open, unplaced movement with no eligible bed anywhere
   *  in the network. The patient stays on the waitlist with a visible flag and the bed coordinator
   *  is notified; nothing drops or releases them. Act now. Remainder is the movement id. */
  no_eligible_bed: { idPrefix: "no-eligible-bed-", kind: "fact" },
  /** Audit F-19 (19 Oct 2026): one person with more than one active bed request. Coordinator only
   *  (Josh, 19 Oct). Leaves when one is answered or withdrawn. Remainder is the patient id
   *  (`ward-duplicate-bed-requests.ts`). */
  duplicate_bed_request: { idPrefix: "duplicate-bed-request-", kind: "fact" },
  /** Overall review (20 Oct 2026): the coordinator's daily "nobody missed" check, ticked off with
   *  "Checked, all accounted for" (`COMPLETE_INBOX_ITEM`), which records the role and the time. A
   *  commitment, never a row on any list. Remainder is `day-` and the demo day (`dailyCheckId`). */
  daily_check: { idPrefix: "daily-check-", kind: "commitment" },
  /** Overall review (20 Oct 2026): an action agreed at the bed meeting, in its owner's Needs you
   *  until the owner or the chair marks it done (`COMPLETE_BED_MEETING_ACTION`). Amber, overdue
   *  included: shown, never escalated. Remainder names the action (`meetingActionInboxId`). */
  bed_meeting_action: { idPrefix: BED_MEETING_ACTION_INBOX_PREFIX, kind: "fact" },
} as const satisfies Record<string, { readonly idPrefix: string; readonly kind: InboxItemKind }>;

/**
 * What kind of row an InboxItem.id names, or undefined if nothing in INBOX_CATEGORIES claims it.
 */
export function inboxItemKindOf(inboxItemId: string): InboxItemKind | undefined {
  const category = Object.values(INBOX_CATEGORIES).find((entry) => inboxItemId.startsWith(entry.idPrefix));
  return category?.kind;
}

/**
 * Categories whose rows are review-level (amber) rather than act-now (red). Every other category,
 * including one added later and not listed here, is treated as act-now, so the snooze cap fails
 * safe. `buildActionInbox` and `decisionTargetInboxItems` must agree with this list (pinned in
 * `tests/ward-inbox-snooze.test.ts`).
 */
const INBOX_REVIEW_CATEGORIES: readonly (keyof typeof INBOX_CATEGORIES)[] = [
  "transport_awaiting_departure",
  "target_pending_referral_decision",
  "target_pending_transfer_acceptance",
  "target_pending_transport_booked",
  // Carer, PSP and MHAS notification tasks (9 Oct 2026) are advisory, amber rows.
  "support_notification_arrival",
  "support_notification_discharge",
  // Stream D: an overdue planned arrival is an amber row, so it snoozes like other review rows.
  "planned_arrival_overdue",
  // Audit F-19: a duplicate bed request is something to check, not act on now.
  "duplicate_bed_request",
  // Overall review (20 Oct 2026): a bed meeting action is a task; overdue is shown, not escalated.
  "bed_meeting_action",
];

/** Whether a row is act-now (red), read from its id alone so the reducer can enforce the snooze cap. */
export function inboxItemIsActNow(inboxItemId: string): boolean {
  return !INBOX_REVIEW_CATEGORIES.some((key) => inboxItemId.startsWith(INBOX_CATEGORIES[key].idPrefix));
}

/**
 * Whether an id names a real inbox row: a known category prefix and an existing movement after
 * it, or for a discharge notification row an existing stay (its remainder is an admission id).
 * Used by the ownership and snooze events; the same test `ACKNOWLEDGE_INBOX_ITEM` applies.
 */
export function inboxRowExists(state: WardFlowState, inboxItemId: string): boolean {
  const dischargePrefix = INBOX_CATEGORIES.support_notification_discharge.idPrefix;
  if (inboxItemId.startsWith(dischargePrefix)) {
    const admissionId = inboxItemId.slice(dischargePrefix.length);
    return state.admissions.some((admission) => admission.id === admissionId);
  }
  // Match absentOnOrder: only a live stay on an order can produce an absence row.
  const absencePrefix = INBOX_CATEGORIES.absent_without_leave.idPrefix;
  if (inboxItemId.startsWith(absencePrefix)) {
    const admissionId = inboxItemId.slice(absencePrefix.length);
    const admission = state.admissions.find((stay) => stay.id === admissionId);
    if (!admission || admission.state === "departed" || !isOnOrder(stayLegalStatus(admission, state))) return false;
    return state.leaveBeds.some((bed) => bed.admissionId === admissionId && Boolean(bed.absentWithoutLeave));
  }
  // Audit F-19: a duplicate row names a person, and exists while they still have two active requests.
  const duplicatePrefix = INBOX_CATEGORIES.duplicate_bed_request.idPrefix;
  if (inboxItemId.startsWith(duplicatePrefix)) {
    return duplicateBedRequestSince(state, inboxItemId.slice(duplicatePrefix.length)) !== undefined;
  }
  // Overall review (20 Oct 2026): a bed meeting action row exists while that action is still open.
  if (inboxItemId.startsWith(INBOX_CATEGORIES.bed_meeting_action.idPrefix)) {
    return openMeetingActionOfRow(state, inboxItemId) !== undefined;
  }
  // Stream D: a planned arrival row names its booking, not a movement.
  if (plannedRowBooking(state, inboxItemId) !== undefined) return true;
  return inboxRowMovementId(state.movements, inboxItemId) !== undefined;
}

/** The open bed meeting action a row id names, when its record exists and the action is not done. */
function openMeetingActionOfRow(state: WardFlowState, inboxItemId: string): BedMeetingAction | undefined {
  const named = meetingActionOfInboxId(inboxItemId);
  if (!named) return undefined;
  const { subject, kind } = named;
  const record =
    subject.kind === "movement"
      ? state.movements.find((movement) => movement.id === subject.id)
      : state.admissions.find((admission) => admission.id === subject.id);
  return openMeetingAction(record?.meetingActions, kind);
}

/** The booking a planned-arrival row id names (stream D), when that booking exists. */
function plannedRowBooking(state: WardFlowState, inboxItemId: string) {
  const plannedPrefix = INBOX_CATEGORIES.planned_arrival_overdue.idPrefix;
  if (!inboxItemId.startsWith(plannedPrefix)) return undefined;
  const plannedAdmissionId = inboxItemId.slice(plannedPrefix.length);
  return (state.plannedAdmissions ?? []).find((planned) => planned.id === plannedAdmissionId);
}

/** The movement an inbox row id names (longest matching category prefix), when that movement exists. */
export function inboxRowMovementId(movements: readonly Movement[], inboxItemId: string): string | undefined {
  const category = Object.values(INBOX_CATEGORIES)
    .filter((entry) => inboxItemId.startsWith(entry.idPrefix))
    .sort((a, b) => b.idPrefix.length - a.idPrefix.length)[0];
  if (!category) return undefined;
  const movementId = inboxItemId.slice(category.idPrefix.length);
  return movements.some((movement) => movement.id === movementId) ? movementId : undefined;
}

function lastPulledAt(movement: Movement): Instant | undefined {
  let pulledAt: Instant | undefined;
  for (const change of movement.stageChanges) {
    if (change.to === "pulled") pulledAt = change.at;
  }
  return pulledAt;
}

/**
 * When the current occurrence of a row began, read from the movement alone (stream A, 9 Oct 2026).
 * Row ids are category plus movement, so a condition that ends and starts again on one movement
 * reuses the id; snoozes and ownership written before this instant belong to the earlier
 * occurrence. Undefined for a category with no recorded start (its entries then always apply).
 * `buildActionInbox` and `decisionTargetInboxItems` set `InboxItem.since` to the same instant
 * (pinned in `tests/ward-inbox-snooze.test.ts`).
 */
export function inboxOccurrenceSince(movement: Movement, inboxItemId: string): Instant | undefined {
  const startsWith = (key: keyof typeof INBOX_CATEGORIES) => inboxItemId.startsWith(INBOX_CATEGORIES[key].idPrefix);
  if (startsWith("legal_timing_breached")) return movement.legalForm?.dueAt;
  if (startsWith("bed_pull_expired")) return movement.pullExpiresAt;
  if (startsWith("transport_awaiting_departure")) return movement.transport?.acceptedAt;
  if (startsWith("target_referral_decision") || startsWith("target_pending_referral_decision")) {
    return movement.referralDecisionOpenedAt ?? movement.referredAt;
  }
  if (startsWith("target_transfer_acceptance") || startsWith("target_pending_transfer_acceptance")) {
    return movement.acceptedAt;
  }
  if (startsWith("target_transport_booked") || startsWith("target_pending_transport_booked")) {
    return lastPulledAt(movement);
  }
  return undefined;
}

function inboxRowSince(state: WardFlowState, inboxItemId: string): Instant | undefined {
  // A planned arrival row's occurrence starts at its expected arrival, so moving the booking starts
  // a new one and an earlier snooze or owner no longer applies.
  const planned = plannedRowBooking(state, inboxItemId);
  if (planned) return planned.expectedArrivalAt;
  // Audit A3-1: an absence row's occurrence starts when the absence was recorded.
  const absencePrefix = INBOX_CATEGORIES.absent_without_leave.idPrefix;
  if (inboxItemId.startsWith(absencePrefix)) {
    const admissionId = inboxItemId.slice(absencePrefix.length);
    return state.leaveBeds.find((bed) => bed.admissionId === admissionId)?.absentWithoutLeave?.since;
  }
  // Audit F-19: a duplicate row's occurrence starts when the second active request was raised.
  const duplicatePrefix = INBOX_CATEGORIES.duplicate_bed_request.idPrefix;
  if (inboxItemId.startsWith(duplicatePrefix)) {
    return duplicateBedRequestSince(state, inboxItemId.slice(duplicatePrefix.length));
  }
  // A bed meeting action row's occurrence starts when the meeting recorded that action.
  if (inboxItemId.startsWith(INBOX_CATEGORIES.bed_meeting_action.idPrefix)) {
    return openMeetingActionOfRow(state, inboxItemId)?.recordedAt;
  }
  const movementId = inboxRowMovementId(state.movements, inboxItemId);
  const movement = state.movements.find((candidate) => candidate.id === movementId);
  return movement ? inboxOccurrenceSince(movement, inboxItemId) : undefined;
}

/**
 * Handles inbox and notices events:
 * - MARK_NOTICE_READ
 * - ACKNOWLEDGE_INBOX_ITEM
 * - COMPLETE_INBOX_ITEM
 * - REOPEN_INBOX_ITEM
 * - TAKE_INBOX_ITEM_OWNERSHIP, SNOOZE_INBOX_ITEM, UNSNOOZE_INBOX_ITEM (stream A, 9 Oct 2026)
 * - RELEASE_INBOX_ITEM_OWNERSHIP (P019, 27 Oct 2026)
 */
export function reduceInboxEvent(
  state: WardFlowState,
  event: WardFlowEvent,
  decision: AuditDecision,
  reject: RejectFn,
): WardFlowState | null {
  switch (event.type) {
    case "MARK_NOTICE_READ": {
      const notice = findNotice(state, event.noticeId);
      if (!notice) return reject(state, event, `no notice found for id ${event.noticeId}`);
      if (notice.to.role !== event.role || notice.to.placeId !== event.actingPlaceId) {
        return reject(
          state,
          event,
          `MARK_NOTICE_READ role/actingPlaceId (${event.role}/${event.actingPlaceId ?? "none"}) must match notice ${event.noticeId}'s own addressee (${notice.to.role}/${notice.to.placeId ?? "none"})`,
        );
      }
      if (notice.readAt !== undefined) {
        return reject(state, event, `notice ${event.noticeId} is already marked read`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const updated: Notice = { ...notice, readAt: event.now, readBy: event.role };
      return {
        ...state,
        notices: state.notices.map((candidate: Notice) => (candidate.id === notice.id ? updated : candidate)),
      };
    }

    case "ACKNOWLEDGE_INBOX_ITEM": {
      const inboxItemId = event.inboxItemId.trim();
      if (inboxItemId.length === 0) {
        return reject(state, event, "ACKNOWLEDGE_INBOX_ITEM inboxItemId must name a row — a blank names nothing");
      }
      const inboxCategory = Object.values(INBOX_CATEGORIES).find((entry) => inboxItemId.startsWith(entry.idPrefix));
      const inboxMovementId = inboxCategory ? inboxItemId.slice(inboxCategory.idPrefix.length) : undefined;
      // Absence and discharge rows name stays; planned-arrival rows name bookings; duplicate bed
      // request rows name a person (audit F-19). Keep these category-specific checks so a movement
      // id cannot impersonate a booking.
      const namesRecord =
        inboxCategory === INBOX_CATEGORIES.absent_without_leave ||
        inboxCategory === INBOX_CATEGORIES.duplicate_bed_request ||
        inboxCategory === INBOX_CATEGORIES.bed_meeting_action
          ? inboxRowExists(state, inboxItemId)
          : inboxCategory === INBOX_CATEGORIES.support_notification_discharge
            ? state.admissions.some((admission) => admission.id === inboxMovementId)
            : inboxCategory === INBOX_CATEGORIES.planned_arrival_overdue
              ? (state.plannedAdmissions ?? []).some((planned) => planned.id === inboxMovementId)
              : state.movements.some((movement: Movement) => movement.id === inboxMovementId);
      if (!inboxCategory || !namesRecord) {
        return reject(
          state,
          event,
          `ACKNOWLEDGE_INBOX_ITEM inboxItemId ${inboxItemId} does not name a real inbox row — its prefix must be one of INBOX_CATEGORIES and its remainder an existing record for that category`,
        );
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const acknowledgement: InboxAcknowledgement = { at: event.now, by: WARD_FLOW_ROLE_LABELS[event.role] };
      const existing = state.inboxAcknowledgements[inboxItemId] ?? [];
      return {
        ...state,
        inboxAcknowledgements: { ...state.inboxAcknowledgements, [inboxItemId]: [...existing, acknowledgement] },
      };
    }

    case "COMPLETE_INBOX_ITEM": {
      const inboxItemId = event.inboxItemId.trim();
      if (inboxItemId.length === 0) {
        return reject(state, event, "COMPLETE_INBOX_ITEM inboxItemId must name a row — a blank names nothing");
      }
      const kind = inboxItemKindOf(inboxItemId);
      if (kind !== "commitment") {
        return reject(
          state,
          event,
          kind === "fact"
            ? `inbox row ${inboxItemId} states a live fact, not a commitment — a fact leaves this list when it stops being true, never because it was ticked off`
            : `inbox row ${inboxItemId} is not a classified inbox category, so it cannot be ticked off`,
        );
      }
      // The daily check names one day, never anything else.
      if (
        inboxItemId.startsWith(INBOX_CATEGORIES.daily_check.idPrefix) &&
        !/^day-(?:0|-?[1-9]\d*)$/.test(inboxItemId.slice(INBOX_CATEGORIES.daily_check.idPrefix.length))
      ) {
        return reject(state, event, `inbox row ${inboxItemId} does not name a day for the daily check`);
      }
      const history = state.inboxCompletions[inboxItemId];
      if (inboxItemCompletionState(history) === "complete") {
        return reject(state, event, `inbox row ${inboxItemId} is already complete`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const entry: InboxCompletionEntry = { at: event.now, by: WARD_FLOW_ROLE_LABELS[event.role], kind: "completed" };
      return {
        ...state,
        inboxCompletions: { ...state.inboxCompletions, [inboxItemId]: [...(history ?? []), entry] },
      };
    }

    case "REOPEN_INBOX_ITEM": {
      const inboxItemId = event.inboxItemId.trim();
      if (inboxItemId.length === 0) {
        return reject(state, event, "REOPEN_INBOX_ITEM inboxItemId must name a row — a blank names nothing");
      }
      const history = state.inboxCompletions[inboxItemId];
      if (inboxItemCompletionState(history) !== "complete") {
        return reject(state, event, `inbox row ${inboxItemId} is not complete, so there is nothing to reopen`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const entry: InboxCompletionEntry = { at: event.now, by: WARD_FLOW_ROLE_LABELS[event.role], kind: "reopened" };
      return {
        ...state,
        inboxCompletions: { ...state.inboxCompletions, [inboxItemId]: [...(history ?? []), entry] },
      };
    }

    case "TAKE_INBOX_ITEM_OWNERSHIP": {
      const inboxItemId = event.inboxItemId.trim();
      if (!inboxRowExists(state, inboxItemId)) {
        return reject(
          state,
          event,
          `TAKE_INBOX_ITEM_OWNERSHIP inboxItemId ${inboxItemId} does not name a real inbox row`,
        );
      }
      const by = WARD_FLOW_ROLE_LABELS[event.role];
      const history = state.inboxOwnership[inboxItemId] ?? [];
      if (currentInboxOwner(history, inboxRowSince(state, inboxItemId))?.by === by) {
        return reject(state, event, `inbox row ${inboxItemId} is already owned by ${by}`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const entry: InboxOwnershipEntry = { at: event.now, by };
      return { ...state, inboxOwnership: { ...state.inboxOwnership, [inboxItemId]: [...history, entry] } };
    }

    case "RELEASE_INBOX_ITEM_OWNERSHIP": {
      const inboxItemId = event.inboxItemId.trim();
      const by = WARD_FLOW_ROLE_LABELS[event.role];
      const history = state.inboxOwnership[inboxItemId] ?? [];
      if (currentInboxOwner(history, inboxRowSince(state, inboxItemId))?.by !== by) {
        return reject(state, event, `inbox row ${inboxItemId} is not owned by ${by}, so there is nothing to release`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const entry: InboxOwnershipEntry = { at: event.now, by, kind: "released" };
      return { ...state, inboxOwnership: { ...state.inboxOwnership, [inboxItemId]: [...history, entry] } };
    }

    case "SNOOZE_INBOX_ITEM": {
      const inboxItemId = event.inboxItemId.trim();
      if (!inboxRowExists(state, inboxItemId)) {
        return reject(state, event, `SNOOZE_INBOX_ITEM inboxItemId ${inboxItemId} does not name a real inbox row`);
      }
      if (!SNOOZE_REASON_IDS.includes(event.reason)) {
        return reject(state, event, "SNOOZE_INBOX_ITEM reason must be one of SNOOZE_REASON_IDS");
      }
      if (typeof event.until !== "number" || !Number.isFinite(event.until) || event.until <= event.now) {
        return reject(state, event, "SNOOZE_INBOX_ITEM until must be a time after now");
      }
      if (event.until - event.now > SNOOZE_MAX_MINUTES) {
        return reject(state, event, `SNOOZE_INBOX_ITEM until must be within ${SNOOZE_MAX_MINUTES} minutes`);
      }
      if (!snoozeAllowed(event.until, event.now, inboxItemIsActNow(inboxItemId))) {
        return reject(
          state,
          event,
          `inbox row ${inboxItemId} is act now: it can be acknowledged but not snoozed past the act-now snooze cap`,
        );
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const entry: InboxSnoozeEntry = {
        at: event.now,
        by: WARD_FLOW_ROLE_LABELS[event.role],
        kind: "snoozed",
        until: event.until,
        reason: event.reason,
      };
      const history = state.inboxSnoozes[inboxItemId] ?? [];
      return { ...state, inboxSnoozes: { ...state.inboxSnoozes, [inboxItemId]: [...history, entry] } };
    }

    case "UNSNOOZE_INBOX_ITEM": {
      const inboxItemId = event.inboxItemId.trim();
      const history = state.inboxSnoozes[inboxItemId];
      if (!history || !activeSnooze(history, event.now, inboxRowSince(state, inboxItemId))) {
        return reject(state, event, `inbox row ${inboxItemId} is not snoozed, so there is nothing to return`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const entry: InboxSnoozeEntry = { at: event.now, by: WARD_FLOW_ROLE_LABELS[event.role], kind: "returned" };
      return { ...state, inboxSnoozes: { ...state.inboxSnoozes, [inboxItemId]: [...history, entry] } };
    }

    default:
      return null;
  }
}
