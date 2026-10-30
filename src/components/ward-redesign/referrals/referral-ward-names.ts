// Referrals redesign (Josh, 30 October 2026): a refused or cancelled ward is named, never shown by
// its internal id ("Ward · fsh-older-adult"). Copies of `refusalLines`, `cancelledLines` and
// `outcomeDetail` from src/components/ward-management/referrals/referral-board-model.ts, with the
// ward resolved from the units; every other destination keeps today's label.
import type { Referral, ReferralDestination, Unit } from "@/components/ward-management/ward-model";
import {
  acceptedAddressing,
  cancelledAddressings,
  declinedAddressings,
  referralAddressingStateLabel,
  referralDestinationLabel,
} from "@/components/ward-management/ward-referrals";
import {
  referralPresentation,
  type SenderReferralPresentation,
} from "@/components/ward-management/ward-partial-view-presenters";
import { declineReasonWords } from "@/components/ward-management/referrals/referral-board-parts";
import { outcomeLabel, type DecidedDetail } from "@/components/ward-management/referrals/referral-board-model";

/** The ward's name when the record names a unit; otherwise today's destination label. */
export function destinationWords(destination: ReferralDestination, units: readonly Unit[]): string {
  if (destination.kind === "psychiatric_ward" && destination.unitId) {
    const unit = units.find((candidate) => candidate.id === destination.unitId);
    if (unit) return unit.name;
  }
  return referralDestinationLabel(destination);
}

/** Every refusal, one each, as "<ward or service>: <reason>". */
export function refusalLines(referral: Referral, units: readonly Unit[]): string[] {
  return declinedAddressings(referral).map(
    (addressing) =>
      `${destinationWords(addressing.destination, units)}: ${declineReasonWords(addressing.declineReason)}`,
  );
}

function cancelledLines(referral: Referral, units: readonly Unit[]): string[] {
  return cancelledAddressings(referral).map(
    (addressing) => `${destinationWords(addressing.destination, units)}: ${referralAddressingStateLabel(addressing)}`,
  );
}

/** As today's `outcomeDetail`: the outcome, then refusals and cancellations kept apart. */
export function outcomeDetail(
  referral: Referral,
  units: readonly Unit[],
  summary?: SenderReferralPresentation,
): DecidedDetail {
  if (summary !== undefined) {
    const presentation = referralPresentation(referral, summary);
    const accepted =
      presentation.kind !== "unavailable" && presentation.state === "accepted"
        ? acceptedAddressing(referral)
        : undefined;
    const outcome = accepted
      ? accepted.destination.kind === "psychiatric_ward"
        ? (units.find((unit) => unit.id === accepted.acceptedUnitId)?.name ?? "Accepted ward not recorded")
        : referralDestinationLabel(accepted.destination)
      : outcomeLabel(referral, summary);
    return { outcome, alsoRefused: [], alsoCancelled: [] };
  }
  const refusals = refusalLines(referral, units);
  const cancelled = cancelledLines(referral, units);
  const accepted = acceptedAddressing(referral);
  if (accepted) {
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
