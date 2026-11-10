import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { BED_MEETING_ACTION_KIND_IDS } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import type { ReferralOwnerDesk } from "@/components/ward-management/referrals/referral-owner-and-calls";

import {
  sameDesk,
  type CarerCallbackRecord,
  type HandedItemRecord,
  type HandedItemRef,
  type HandoverWorkEvent,
  type WorkDesk,
} from "./handover-work-events";
import {
  CARER_CALLBACK_MAX_AHEAD_MINUTES,
  handOverTargets,
  itemOwner,
  openCarerCallbackFor,
  pendingHandOver,
} from "./handover-work-model";

/*
 * The reducer slice for items 21 and 23 (`handover-work-events.ts`), loaded lazily with the other
 * slices (`ward-flow-reducer-slices.ts`). Who may send each event is `EVENT_ROLE`; which places is
 * the shared server's check. A hand-over changes no owner until it is accepted, and accepting moves
 * the owner on the item's own record, so every other screen reads the same one owner.
 */

type Reject = (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;

/** The next "HI-N" or "CB-N" id: one past the highest number already used with that prefix. */
function nextId(rows: readonly { id: string }[], prefix: "HI" | "CB"): string {
  const used = rows.map((row) => (row.id.startsWith(`${prefix}-`) ? Number(row.id.slice(prefix.length + 1)) : 0));
  return `${prefix}-${Math.max(0, ...used.filter(Number.isInteger)) + 1}`;
}

/** The sending or accepting desk: its role, and for a ward desk the ward it names. */
function deskOf(event: { role: WorkDesk["role"]; actingUnitId?: string }): WorkDesk {
  return event.role === "ward" ? { role: "ward", unitId: event.actingUnitId } : { role: event.role };
}

/** The item as a fresh object from its checked fields, or null when it is not one of the three kinds. */
function checkedItem(item: unknown): HandedItemRef | null {
  if (typeof item !== "object" || item === null) return null;
  const fields = item as Record<string, unknown>;
  const text = (value: unknown) => typeof value === "string" && value.length > 0;
  switch (fields.kind) {
    case "referral":
      return text(fields.referralId) ? { kind: "referral", referralId: fields.referralId as string } : null;
    case "callback":
      return text(fields.callbackId) ? { kind: "callback", callbackId: fields.callbackId as string } : null;
    case "chase": {
      if (!BED_MEETING_ACTION_KIND_IDS.includes(fields.action as string)) return null;
      const action = fields.action as Extract<HandedItemRef, { kind: "chase" }>["action"];
      if (text(fields.movementId) && fields.admissionId === undefined)
        return { kind: "chase", action, movementId: fields.movementId as string };
      if (text(fields.admissionId) && fields.movementId === undefined)
        return { kind: "chase", action, admissionId: fields.admissionId as string };
      return null;
    }
    default:
      return null;
  }
}

/** Moves the item's owner on its own record to `to`. The item is known to be open. */
function withOwner(state: WardFlowState, item: HandedItemRef, to: WorkDesk, event: HandoverWorkEvent): WardFlowState {
  switch (item.kind) {
    case "referral":
      return {
        ...state,
        referrals: state.referrals.map((referral) =>
          referral.id === item.referralId
            ? {
                ...referral,
                ownerHistory: [
                  ...(referral.ownerHistory ?? []),
                  { owner: to.role as ReferralOwnerDesk, at: event.now, by: WARD_FLOW_ROLE_LABELS[event.role] },
                ],
              }
            : referral,
        ),
      };
    case "chase": {
      const moveAction = <T extends { meetingActions?: WardFlowState["movements"][number]["meetingActions"] }>(
        record: T,
      ): T => ({
        ...record,
        meetingActions: record.meetingActions?.map((action) => {
          if (action.kind !== item.action || action.doneAt !== undefined) return action;
          const { ownerUnitId: _previous, ...rest } = action;
          void _previous;
          return to.role === "ward"
            ? { ...rest, owner: "ward", ownerUnitId: to.unitId }
            : { ...rest, owner: to.role as typeof action.owner };
        }),
      });
      return item.movementId !== undefined
        ? { ...state, movements: state.movements.map((row) => (row.id === item.movementId ? moveAction(row) : row)) }
        : {
            ...state,
            admissions: state.admissions.map((row) => (row.id === item.admissionId ? moveAction(row) : row)),
          };
    }
    case "callback":
      return {
        ...state,
        carerCallbacks: (state.carerCallbacks ?? []).map((record) =>
          record.id === item.callbackId ? { ...record, owner: to } : record,
        ),
      };
  }
}

export function reduceHandoverWork(state: WardFlowState, event: HandoverWorkEvent, reject: Reject): WardFlowState {
  if (!Number.isFinite(event.now)) return reject(state, event, `${event.type} requires a finite current time`);
  if (event.role === "ward" && (typeof event.actingUnitId !== "string" || event.actingUnitId.length === 0))
    return reject(state, event, `${event.type} by a ward names its own ward`);
  switch (event.type) {
    case "HAND_OVER_ITEM": {
      const item = checkedItem(event.item);
      if (!item) return reject(state, event, "HAND_OVER_ITEM names a referral, a chase or a carer callback");
      const owner = itemOwner(state, item);
      if (!owner) return reject(state, event, "This item is no longer open");
      const from = deskOf(event);
      if (!sameDesk(owner, from)) return reject(state, event, "Only the desk that owns an item hands it over");
      const to = handOverTargets(state, item).find((desk) => desk.role === event.toRole);
      if (!to) return reject(state, event, "This item cannot be handed to that desk");
      const records = state.handedItems ?? [];
      const record: HandedItemRecord = { id: nextId(records, "HI"), item, from, to, handedAt: event.now };
      return { ...state, handedItems: [...records, record] };
    }
    case "ACCEPT_HANDED_ITEM": {
      const records = state.handedItems ?? [];
      const record = records.find((candidate) => candidate.id === event.handedItemId);
      if (!record) return reject(state, event, "There is no hand-over to accept");
      if (record.acceptedAt !== undefined) return reject(state, event, "This hand-over is already accepted");
      if (pendingHandOver(state, record.item)?.id !== record.id)
        return reject(state, event, "This hand-over is no longer waiting: the item closed or has a new owner");
      if (!sameDesk(deskOf(event), record.to)) return reject(state, event, "This hand-over is for another desk");
      const accepted = withOwner(state, record.item, record.to, event);
      return {
        ...accepted,
        handedItems: records.map((candidate) =>
          candidate === record ? { ...candidate, acceptedAt: event.now } : candidate,
        ),
      };
    }
    case "RECORD_CARER_CALLBACK": {
      const hasAdmission = typeof event.admissionId === "string";
      if (hasAdmission === (typeof event.movementId === "string"))
        return reject(state, event, "A carer callback names one stay or one bed request");
      let unitId: string | undefined;
      if (hasAdmission) {
        const admission = state.admissions.find((candidate) => candidate.id === event.admissionId);
        if (!admission || admission.state === "departed")
          return reject(state, event, `no current stay found for id ${event.admissionId}`);
        unitId = admission.unitId;
      } else {
        const movement = state.movements.find((candidate) => candidate.id === event.movementId);
        if (!movement || movement.closure || movement.stage === "arrived")
          return reject(state, event, `no open bed request found for id ${event.movementId}`);
        unitId = movement.acceptedUnitId;
      }
      if (event.role === "ward" && event.actingUnitId !== unitId)
        return reject(state, event, "A ward records a carer callback for its own patients only");
      if (
        !Number.isInteger(event.bestAfter) ||
        event.bestAfter < Math.floor(event.now) ||
        event.bestAfter > event.now + CARER_CALLBACK_MAX_AHEAD_MINUTES
      )
        return reject(state, event, "The best-after time must be a typed time from now to this time tomorrow");
      const records = state.carerCallbacks ?? [];
      const subject = hasAdmission ? { admissionId: event.admissionId } : { movementId: event.movementId };
      // One open callback per person: asking again moves its time rather than adding a second.
      const existing = openCarerCallbackFor(state, subject);
      if (existing)
        return {
          ...state,
          carerCallbacks: records.map((record) =>
            record === existing ? { ...record, bestAfter: event.bestAfter } : record,
          ),
        };
      const record: CarerCallbackRecord = {
        id: nextId(records, "CB"),
        ...subject,
        ...(unitId !== undefined ? { unitId } : {}),
        bestAfter: event.bestAfter,
        recordedAt: event.now,
        recordedBy: event.role,
        owner: deskOf(event),
      };
      return { ...state, carerCallbacks: [...records, record] };
    }
    case "MARK_CARER_CALLBACK_MADE": {
      const records = state.carerCallbacks ?? [];
      const record = records.find((candidate) => candidate.id === event.callbackId);
      if (!record) return reject(state, event, "There is no carer callback to tick off");
      if (record.madeAt !== undefined) return reject(state, event, "This call back is already ticked off");
      if (event.role === "ward" && event.actingUnitId !== record.unitId)
        return reject(state, event, "A ward ticks off its own patients' call backs only");
      return {
        ...state,
        carerCallbacks: records.map((candidate) =>
          candidate === record ? { ...candidate, madeAt: event.now, madeBy: event.role } : candidate,
        ),
      };
    }
  }
}
