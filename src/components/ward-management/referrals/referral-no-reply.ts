import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import type { WardConfiguration } from "@/components/ward-management/ward-configuration";
import type { Referral, Unit } from "@/components/ward-management/ward-model";
import { isAwaitingAnswer, referralDestinationLabel } from "@/components/ward-management/ward-referrals";

/**
 * "REFERRAL STUCK" — NO REPLY RECORDED WITHIN THE TIME LIMIT (Josh's list item 17, 25 Oct 2026).
 *
 * A plain timer and nothing else. For each place a waiting referral was sent that has not
 * answered, it counts the minutes since that place was asked and says when the count passes the
 * time limit set in Settings ("Referral decision", `referralDecisionTargetMinutes`, default two
 * hours). That is the same figure the "Referral decision overdue" alert reads, so a person cannot
 * be told two different limits for one wait.
 *
 * Only wards and community teams are timed: an emergency department is answered by triage, and
 * the referral board already times that wait by tier.
 *
 * What it never does: score, rank or re-order anything. Rows stay in wait order (D-71); the flag
 * is a highlight beside the row. It suggests no ward and says nothing about the person.
 *
 * The clock starts at the place's own recorded `referredAt`, or the referral's `raisedAt` for a
 * place asked when the referral was raised (older records carry no per-place time). It stops the
 * moment the place's answer is recorded, or the referral is withdrawn.
 */
export type NoReplyWait = {
  referralId: string;
  /** The ward or service that has not replied, as the screens name it. */
  place: string;
  /** The ward's unit id, when the place is a psychiatric ward. */
  unitId?: string;
  askedAt: Instant;
  waitedMinutes: number;
  limitMinutes: number;
  /** True once `waitedMinutes` passes the limit: the referral is stuck at this place. */
  pastLimit: boolean;
};

export function referralNoReplyWaits(
  referral: Referral,
  now: Instant,
  configuration: Pick<WardConfiguration, "referralDecisionTargetMinutes">,
  units: readonly Pick<Unit, "id" | "name">[],
): NoReplyWait[] {
  // Read per arm, not per referral: a community team still owes its own reply after a ward accepts.
  const limitMinutes = configuration.referralDecisionTargetMinutes;
  const waits: NoReplyWait[] = [];
  for (const arm of referral.destinations) {
    // A ward or community team answers with accept or decline. A front-door referral to an
    // emergency department is answered by triage, which has its own wait clock on the board.
    if (!isAwaitingAnswer(arm) || arm.destination.kind === "emergency_department") continue;
    const askedAt = arm.referredAt ?? referral.raisedAt;
    if (!Number.isFinite(askedAt)) continue;
    const waitedMinutes = Math.max(0, now - askedAt);
    const unitId = arm.destination.kind === "psychiatric_ward" ? arm.destination.unitId : undefined;
    waits.push({
      referralId: referral.id,
      place: units.find((unit) => unit.id === unitId)?.name ?? referralDestinationLabel(arm.destination),
      ...(unitId ? { unitId } : {}),
      askedAt,
      waitedMinutes,
      limitMinutes,
      pastLimit: waitedMinutes > limitMinutes,
    });
  }
  return waits;
}

/** "Stuck: no reply from Ward 4B for 2h 10m (limit 2h)", or `undefined` while every wait is inside it. */
export function noReplyLine(waits: readonly NoReplyWait[]): string | undefined {
  const stuck = waits.filter((wait) => wait.pastLimit);
  if (stuck.length === 0) return undefined;
  const longest = stuck.reduce((a, b) => (b.waitedMinutes > a.waitedMinutes ? b : a));
  const places = stuck.map((wait) => wait.place);
  const named = places.length === 1 ? places[0]! : `${places.slice(0, -1).join(", ")} and ${places.at(-1)!}`;
  // With more than one place named, the time is the longest of their waits, and says so.
  const waited = `${places.length === 1 ? "" : "longest "}${splitDuration(longest.waitedMinutes)}`;
  return `Stuck: no reply from ${named} for ${waited} (limit ${splitDuration(longest.limitMinutes)})`;
}

export type NoReplyByPlace = {
  place: string;
  /** Referrals past the limit at this place. */
  referrals: number;
  longestMinutes: number;
};

/**
 * The bed-meeting view: one line per ward or service holding referrals past the limit. Counts and
 * times only, no person. Longest wait first, then by name, so two prints of one moment match.
 */
export function stuckReferralsByPlace(
  referrals: readonly Referral[],
  now: Instant,
  configuration: Pick<WardConfiguration, "referralDecisionTargetMinutes">,
  units: readonly Pick<Unit, "id" | "name">[],
  keep: (wait: NoReplyWait) => boolean = () => true,
): NoReplyByPlace[] {
  const byPlace = new Map<string, NoReplyByPlace>();
  for (const referral of referrals) {
    for (const wait of referralNoReplyWaits(referral, now, configuration, units)) {
      if (!wait.pastLimit || !keep(wait)) continue;
      const row = byPlace.get(wait.place) ?? { place: wait.place, referrals: 0, longestMinutes: 0 };
      row.referrals += 1;
      row.longestMinutes = Math.max(row.longestMinutes, wait.waitedMinutes);
      byPlace.set(wait.place, row);
    }
  }
  return [...byPlace.values()].sort((a, b) => b.longestMinutes - a.longestMinutes || a.place.localeCompare(b.place));
}
