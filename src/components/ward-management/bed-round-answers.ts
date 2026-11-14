import { ASK_CONFIRM_BEDS } from "@/components/ward-management/alerts/ask-wards";
import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";
import type { Instant } from "@/components/ward-management/ward-clock";
import { byServiceThenName } from "@/components/ward-management/ward-derivations-shortlist";
import type { Unit } from "@/components/ward-management/ward-model";
import { isBedCountStale } from "@/components/ward-management/ward-clinical-values";

/**
 * Bed round answers on the agenda (feature build plan batch 3, item 12; D-136 item 3). Each ward
 * reads "Confirmed 08:40" or "Not confirmed", from what is already recorded: the "Please confirm
 * your beds" asks (`ask-wards.ts`) and the ward's own bed figure and its age. Nothing new is stored.
 *
 * A ward counts as confirmed when its bed figure was confirmed by a desk (not a feed), is still
 * inside the signed bed count time (`bedCountFresh`), and is no older than the latest
 * "Please confirm your beds" ask that named the ward. Not confirmed is a fact, never a judgement.
 *
 * 🔒 D-126 (Josh, 10 Nov 2026): wards stay in the one fixed order, health service then ward name,
 * whether the "Not confirmed" filter is on or off. The filter only hides rows; it never reorders.
 */
export type BedRoundAnswer = {
  unit: Unit;
  confirmed: boolean;
  /** When the ward confirmed its beds, if it is confirmed. */
  confirmedAt?: Instant;
};

/** When the latest "Please confirm your beds" ask that named this ward was sent, if one was. */
function latestAskAt(alerts: readonly BroadcastAlert[], unitId: string, now: Instant): Instant | undefined {
  let latest: Instant | undefined;
  for (const alert of alerts) {
    if (alert.title !== ASK_CONFIRM_BEDS.title || alert.dispatchedAt > now) continue;
    if (!(alert.targetUnitIds ?? []).includes(unitId)) continue;
    if (latest === undefined || alert.dispatchedAt > latest) latest = alert.dispatchedAt;
  }
  return latest;
}

export function bedRoundAnswers(
  units: readonly Unit[],
  alerts: readonly BroadcastAlert[],
  now: Instant,
): BedRoundAnswer[] {
  return [...units].sort(byServiceThenName).map((unit) => {
    const figure = unit.allocatable;
    const askedAt = latestAskAt(alerts, unit.id, now);
    const confirmed =
      figure.source === "ward" &&
      figure.confirmedAt <= now &&
      !isBedCountStale(figure.confirmedAt, now) &&
      (askedAt === undefined || figure.confirmedAt >= askedAt);
    return confirmed ? { unit, confirmed, confirmedAt: figure.confirmedAt } : { unit, confirmed };
  });
}

/** The "Not confirmed" filter: the same rows in the same order, the confirmed ones left out. */
export function notConfirmedOnly(answers: readonly BedRoundAnswer[]): BedRoundAnswer[] {
  return answers.filter((answer) => !answer.confirmed);
}
