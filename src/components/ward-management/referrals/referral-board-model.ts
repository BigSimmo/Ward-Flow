// The referral board's pure helpers: the gender review flag, decided-outcome wording, the due time,
// the demographic line and the phone journey strip. Moved out of `referral-board.tsx` for the line cap.
import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { genderReviewNeeded, type Referral, type Unit } from "@/components/ward-management/ward-model";
import {
  COMMUNITY_DECLINE_REASON_LABELS,
  DECLINE_REASON_LABELS,
  referralSexCell,
  acceptedAddressing,
  cancelledAddressings,
  declinedAddressings,
  referralAddressingStateLabel,
  referralDecidedAt,
  referralDestinationLabel,
  referralState,
  referralClocks,
} from "@/components/ward-management/ward-referrals";
import {
  OVERDUE_AFTER_ANY_TIER_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "@/components/ward-management/ward-operational-defaults";
import { durMinutes, type JourneyStage } from "@/components/wf";
import { wardArm } from "./referral-board-parts";

/**
 * Bed board decision 9A (Josh, 26 September 2026): the waiting list flags a queued referral whose
 * ward arm records a gender or sex that is not female or male, the R7 rule `genderReviewNeeded`
 * already enforces at placement. It goes once a coordinator has recorded the review.
 */
export const GENDER_REVIEW_FLAG = "Coordinator to review: gender or sex not recorded as female or male";

export function referralNeedsGenderReview(referral: Referral): boolean {
  const ward = referral.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  if (!ward || ward.destination.kind !== "psychiatric_ward") return false;
  if ((referral.genderPlacements ?? []).length > 0) return false;
  return genderReviewNeeded(ward.destination.gender, ward.destination.sex);
}

/*
 * Urgency tier text carries its own direction — a bare "Tier 1" badge on a board where every
 * tier appears tells a coordinator nothing about which end of the scale that is. This file used
 * to hold its own copy of the wording, described in its comment as mirroring
 * `priority-queue.tsx` "exactly"; both copies are now `urgencyTierLabel` (`ward-priority.ts`),
 * so the claim is enforced by there being one spelling rather than by two files agreeing.
 */

export function decidedWaitLabel(referral: Referral): string {
  const decidedAt = referralDecidedAt(referral);
  if (decidedAt === undefined) return "No decision time recorded";
  return `${splitDuration(Math.max(0, decidedAt - referral.raisedAt))} before decision`;
}

export function outcomeLabel(referral: Referral): string {
  if (
    referral.destinations.length > 0 &&
    referral.destinations.every((addressing) => addressing.withdrawnAt !== undefined)
  ) {
    return "Withdrawn";
  }
  const state = referralState(referral);
  if (state === "accepted") return "Accepted";
  if (state === "declined") return "Declined";
  return "Queued";
}

/**
 * Every refusal recorded against this referral, one entry each, as "<destination>: <reason>".
 *
 * EVERY refusal, not the first. Several destinations can decline while the referral stays live
 * (FD-24), and showing one would hide refusals that were actually given.
 *
 * A refusal the record holds with no reason reads "Reason not recorded" rather than trailing off
 * after the colon: the record says a destination refused and does not say why, and the cell says
 * exactly that rather than inventing a reason or implying none was ever asked for.
 */
export function refusalLines(referral: Referral): string[] {
  return declinedAddressings(referral).map((addressing) => {
    const reason = addressing.declineReason;
    const label = reason
      ? ((DECLINE_REASON_LABELS as Record<string, string>)[reason] ??
        (COMMUNITY_DECLINE_REASON_LABELS as Record<string, string>)[reason] ??
        reason)
      : "Reason not recorded";
    return `${referralDestinationLabel(addressing.destination)}: ${label}`;
  });
}

/**
 * Every destination CANCELLED by this referral's own acceptance elsewhere (FD-22), one entry
 * each, as "<destination>: <state sentence>" — the same shape as `refusalLines` above, so the two
 * lists read as siblings rather than as two different conventions.
 *
 * Owner ruling, 2026-09-01: "'Refused' and 'cancelled because somewhere else said yes' are shown
 * differently... Nobody refused that patient and the record must not imply anyone did." The
 * sentence itself comes from `referralAddressingStateLabel` (`ward-referrals.ts`) — the one home
 * for that wording — never respelled here, which is exactly what keeps a cancelled destination
 * from ever being read as this service's own refusal.
 */
export function cancelledLines(referral: Referral): string[] {
  return cancelledAddressings(referral).map(
    (addressing) => `${referralDestinationLabel(addressing.destination)}: ${referralAddressingStateLabel(addressing)}`,
  );
}

/**
 * What the outcome actually was, beyond the bare word (review finding I3). Before this, a decided
 * row read only "RF-006 | Accepted | 1h before decision | 10:37" — it named no unit, gave no
 * reason, and the ONE screen that carried either (the match view's decided panel) was reachable
 * only in the moment straight after deciding a referral you had selected. A decline reason that
 * cannot be read back makes the fixed reason list — the entire mechanism by which this phase
 * justifies holding no free text — worthless on the board.
 *
 * Describes the record, never the person, and never asserts something the record does not hold:
 * a missing unit or reason reads as "Not recorded", never as a guess or an empty cell.
 *
 * ⚠️ **AN ACCEPTANCE DOES NOT ERASE A REFUSAL.** Owner ruling, 2026-09-01: "keep the refusals
 * visible on the board." This function used to RETURN on the accepted branch and never reach the
 * declined one, so the moment any destination said yes, every refusal recorded against that
 * referral — and the reason the refusing clinician gave — disappeared from the only screen that
 * ever showed them. A ward accepted, and an emergency department's documented refusal was erased.
 * A refusal is a clinical decision with a stated reason, and it does not stop being true because
 * a different ward accepted; it is also the record a coordinator needs when an acceptance later
 * falls through.
 *
 * ⚠️ **THE HALVES ARE RETURNED SEPARATELY, NEVER CONCATENATED.** A coordinator scanning this
 * column must not read a refusal — or a cancellation — as the answer, so `outcome` is what
 * happened, `alsoRefused` is what was actually refused, and `alsoCancelled` is what was closed out
 * automatically by the acceptance itself, each kept visibly apart by `OutcomeDetail` below.
 * `alsoRefused` is empty when nothing has accepted — there the refusals ARE the outcome, and
 * repeating them under a second heading would invent a distinction the record does not make.
 * `alsoCancelled` follows the same rule: a cancellation only ever exists beside an acceptance
 * (FD-22 writes `state: "cancelled"` only inside `ACCEPT_REFERRAL`), so it is never the outcome on
 * its own.
 *
 * ⚠️ **`alsoRefused` AND `alsoCancelled` MUST NEVER MERGE.** Owner ruling, 2026-09-01: a refusal
 * is a service saying no; a cancellation is nobody saying anything, closed out automatically by a
 * different acceptance. Folding a cancelled destination into `alsoRefused` — or wording it so it
 * reads like one — resurrects the exact defect this ruling exists to prevent: a service that never
 * refused this patient appearing to have done so.
 */
export type DecidedDetail = {
  /** The outcome itself: the accepting unit, the accepting destination, or — when nothing has
   *  accepted — every refusal. Never empty; "Not recorded" when the record holds neither. */
  outcome: string;
  /** The refusals recorded against a referral that was accepted somewhere else. Empty otherwise. */
  alsoRefused: string[];
  /** The destinations cancelled by this referral's own acceptance elsewhere (FD-22). Empty unless
   *  something has accepted — see `cancelledAddressings`'s own doc comment. */
  alsoCancelled: string[];
};

export function outcomeDetail(referral: Referral, units: Unit[]): DecidedDetail {
  const refusals = refusalLines(referral);
  const cancelled = cancelledLines(referral);
  const accepted = acceptedAddressing(referral);
  if (accepted) {
    // A ward acceptance names the bed; the other three are answered by a team, so the destination
    // itself is the whole answer and saying "Unit not recorded" there would invent a gap.
    if (accepted.destination.kind !== "psychiatric_ward") {
      return {
        outcome: referralDestinationLabel(accepted.destination),
        alsoRefused: refusals,
        alsoCancelled: cancelled,
      };
    }
    const unit = units.find((candidate) => candidate.id === accepted.acceptedUnitId);
    return { outcome: unit ? unit.name : "Unit not recorded", alsoRefused: refusals, alsoCancelled: cancelled };
  }
  if (refusals.length > 0) {
    return { outcome: refusals.join(" · "), alsoRefused: [], alsoCancelled: [] };
  }
  return { outcome: "Not recorded", alsoRefused: [], alsoCancelled: [] };
}

/** The words that mark the refusals as NOT the outcome. Spelled once, so the table and the card
 *  cannot drift apart — two components spelling one label separately is the defect class this
 *  phase has already paid for four times. */
export const ALSO_REFUSED_LEAD = "Also refused";

/** The words that mark a cancellation as NOT a refusal — the other half of the same discipline
 *  `ALSO_REFUSED_LEAD` holds to, and the reason this is its own constant rather than a reuse of
 *  that one: the two must read as different categories, not as one relabelled. */
export const ALSO_CANCELLED_LEAD = "Also cancelled";

/**
 * The word that marks a refusal shown on a STILL-QUEUED referral. `ALSO_REFUSED_LEAD` above is
 * safe with no lead of its own only because the decided section always shows it beside an
 * "Outcome" cell that already reads "Declined" — the neighbouring column supplies the word. A
 * queued referral carries no such column and never will, so without its own lead this text reads
 * as a bare "<destination>: <reason>" with nothing naming it a refusal, and a tired reader can
 * take it either as a routing note about the referral or — worse — as the settled answer, which
 * stops a coordinator from working a referral that is still live and waiting on other
 * destinations. Deliberately NOT `ALSO_REFUSED_LEAD`: nothing else has answered yet, so "also" is
 * false here — this is the only answer given so far, not an addition to one. Spelled once, used
 * by both the table row and the phone card, exactly as `ALSO_REFUSED_LEAD` is.
 */
export const QUEUED_REFUSED_LEAD = "Already refused";

/**
 * When the board calls this referral overdue: its tier's own default, or the any-tier default if
 * that comes first (`ward-operational-defaults.ts`, Josh's defaults, not legal limits). Undefined
 * once the referral clock has stopped, because a stopped clock is not due anything.
 */
export function referralDueAt(referral: Referral, now: Instant): Instant | undefined {
  if (!referralClocks(referral, now).sinceReferralRunning) return undefined;
  return referral.raisedAt + Math.min(OVERDUE_AFTER_MINUTES_BY_TIER[referral.urgency], OVERDUE_AFTER_ANY_TIER_MINUTES);
}

/**
 * Age band and sex, with gender beside sex on a ward referral (R7): named when it differs, and
 * said to be unrecorded when it is missing, so "not recorded" never reads as "same as sex".
 */
export function demographicLabel(referral: Referral): string {
  const ward = wardArm(referral)?.destination;
  const sex = referralSexCell(referral);
  const base = `${referral.ageBand}, ${sex}`;
  if (!ward) return base;
  const gender = ward.gender?.trim();
  if (!gender || gender.toLowerCase() === "not recorded") return `${base}, gender not recorded`;
  return gender.toLowerCase() === sex.toLowerCase() ? base : `${base} (${gender})`;
}

/** Journey segment time: "just now" under a minute, never "0s". */
export function journeyDuration(minutes: number): string {
  return minutes < 1 ? "just now" : durMinutes(minutes);
}

/**
 * v10 phone referral sheet: the referral's own recorded steps as a journey strip (Referred,
 * Triaged, Bed offered), sized by real time. Undefined while there is only one step to show.
 */
export function referralJourneyStages(referral: Referral, now: Instant): JourneyStage[] | undefined {
  // Only a ward's acceptance offers a bed; an ED or community team accepting offers none.
  const offeredAt = referral.destinations
    .filter(
      (arm) => arm.destination.kind === "psychiatric_ward" && arm.state === "accepted" && arm.decidedAt !== undefined,
    )
    .map((arm) => arm.decidedAt as number)
    .sort((x, y) => x - y)[0];
  // A triage time recorded before the referral was raised (or after the offer) cannot size the
  // strip without counting time outside its own stage, so the strip leaves it out.
  const triagedAt =
    referral.triagedAt !== undefined &&
    referral.triagedAt >= referral.raisedAt &&
    (offeredAt === undefined || referral.triagedAt <= offeredAt)
      ? referral.triagedAt
      : undefined;
  if (triagedAt === undefined && offeredAt === undefined) return undefined;
  const stages: JourneyStage[] = [];
  const referredEnd = triagedAt ?? offeredAt ?? now;
  stages.push({ id: "referred", label: "Referred", minutes: Math.max(0, referredEnd - referral.raisedAt) });
  if (triagedAt !== undefined) {
    const end = offeredAt ?? now;
    stages.push({
      id: "triaged",
      label: "Triaged",
      minutes: Math.max(0, end - triagedAt),
      now: offeredAt === undefined,
    });
  }
  if (offeredAt !== undefined) {
    stages.push({ id: "offered", label: "Bed offered", minutes: Math.max(0, now - offeredAt), now: true });
  }
  return stages;
}
