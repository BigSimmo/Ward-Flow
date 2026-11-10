import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { BedMeetingActionKind } from "@/components/ward-management/bed-meeting/bed-meeting-actions";

/**
 * END-OF-SHIFT HANDOVER OF YOUR WORK (feature build plan batch 3, item 21; D-136 item 2) and CARER
 * CALLBACK (item 23). Records and events only, with no screen code, so the reducer's frame can read
 * `isHandoverWorkEvent` without loading the slice (`handover-work-reducer.ts`) or the list model
 * (`handover-work-model.ts`).
 *
 * Item 21: near the end of a shift a desk hands one of its own open items to another desk
 * (`HAND_OVER_ITEM`). The item stays the sender's until the receiving desk taps Accept
 * (`ACCEPT_HANDED_ITEM`), which moves its owner on the item's own record. So an item has one owner
 * at all times, and a hand-over nobody accepted leaves it where it was. Never blocks sign-out.
 *
 * Item 23: a carer wants a call back, best after a typed time (`RECORD_CARER_CALLBACK`), ticked off
 * when the call is made (`MARK_CARER_CALLBACK_MADE`). It shows with the ring-back promises at
 * handover. 🔒 No carer name or phone number is held: the record has a stay or bed request, a time
 * and desks, and no typed text field at all.
 *
 * Owners and senders are DESKS (a role, and a ward for a ward desk), never people.
 */

/** A desk: a role, and the ward when the role is a ward. */
export type WorkDesk = { role: WardFlowRole; unitId?: string };

/** The open item a hand-over is about. Each names the record that holds its owner. */
export type HandedItemRef =
  /** A front-door referral the desk is handling (`Referral.ownerHistory`). */
  | { kind: "referral"; referralId: string }
  /** An open bed meeting chase (`meetingActions` on a bed request or a stay). */
  | { kind: "chase"; action: BedMeetingActionKind; movementId?: string; admissionId?: string }
  /** An open carer callback promise (item 23). */
  | { kind: "callback"; callbackId: string };

export type HandedItemKind = HandedItemRef["kind"];

/** One hand-over. Pending until `acceptedAt`; the item's own record says who owns it. */
export type HandedItemRecord = {
  /** "HI-N", minted by the reducer. */
  id: string;
  item: HandedItemRef;
  from: WorkDesk;
  to: WorkDesk;
  handedAt: Instant;
  acceptedAt?: Instant;
};

/** One carer callback promise. A stay or a bed request, a time and desks only: no name, no number. */
export type CarerCallbackRecord = {
  /** "CB-N", minted by the reducer. */
  id: string;
  admissionId?: string;
  movementId?: string;
  /** The ward the person is on or accepted to, when there is one, so ward desks see their own. */
  unitId?: string;
  /** The carer asked for a call after this time. */
  bestAfter: Instant;
  recordedAt: Instant;
  recordedBy: WardFlowRole;
  /** The desk that owes the call. Starts as the desk that recorded it; moves only on an accepted hand-over. */
  owner: WorkDesk;
  madeAt?: Instant;
  madeBy?: WardFlowRole;
};

export type HandoverWorkEvent =
  | {
      /** Item 21: hand one of this desk's own open items to another desk. The owner does not change yet. */
      type: "HAND_OVER_ITEM";
      role: WardFlowRole;
      /** The board clock. Typed `number`, as other events beside their records, so re-anchoring reads records only. */
      now: number;
      item: HandedItemRef;
      /** The receiving desk's role, chosen from the roles that item can be owned by. */
      toRole: WardFlowRole;
      /** Claim, not proof, as `REQUEST_WARD_STAFF`: required of a ward desk, which hands only its own. */
      actingUnitId?: string;
    }
  | {
      /** Item 21: the receiving desk accepts a hand-over; the item's owner becomes that desk. */
      type: "ACCEPT_HANDED_ITEM";
      role: WardFlowRole;
      now: number;
      handedItemId: string;
      actingUnitId?: string;
    }
  | {
      /** Item 23: a carer wants a call back, best after `bestAfter`. One stay or one bed request. */
      type: "RECORD_CARER_CALLBACK";
      role: WardFlowRole;
      now: number;
      admissionId?: string;
      movementId?: string;
      /** The typed time, as the next instant at or after now with that clock time. */
      bestAfter: number;
      actingUnitId?: string;
    }
  | {
      /** Item 23: the call back was made. Ticks the promise off. */
      type: "MARK_CARER_CALLBACK_MADE";
      role: WardFlowRole;
      now: number;
      callbackId: string;
      actingUnitId?: string;
    };

const HANDOVER_WORK_EVENT_TYPES: ReadonlySet<string> = new Set<HandoverWorkEvent["type"]>([
  "HAND_OVER_ITEM",
  "ACCEPT_HANDED_ITEM",
  "RECORD_CARER_CALLBACK",
  "MARK_CARER_CALLBACK_MADE",
]);

/** True for the four events above; the reducer routes them to their own lazily loaded slice. */
export function isHandoverWorkEvent(event: { type: string }): event is HandoverWorkEvent {
  return HANDOVER_WORK_EVENT_TYPES.has(event.type);
}

/** Whether two desks are the same desk: the same role, and for a ward the same ward. */
export function sameDesk(left: WorkDesk, right: WorkDesk): boolean {
  return left.role === right.role && (left.role !== "ward" || left.unitId === right.unitId);
}
