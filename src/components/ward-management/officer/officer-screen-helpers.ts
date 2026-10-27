// The transport officer screen's pure helpers: the refusal labels, the blocked-reason checks behind
// each step button, the job's leg and ETA readings and the highlight and tab types. Split out of
// `officer-screen.tsx`, which re-exports the helpers it exported.
import {
  EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE,
  examinationRevokedWhileBedHeld,
  stageCopy,
  transportLeg,
} from "@/components/ward-management/ward-derivations";
import { type Instant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { CAD_TO_FOLLOW, cadNumberToFollow } from "@/components/ward-management/ward-cad-number";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import type { Movement, TransportJob, Unit } from "@/components/ward-management/ward-model";
import { STAGE_TRANSITION_BLOCKERS } from "@/components/ward-management/ward-flow-reducer";
import type { WfTone } from "@/components/wf";
import { transportEtaRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { wardLabel } from "@/components/ward-management/ward-absence-labels";

/**
 * `TRANSPORT_ACCEPTED`'s own preconditions (`ward-flow-reducer.ts`), named here so the Accepted
 * button can never advertise an action the reducer would refuse — the same discipline
 * `ward-screen.tsx`'s `referralAnswerBlocked`/`holdBlockedReason` and `shortlist-panel.tsx`'s
 * `canRefer` already hold to. The two branches below are read straight off the reducer's own
 * `case "TRANSPORT_ACCEPTED"`, in the same order, so the two can never silently drift apart.
 */
/**
 * The four actions this screen dispatches, read back as THE WORDS ALREADY ON THE BUTTON.
 *
 * ⚠️ `Rejection.attempted` is the event's own type string verbatim (see `makeRejection` in
 * `ward-flow-reducer.ts`) — `PATIENT_COLLECTED`, not "Collected". Rendering it raw would put a
 * SCREAMING_CASE token in front of a clinician, which this repository has already had to repair
 * once on a clinical heading. Same shape and same reason as `WARD_ACTION_REJECTION_LABELS` in
 * `ward-screen.tsx`.
 *
 * 🔴 THIS MAP IS ALSO THE SCOPE FILTER, AND THAT IS DELIBERATE. A refusal whose `attempted` is not
 * one of these four is not this screen's business — and because an unknown key is dropped rather
 * than displayed, no event type added later can render as a raw token here by default. The filter
 * and the anti-token guarantee are the same line of code.
 *
 * ⚠️ IT FILTERS BY ACTION, NEVER BY THE JOBS VISIBLE ABOVE. The refusal this surface exists for
 * happens exactly when somebody else has closed the movement, which REMOVES it from the job list.
 * Scoping to what is on screen is the intuitive choice and would hide the motivating case.
 *
 * ⚠️ And `Rejection.movementId` holds a REFERRAL id for the referral events, so showing everything
 * would print referral ids under a movement label. These four are all movement-scoped.
 */
export const OFFICER_ACTION_REJECTION_LABELS: Record<string, string> = {
  TRANSPORT_ACCEPTED: "Accepted",
  TRANSPORT_EN_ROUTE: "En route",
  PATIENT_COLLECTED: "Collected",
  // The officer's last step reads "Arrived at ward" (Josh, 26 Oct 2026, H-0808 and H-0809, replacing
  // item 31's "Delivered"). The event dispatched stays `PATIENT_ARRIVED`, and it ends the transport
  // leg only: the receiving ward still confirms the patient's arrival (A4-16).
  PATIENT_ARRIVED: "Arrived at ward",
};

/*
 * 🔴 EVERY PREDICATE BELOW MUST CHECK `movement.closure` FIRST, AND THAT CHECK WAS MISSING FROM ALL
 * FOUR UNTIL 2026-09-04.
 *
 * The four reducer cases these mirror — TRANSPORT_ACCEPTED, TRANSPORT_EN_ROUTE, PATIENT_COLLECTED,
 * PATIENT_ARRIVED — each reject a closed movement before anything else. These predicates mirrored
 * the stage and transport preconditions and omitted the closure one. So on a movement an ED user
 * had closed, the officer's button RENDERED ENABLED, the press produced a rejection, and the
 * movement came back byte-identical. A clinician pressed a button on a phone and nothing happened
 * and nothing said why.
 *
 * ⚠️ CLOSURE IS CHECKED FIRST HERE BECAUSE IT IS CHECKED FIRST THERE. Order is not cosmetic: a
 * closed movement also fails the stage guard, so putting closure second would show the clinician a
 * stage message for a movement that has ENDED — true, and the wrong reason.
 *
 * ⚠️ AND READ THIS BEFORE TRUSTING A COMMENT ON ONE OF THESE. Each of these functions carried a
 * comment saying it "mirrors `case X` exactly"; the arrival one went further and named the floor
 * guard on empty beds as its evidence of completeness. Every word of that was TRUE, and all four
 * omitted closure. A COMMENT THAT ENUMERATES WHAT IT COVERS READS AS AN INVENTORY, and `ed-screen.tsx`
 * then cited these four as the convention to hold to. The enumeration is what stopped anyone looking.
 *
 * `tests/ward-officer-blocked-reason-parity.test.ts` now DRIVES every movement each predicate
 * permits through the matching reducer case and asserts none is rejected. That is the check that
 * cannot be satisfied by a comment: it never reads either implementation.
 */
/**
 * The WLQ-4 guard `TRANSPORT_ACCEPTED` and `TRANSPORT_EN_ROUTE` both apply right after closure: an
 * examination revoked (or turned into a community order) while the bed is still held, or the
 * movement's blocker saying it awaits that release. Added 25 Sept 2026 (live walkthrough): these
 * two predicates omitted it, so the officer was offered buttons the reducer then refused.
 */
export function revokedHoldingBedReason(movement: Movement, action: string, who?: string): string | undefined {
  if (
    examinationRevokedWhileBedHeld(movement) ||
    movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease
  ) {
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    return `${who ?? "This patient"} cannot be ${action}: ${EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE.charAt(0).toLowerCase()}${EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE.slice(1)}`;
  }
  return undefined;
}

export function acceptedBlockedReason(movement: Movement, who?: string): string | undefined {
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  if (movement.closure) {
    return `${who ?? "This patient"} has already closed (${movement.closure.reason}). Transport cannot be accepted for a movement that has ended.`;
  }
  const revoked = revokedHoldingBedReason(movement, "accepted for transport", who);
  if (revoked) return revoked;
  if (movement.stage !== "handover_ready" || !movement.transport) {
    return `${who ?? "This patient"} is ${stageCopy[movement.stage].label.toLowerCase()}, not ready for a transport handover.`;
  }
  if (movement.transport.acceptedAt !== undefined) {
    return `Transport for ${who ?? "this patient"} was already accepted.`;
  }
  return undefined;
}

/** Mirrors `case "TRANSPORT_EN_ROUTE"`, closure guard first. See the block above the group. */
export function enRouteBlockedReason(movement: Movement, who?: string): string | undefined {
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  if (movement.closure) {
    return `${who ?? "This patient"} has already closed (${movement.closure.reason}). Transport cannot be moved for a movement that has ended.`;
  }
  const revoked = revokedHoldingBedReason(movement, "sent en route", who);
  if (revoked) return revoked;
  if (movement.stage !== "handover_ready" || movement.transport?.acceptedAt === undefined) {
    return (
      `Transport for ${who ?? "this patient"} cannot go en route: the movement must be at ` +
      `${stageCopy.handover_ready.label} with transport accepted (it is at ` +
      `${stageCopy[movement.stage].label}, transport ` +
      `${movement.transport?.acceptedAt === undefined ? "not accepted" : "accepted"}).`
    );
  }
  if (movement.transport.enRouteAt !== undefined) {
    return `Transport for ${who ?? "this patient"} is already en route.`;
  }
  return undefined;
}

/** Mirrors `case "PATIENT_COLLECTED"`, closure guard first. The reducer carries no "already
 * collected" check of its own — collecting moves the stage to `moving`, so the stage guard already
 * covers a second attempt — and this stays a faithful mirror rather than adding a check the reducer
 * lacks. ⚠️ That sentence was true while the function omitted closure entirely; it describes one
 * deliberate omission and was silent about an accidental one. See the block above the group. */
export function collectedBlockedReason(movement: Movement, who?: string): string | undefined {
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  if (movement.closure) {
    return `${who ?? "This patient"} has already closed (${movement.closure.reason}). A patient cannot be collected for a movement that has ended.`;
  }
  if (examinationRevokedWhileBedHeld(movement)) {
    return `${who ?? "This patient"} cannot be collected: ${EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE.charAt(0).toLowerCase()}${EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE.slice(1)}`;
  }
  if (movement.stage !== "handover_ready" || movement.transport?.enRouteAt === undefined) {
    return (
      `${who ?? "This patient"} cannot be marked collected: the movement must be at ` +
      `${stageCopy.handover_ready.label} with transport en route (it is at ` +
      `${stageCopy[movement.stage].label}, transport ` +
      `${movement.transport?.enRouteAt === undefined ? "not en route" : "en route"}).`
    );
  }
  return undefined;
}

/**
 * Mirrors `case "PATIENT_ARRIVED"`, closure guard first. There is deliberately NO empty-bed guard:
 * the reducer accepts an arrival into a full ward and records it as "Arrived — Bed Turnaround", so
 * refusing it here stopped the officer recording a patient who had physically arrived (live
 * walkthrough, 25 Sept 2026).
 */
export function arrivedBlockedReason(movement: Movement, unit: Unit | undefined, who?: string): string | undefined {
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  if (movement.closure) {
    return `${who ?? "This patient"} has already closed (${movement.closure.reason}). A patient cannot be marked arrived for a movement that has ended.`;
  }
  if (movement.transport?.diversion) {
    return `${who ?? "This patient"} was diverted; release the pulled bed rather than recording delivery.`;
  }
  // A4-16: Delivered ends the transport leg once; the receiving ward then confirms arrival.
  if (movement.transport?.arrivedAt !== undefined) {
    return `${who ?? "This patient"} was already delivered. The receiving ward confirms arrival.`;
  }
  if (movement.stage !== "moving" || movement.transport?.collectedAt === undefined) {
    return `${who ?? "This patient"} cannot be marked arrived before the patient has been collected.`;
  }
  if (!movement.acceptedUnitId) {
    return `${who ?? "This patient"} has no accepted destination unit recorded.`;
  }
  if (!unit) {
    return `${who ?? "This patient"}'s accepted destination is ${wardLabel(movement.acceptedUnitId, undefined)}.`;
  }
  return undefined;
}

export function formRequiredLabel(transport: TransportJob): string {
  // Recorded code only — do not imply the officer holds a live MHA instrument.
  if (!transport.formRequired) return "No transport form recorded";
  const raw = transport.formRequired.trim();
  if (/^Form\s+/i.test(raw)) return `${raw} (recorded)`;
  if (/^[0-9A-Z]+$/i.test(raw)) return `Form ${raw} (recorded)`;
  return `${raw} (recorded)`;
}

/**
 * Owner's third ruling, 2026-09-17: the three facts logged from the phone call that made this
 * booking.
 */
export function cadNumberLabel(transport: TransportJob): string {
  // CAD to follow (Josh, 27 Oct 2026): a dispatched job booked before the provider gave its number.
  if (cadNumberToFollow(transport)) return CAD_TO_FOLLOW;
  return transport.cadNumber ?? "No CAD (dispatch) number recorded";
}

export function transportLegalStatusLabel(transport: TransportJob): string {
  if (transport.transportLegalStatus === "voluntary") return "Voluntary";
  if (transport.transportLegalStatus === "involuntary") return "Involuntary";
  return "Not recorded";
}

export function estimatedTimeLabel(transport: TransportJob, now: Instant): string {
  if (transport.estimatedAt === undefined) return "Not recorded";
  const when = formatInstantWithDay(transport.estimatedAt, now);
  return `${when} · ${transportEtaRemainingLabel(transport.estimatedAt, now)}`;
}

/**
 * THE FOUR STAGES A TRANSPORT LEG PASSES THROUGH, in `transportLeg`'s own order.
 */
export const OFFICER_LEG_STEPS = ["Requested", "Accepted", "En route", "Collected"] as const;

export type OfficerLeg = (typeof OFFICER_LEG_STEPS)[number];

export function officerLeg(transport: TransportJob): OfficerLeg | undefined {
  const leg = transportLeg(transport);
  return leg === "Requested" || leg === "Accepted" || leg === "En route" || leg === "Collected" ? leg : undefined;
}

export function nextActionVerb(leg: OfficerLeg): string {
  if (leg === "Requested") return "Accepted";
  if (leg === "Accepted") return "En route";
  if (leg === "En route") return "Collected";
  return "Arrived at ward";
}

export type HighlightPill = "requested" | "accepted" | "en_route" | "collected" | "late" | "forms";

export type SortKey = "next" | "wait" | "eta";

export type JobsTab = "jobs" | "history";

export type HistoryTab = "delivered" | "refused" | "cancelled";

/** The three hero figures a phone keeps (phone plan: title plus at most three figures). */
export const PHONE_PILLS: HighlightPill[] = ["late", "forms", "requested"];

/** When the job reached its current leg, if the record says. A requested job carries no time. */
export function stageStartedAt(movement: Movement): Instant | undefined {
  const transport = movement.transport;
  return transport?.collectedAt ?? transport?.enRouteAt ?? transport?.acceptedAt;
}

/** For sorting by longest wait: the leg's start, or when the movement opened. */
export function stageSince(movement: Movement): Instant {
  return stageStartedAt(movement) ?? movement.openedAt;
}

/**
 * The ward ETA a job carries, if any: the arrival plan's time only. The time typed at booking is
 * the provider's estimate, not a ward ETA, so lateness is never measured against it.
 */
function wardEta(movement: Movement): Instant | undefined {
  return movement.arrivalDetails?.estimatedArrivalAt;
}

/** When a job is expected: its ward ETA, or else the time typed at booking, saying which. */
export function expectedArrival(movement: Movement): { at: Instant; booked: boolean } | undefined {
  const ward = wardEta(movement);
  if (ward !== undefined) return { at: ward, booked: false };
  const booked = movement.transport?.estimatedAt;
  return booked === undefined ? undefined : { at: booked, booked: true };
}

/** True once a job is more than the grace past its recorded ward ETA and has not arrived. */
export function pastWardEta(movement: Movement, now: Instant): boolean {
  return (
    movement.arrivalDetails !== undefined &&
    now > movement.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES
  );
}

export const LEG_TONE: Record<OfficerLeg, WfTone> = {
  Requested: "neutral",
  Accepted: "info",
  "En route": "info",
  Collected: "success",
};
