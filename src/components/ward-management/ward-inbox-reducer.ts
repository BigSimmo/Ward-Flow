import type { AuditDecision } from "./ward-audit";
import type { Instant } from "./ward-clock";
import type { WardFlowEvent } from "./ward-flow-events";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Movement, Notice } from "./ward-model";
import { SNOOZE_MAX_MINUTES } from "./ward-operational-defaults";
import {
  activeSnooze,
  currentInboxOwner,
  snoozeAllowed,
  SNOOZE_REASON_IDS,
  type InboxOwnershipEntry,
  type InboxSnoozeEntry,
} from "./ward-inbox-snooze";

export type InboxAcknowledgement = {
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
  /** Stream A, 9 Oct 2026: a referral not answered within its decision target (default, set in Settings). */
  target_referral_decision: { idPrefix: "target-referral-decision-", kind: "fact" },
  /** An accepted transfer whose bed has not been pulled within its target. */
  target_transfer_acceptance: { idPrefix: "target-transfer-acceptance-", kind: "fact" },
  /** A pulled bed with no transport booked within its target. */
  target_transport_booked: { idPrefix: "target-transport-booked-", kind: "fact" },
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
export const INBOX_REVIEW_CATEGORIES: readonly (keyof typeof INBOX_CATEGORIES)[] = ["transport_awaiting_departure"];

/** Whether a row is act-now (red), read from its id alone so the reducer can enforce the snooze cap. */
export function inboxItemIsActNow(inboxItemId: string): boolean {
  return !INBOX_REVIEW_CATEGORIES.some((key) => inboxItemId.startsWith(INBOX_CATEGORIES[key].idPrefix));
}

/**
 * Whether an id names a real inbox row: a known category prefix and an existing movement after
 * it. Used by the ownership and snooze events; the same test `ACKNOWLEDGE_INBOX_ITEM` applies.
 */
export function inboxRowExists(state: WardFlowState, inboxItemId: string): boolean {
  const category = Object.values(INBOX_CATEGORIES)
    .filter((entry) => inboxItemId.startsWith(entry.idPrefix))
    .sort((a, b) => b.idPrefix.length - a.idPrefix.length)[0];
  if (!category) return false;
  const movementId = inboxItemId.slice(category.idPrefix.length);
  return state.movements.some((movement: Movement) => movement.id === movementId);
}

/**
 * Handles inbox and notices events:
 * - MARK_NOTICE_READ
 * - ACKNOWLEDGE_INBOX_ITEM
 * - COMPLETE_INBOX_ITEM
 * - REOPEN_INBOX_ITEM
 * - TAKE_INBOX_ITEM_OWNERSHIP, SNOOZE_INBOX_ITEM, UNSNOOZE_INBOX_ITEM (stream A, 9 Oct 2026)
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
      if (!inboxCategory || !state.movements.some((movement: Movement) => movement.id === inboxMovementId)) {
        return reject(
          state,
          event,
          `ACKNOWLEDGE_INBOX_ITEM inboxItemId ${inboxItemId} does not name a real inbox row — its prefix must be one of INBOX_CATEGORIES and its remainder an existing movement id`,
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
      if (currentInboxOwner(history)?.by === by) {
        return reject(state, event, `inbox row ${inboxItemId} is already owned by ${by}`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const entry: InboxOwnershipEntry = { at: event.now, by };
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
      if (!activeSnooze(history, event.now)) {
        return reject(state, event, `inbox row ${inboxItemId} is not snoozed, so there is nothing to return`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const entry: InboxSnoozeEntry = { at: event.now, by: WARD_FLOW_ROLE_LABELS[event.role], kind: "returned" };
      return { ...state, inboxSnoozes: { ...state.inboxSnoozes, [inboxItemId]: [...(history ?? []), entry] } };
    }

    default:
      return null;
  }
}
