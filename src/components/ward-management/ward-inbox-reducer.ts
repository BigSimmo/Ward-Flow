import type { AuditDecision } from "./ward-audit";
import type { Instant } from "./ward-clock";
import type { WardFlowEvent } from "./ward-flow-events";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Movement, Notice } from "./ward-model";

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
  /** An involuntary patient's admission or transfer with a carer, PSP or MHAS notification not yet
   *  recorded (advisory). Leaves when every party has a record. Remainder is the movement id. */
  support_notification_arrival: { idPrefix: "notify-arrival-", kind: "fact" },
  /** The same, for a discharge. Remainder is the discharged stay's admission id (a stay may have
   *  no movement), checked against `state.admissions` by `ACKNOWLEDGE_INBOX_ITEM`. */
  support_notification_discharge: { idPrefix: "notify-discharge-", kind: "fact" },
} as const satisfies Record<string, { readonly idPrefix: string; readonly kind: InboxItemKind }>;

/**
 * What kind of row an InboxItem.id names, or undefined if nothing in INBOX_CATEGORIES claims it.
 */
export function inboxItemKindOf(inboxItemId: string): InboxItemKind | undefined {
  const category = Object.values(INBOX_CATEGORIES).find((entry) => inboxItemId.startsWith(entry.idPrefix));
  return category?.kind;
}

/**
 * Handles inbox and notices events:
 * - MARK_NOTICE_READ
 * - ACKNOWLEDGE_INBOX_ITEM
 * - COMPLETE_INBOX_ITEM
 * - REOPEN_INBOX_ITEM
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
      // A discharge notification row names its stay, which may have no movement.
      const namesRecord =
        inboxCategory === INBOX_CATEGORIES.support_notification_discharge
          ? state.admissions.some((admission) => admission.id === inboxMovementId)
          : state.movements.some((movement: Movement) => movement.id === inboxMovementId);
      if (!inboxCategory || !namesRecord) {
        return reject(
          state,
          event,
          `ACKNOWLEDGE_INBOX_ITEM inboxItemId ${inboxItemId} does not name a real inbox row — its prefix must be one of INBOX_CATEGORIES and its remainder an existing movement id (an admission id for a discharge notification row)`,
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

    default:
      return null;
  }
}
