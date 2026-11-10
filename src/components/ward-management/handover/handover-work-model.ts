import type { Instant } from "@/components/ward-management/ward-clock";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import {
  BED_MEETING_ACTION_OWNERS,
  openMeetingAction,
  type BedMeetingAction,
} from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { REFERRAL_OWNER_DESKS } from "@/components/ward-management/referrals/referral-owner-and-calls";
import {
  currentReferralOwner,
  referralClosedForFollowUp,
} from "@/components/ward-management/referrals/referral-owner-and-calls-model";

import {
  sameDesk,
  type CarerCallbackRecord,
  type HandedItemRecord,
  type HandedItemRef,
  type WorkDesk,
} from "./handover-work-events";

/**
 * Read-only selectors for item 21 (handing your own open work on at the end of a shift) and item 23
 * (carer callbacks). The reducer slice and the screens both read these, so the rules cannot drift.
 * Nothing here ranks an item or a person: lists keep a clock order.
 */

/**
 * D-136 item 2 (Josh, 10 Nov 2026): the handover page lists your own open work, with "Hand to", once
 * the shift has this long or less to run. A prompt only: sign-out is never blocked.
 */
export const HANDOVER_OWN_WORK_LEAD_MINUTES = CLINICAL_VALUES.handoverOwnWorkLead.value;

/** Whether the shift `now` falls in has `HANDOVER_OWN_WORK_LEAD_MINUTES` or less to run. */
export function ownWorkListOpen(now: Instant): boolean {
  return shiftEndInstant(now) - now <= HANDOVER_OWN_WORK_LEAD_MINUTES;
}

/** The furthest ahead a carer's "best after" time may be: the same clock time tomorrow at most. */
export const CARER_CALLBACK_MAX_AHEAD_MINUTES = MINUTES_PER_DAY;

/** The next instant at or after `now` whose clock time is `minuteOfDay` (0 to 1439). */
export function nextClockInstant(minuteOfDay: number, now: Instant): Instant {
  const nowMinute = ((Math.floor(now) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const dayStart = Math.floor(now) - nowMinute;
  const today = dayStart + minuteOfDay;
  return today >= Math.floor(now) ? today : today + MINUTES_PER_DAY;
}

type WorkState = Pick<WardFlowState, "referrals" | "movements" | "admissions"> & {
  carerCallbacks?: readonly CarerCallbackRecord[];
  handedItems?: readonly HandedItemRecord[];
};

/** A stable key per item, so a later hand-over of the same item replaces an earlier one. */
export function handedItemKey(item: HandedItemRef): string {
  switch (item.kind) {
    case "referral":
      return `referral:${item.referralId}`;
    case "chase":
      return item.movementId !== undefined
        ? `chase:movement:${item.movementId}:${item.action}`
        : `chase:admission:${item.admissionId}:${item.action}`;
    case "callback":
      return `callback:${item.callbackId}`;
  }
}

/** Open carer callbacks: not yet made. Recorded order. */
export function openCarerCallbacks(state: { carerCallbacks?: readonly CarerCallbackRecord[] }): CarerCallbackRecord[] {
  return (state.carerCallbacks ?? []).filter((record) => record.madeAt === undefined);
}

/** Item 23: open carer callbacks whose "best after" time has come, earliest first. Handover's promises due. */
export function carerCallbacksDue(
  state: { carerCallbacks?: readonly CarerCallbackRecord[] },
  now: Instant,
): CarerCallbackRecord[] {
  return openCarerCallbacks(state)
    .filter((record) => record.bestAfter <= now)
    .sort((left, right) => left.bestAfter - right.bestAfter);
}

/** The open callback for one stay or bed request, if any. One open callback per person. */
export function openCarerCallbackFor(
  state: { carerCallbacks?: readonly CarerCallbackRecord[] },
  subject: { admissionId?: string; movementId?: string },
): CarerCallbackRecord | undefined {
  return openCarerCallbacks(state).find((record) =>
    subject.admissionId !== undefined
      ? record.admissionId === subject.admissionId
      : subject.movementId !== undefined && record.movementId === subject.movementId,
  );
}

function chaseRecord(state: WorkState, item: Extract<HandedItemRef, { kind: "chase" }>) {
  if (item.movementId !== undefined) return state.movements.find((movement) => movement.id === item.movementId);
  if (item.admissionId !== undefined) return state.admissions.find((admission) => admission.id === item.admissionId);
  return undefined;
}

function actionDesk(action: BedMeetingAction): WorkDesk {
  return action.owner === "ward" ? { role: "ward", unitId: action.ownerUnitId } : { role: action.owner };
}

/**
 * Who owns an open item now, read from the item's own record. Undefined once the item is closed (an
 * accepted referral, a chase marked done, a call made) or when it names nothing. One owner always.
 */
export function itemOwner(state: WorkState, item: HandedItemRef): WorkDesk | undefined {
  switch (item.kind) {
    case "referral": {
      const referral = state.referrals.find((candidate) => candidate.id === item.referralId);
      if (!referral || referralClosedForFollowUp(referral)) return undefined;
      const owner = currentReferralOwner(referral);
      return owner ? { role: owner.owner } : undefined;
    }
    case "chase": {
      const action = openMeetingAction(chaseRecord(state, item)?.meetingActions, item.action);
      return action ? actionDesk(action) : undefined;
    }
    case "callback": {
      const record = openCarerCallbacks(state).find((candidate) => candidate.id === item.callbackId);
      return record?.owner;
    }
  }
}

/** The ward an item is about, when it has one: the stay's ward, or the ward that accepted the bed request. */
function itemWard(state: WorkState, item: HandedItemRef): string | undefined {
  if (item.kind === "callback")
    return (state.carerCallbacks ?? []).find((record) => record.id === item.callbackId)?.unitId;
  if (item.kind === "chase") {
    if (item.admissionId !== undefined)
      return state.admissions.find((admission) => admission.id === item.admissionId)?.unitId;
    return state.movements.find((movement) => movement.id === item.movementId)?.acceptedUnitId;
  }
  return undefined;
}

/** The roles each kind of item can be owned by. */
const OWNER_ROLES: Record<HandedItemRef["kind"], readonly WardFlowRole[]> = {
  referral: REFERRAL_OWNER_DESKS,
  chase: BED_MEETING_ACTION_OWNERS,
  callback: ["coordinator", "ward"],
};

/**
 * The desks an item may be handed to: the roles its record can be owned by, less its owner now. A
 * ward is offered only as the item's own ward, so a hand-over never moves an item to a ward it is
 * not about. Fixed order; nothing is suggested or chosen in advance.
 */
export function handOverTargets(state: WorkState, item: HandedItemRef): WorkDesk[] {
  const owner = itemOwner(state, item);
  if (!owner) return [];
  const ward = itemWard(state, item);
  return OWNER_ROLES[item.kind]
    .map((role): WorkDesk | undefined =>
      role === "ward" ? (ward !== undefined ? { role, unitId: ward } : undefined) : { role },
    )
    .filter((desk): desk is WorkDesk => desk !== undefined && !sameDesk(desk, owner));
}

/**
 * The hand-over still waiting for this item, if any: the latest one made, not yet accepted, and from
 * the desk that still owns the item. A hand-over lapses when the item closes or its owner changes
 * some other way, so a stale Accept can never move an item.
 */
export function pendingHandOver(state: WorkState, item: HandedItemRef): HandedItemRecord | undefined {
  const key = handedItemKey(item);
  const latest = (state.handedItems ?? []).filter((record) => handedItemKey(record.item) === key).at(-1);
  if (!latest || latest.acceptedAt !== undefined) return undefined;
  const owner = itemOwner(state, item);
  return owner && sameDesk(owner, latest.from) ? latest : undefined;
}

/** One open item this desk owns. `pending` is a hand-over not yet accepted: the item is still this desk's. */
export type OwnWorkItem = { key: string; item: HandedItemRef; sortAt: Instant; pending?: HandedItemRecord };

/**
 * Everything this desk owns that is still open: referrals it is handling, bed meeting chases and
 * carer callbacks. Ordered by when each is due (a referral by when it was taken on), a clock order.
 */
export function ownWorkItems(state: WorkState, desk: WorkDesk): OwnWorkItem[] {
  const items: { item: HandedItemRef; sortAt: Instant }[] = [];
  for (const referral of state.referrals) {
    const owner = currentReferralOwner(referral);
    if (!owner || owner.owner !== desk.role || referralClosedForFollowUp(referral)) continue;
    items.push({ item: { kind: "referral", referralId: referral.id }, sortAt: owner.at });
  }
  const chases = (subject: { movementId?: string; admissionId?: string }, actions?: readonly BedMeetingAction[]) => {
    for (const action of actions ?? []) {
      if (action.doneAt !== undefined || !sameDesk(actionDesk(action), desk)) continue;
      items.push({ item: { kind: "chase", action: action.kind, ...subject }, sortAt: action.dueAt });
    }
  };
  for (const movement of state.movements) chases({ movementId: movement.id }, movement.meetingActions);
  for (const admission of state.admissions) chases({ admissionId: admission.id }, admission.meetingActions);
  for (const record of openCarerCallbacks(state))
    if (sameDesk(record.owner, desk))
      items.push({ item: { kind: "callback", callbackId: record.id }, sortAt: record.bestAfter });
  return items
    .sort((left, right) => left.sortAt - right.sortAt)
    .map(({ item, sortAt }) => ({ key: handedItemKey(item), item, sortAt, pending: pendingHandOver(state, item) }));
}

/** Hand-overs waiting for this desk to accept, oldest first. Shown at any time of the shift. */
export function incomingHandOvers(state: WorkState, desk: WorkDesk): HandedItemRecord[] {
  const seen = new Set<string>();
  const waiting: HandedItemRecord[] = [];
  for (const record of [...(state.handedItems ?? [])].reverse()) {
    const key = handedItemKey(record.item);
    if (seen.has(key)) continue;
    seen.add(key);
    if (sameDesk(record.to, desk) && pendingHandOver(state, record.item)?.id === record.id) waiting.push(record);
  }
  return waiting.sort((left, right) => left.handedAt - right.handedAt);
}
