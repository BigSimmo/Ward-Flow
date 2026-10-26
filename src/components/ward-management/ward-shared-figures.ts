/**
 * SHARED FIGURES — one calculation per figure that more than one screen prints (L1, site review,
 * 12 Oct 2026: "one shared calculation per figure, a noun on every figure").
 *
 * Pure: no React, no browser API. Each export names the figure it is the one source for and the
 * noun that travels with it. `tests/ward-shared-figures.test.ts` pins that the hero, chip, badge
 * and list counts agree on the seed.
 *
 * The other shared figures live beside the data they read and are not restated here:
 * - occupancy: `wardOccupancy` / `wardBedsInUse` (`ward-occupancy.ts`), Occupied + Pulled;
 * - tasks and act now: `taskItems`, `activeTaskItems`, `activeActNowItems` (`ward-act-now-items.ts`);
 * - beds ready now: `wardNavCounts(...).capacity` (`ward-nav-counts.ts`);
 * - since you looked: `changesSinceLastLook` / `changesSinceInstant` (`coordinator/since-last-look.ts`).
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import { edJourneySummaries, edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { isEdOriginJourney, isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { HEALTH_SERVICES, type HealthService, type Movement } from "@/components/ward-management/ward-model";
import {
  OVERDUE_AFTER_ANY_TIER_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "@/components/ward-management/ward-operational-defaults";

/**
 * WAITING — people physically in an emergency department awaiting a bed (`isWaitingInEd`), by the
 * health service that runs the department. The noun is "waiting". Transit, recorded
 * departures/outcomes and ward-origin transfers are excluded. The menu's Waiting badge,
 * Waiting's own title, the header's service picker ("All services 62 waiting") and physical ED tiles
 * read this, so each service's
 * figure is the same everywhere and the services add up to the total: a person waits in exactly one
 * department. Somebody already on the road to a ward is not waiting; see `waitingSplit` below.
 */
export type WaitingFigure = {
  total: number;
  byService: ReadonlyMap<HealthService, number>;
};

export function waitingInEds(movements: readonly Movement[], now: Instant): WaitingFigure {
  const byService = new Map<HealthService, number>(HEALTH_SERVICES.map((service) => [service, 0]));
  let total = 0;
  for (const summary of edOpenSummaries(movements, now)) {
    total += summary.waiting;
    byService.set(summary.service, (byService.get(summary.service) ?? 0) + summary.waiting);
  }
  return { total, byService };
}

/** All ED-origin journeys remain open during transport; this is not physical ED occupancy. */
export function openEdJourneys(
  movements: readonly Movement[],
  now: Instant,
): WaitingFigure & { stillInEd: number; inTransit: number } {
  const byService = new Map<HealthService, number>(HEALTH_SERVICES.map((service) => [service, 0]));
  let total = 0;
  let stillInEd = 0;
  let inTransit = 0;
  for (const summary of edJourneySummaries(movements, now)) {
    total += summary.waiting;
    stillInEd += summary.stillInEd;
    inTransit += summary.inTransit;
    byService.set(summary.service, (byService.get(summary.service) ?? 0) + summary.waiting);
  }
  return { total, stillInEd, inTransit, byService };
}

/** "35 waiting", "none waiting": the picker's words, so the noun never leaves the number. */
export function waitingText(count: number): string {
  return count > 0 ? `${count} waiting` : "none waiting";
}

/**
 * WAITING AND THE REST OF A LIST (overall review, 20 Oct 2026: one meaning per label). Home's
 * queue, Waiting, Movements and an ED's psychiatry board each list more people than "waiting"
 * counts: a person already on the road to a ward is still on those lists but is no longer waiting
 * in a department. So "waiting" keeps the one meaning above, and a list that holds more says what
 * the others are, in these words, so its figures add up on screen ("62 waiting in ED, 8 in transit"
 * over a list of 70).
 *
 * Counting only: nothing here orders, ranks or hides anybody.
 */
type NotWaitingReason = "in_transit" | "ward_transfer" | "for_discharge" | "for_follow_up" | "withdrawn";

const NOT_WAITING_REASONS: readonly NotWaitingReason[] = [
  "in_transit",
  "ward_transfer",
  "for_discharge",
  "for_follow_up",
  "withdrawn",
];

const NOT_WAITING_WORDS: Record<NotWaitingReason, string> = {
  in_transit: "in transit",
  ward_transfer: "moving between wards",
  for_discharge: "for discharge",
  for_follow_up: "for community follow-up or assessment",
  withdrawn: "withdrawn",
};

/**
 * Why a listed person is not counted as waiting, or `null` when they are. A ward transfer never
 * waited in a department; a recorded ED outcome means no bed is being sought; a closed record that
 * is still listed is a department's own withdrawal (the ED board keeps those); anybody else who is
 * not waiting has left the department or is on the road.
 */
function notWaitingReason(movement: Movement): NotWaitingReason | null {
  if (isWaitingInEd(movement)) return null;
  if (!isEdOriginJourney(movement)) return "ward_transfer";
  if (movement.edOutcome === "for_discharge") return "for_discharge";
  if (movement.edOutcome === "for_community_follow_up") return "for_follow_up";
  if (movement.closure) return "withdrawn";
  return "in_transit";
}

export type WaitingSplit = {
  /** Everybody on the list. */
  listed: number;
  /** Of those, waiting in ED (`isWaitingInEd`): the people every "waiting" figure counts. */
  waiting: number;
  /** The rest, by why they are not waiting. Adds up to `listed - waiting`. */
  notWaiting: Record<NotWaitingReason, number>;
};

/** Split the caller's list into waiting and the rest. The list itself is not changed. */
export function waitingSplit(listed: readonly Movement[]): WaitingSplit {
  const notWaiting: Record<NotWaitingReason, number> = {
    in_transit: 0,
    ward_transfer: 0,
    for_discharge: 0,
    for_follow_up: 0,
    withdrawn: 0,
  };
  let waiting = 0;
  for (const movement of listed) {
    const reason = notWaitingReason(movement);
    if (reason === null) waiting += 1;
    else notWaiting[reason] += 1;
  }
  return { listed: listed.length, waiting, notWaiting };
}

/** Every open movement (`isOpen`): the people Home's queue, Waiting and Movements list. */
export function openJourneySplit(movements: readonly Movement[]): WaitingSplit {
  return waitingSplit(movements.filter(isOpen));
}

type NotWaitingFigure = { reason: NotWaitingReason; count: number; words: string };

/** The rest of the list, in a fixed order, non-zero parts only: `[{ count: 8, words: "in transit" }]`. */
function notWaitingFigures(split: WaitingSplit): NotWaitingFigure[] {
  return NOT_WAITING_REASONS.filter((reason) => split.notWaiting[reason] > 0).map((reason) => ({
    reason,
    count: split.notWaiting[reason],
    words: NOT_WAITING_WORDS[reason],
  }));
}

/** The same in words: `["8 in transit"]`, or `[]` when everybody on the list is waiting. */
export function notWaitingParts(split: WaitingSplit): string[] {
  return notWaitingFigures(split).map((figure) => `${figure.count} ${figure.words}`);
}

/**
 * The rest as one short phrase to sit beside a "waiting" figure: "8 more in transit", or "9 more:
 * 8 in transit, 1 moving between wards". `null` when everybody on the list is waiting.
 */
export function notWaitingMoreText(split: WaitingSplit): string | null {
  const figures = notWaitingFigures(split);
  if (figures.length === 0) return null;
  if (figures.length === 1) return `${figures[0]!.count} more ${figures[0]!.words}`;
  const total = figures.reduce((sum, figure) => sum + figure.count, 0);
  return `${total} more: ${notWaitingParts(split).join(", ")}`;
}

/**
 * OVERDUE BY TIER — the one tier-due rule (L4). Settings shows it ("Tier 1 overdue after 1h") and
 * the Referrals board applies it; every overdue marker on a waiting person reads it from here:
 * overdue once the wait reaches the tier's window, or the any-tier ceiling, whichever is sooner.
 * An unrecorded tier takes tier 3's window.
 */
export function tierOverdueAfterMinutes(urgency: number | undefined): number {
  const tier: 1 | 2 | 3 = urgency === 1 || urgency === 2 ? urgency : 3;
  return Math.min(OVERDUE_AFTER_MINUTES_BY_TIER[tier], OVERDUE_AFTER_ANY_TIER_MINUTES);
}

/** Whether a wait of `waitedMinutes` is past its tier's window. */
export function isTierOverdue(urgency: number | undefined, waitedMinutes: number): boolean {
  return waitedMinutes >= tierOverdueAfterMinutes(urgency);
}

/** The words for the rule, for notes and titles: "Overdue after T1 1h, T2 4h, T3 24h". */
export function tierOverdueRuleText(): string {
  const hours = (tier: 1 | 2 | 3) => `${tierOverdueAfterMinutes(tier) / 60}h`;
  return `Overdue after T1 ${hours(1)}, T2 ${hours(2)}, T3 ${hours(3)}`;
}
