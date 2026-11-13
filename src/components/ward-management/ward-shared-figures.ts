/**
 * SHARED FIGURES — one calculation per figure that more than one screen prints (L1, site review,
 * 12 Oct 2026: "one shared calculation per figure, a noun on every figure").
 *
 * Pure: no React, no browser API. Each export names the figure it is the one source for and the
 * noun that travels with it. `tests/ward-shared-figures.test.ts` pins that the hero, chip, badge
 * and list counts agree on the seed.
 *
 * The other shared figures live beside the data they read and are not restated here:
 * - occupancy (WF-16): `wardOccupiedBeds` / `wardBedsInUse` / `wardBedUseFigures` (`ward-occupancy.ts`) —
 *   Occupied / On the ward vs In use (Occupied + Pulled); percentage always uses In use;
 * - beds freeing today vs forecast discharges (WF-16): `bedsFreeingTodayTotal` (over `releasesFreeingToday`)
 *   vs forecast next-24h sources (`capacity-derivations.ts` / `beds-forecast-sources.ts`); both
 *   "freeing today" and "ready by <shift end>" count releases through `isExpectedToFree` below;
 * - ready vs spare that fit (WF-16): `readyBedsNow` / `totalReadyBedsNow` vs `bedKindGaps(...).gap`
 *   (`ward-bed-states.ts` / `capacity-derivations.ts`);
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

export function waitingInEds(
  movements: readonly Movement[],
  now: Instant,
): WaitingFigure & { people: readonly Movement[] } {
  const byService = new Map<HealthService, number>(HEALTH_SERVICES.map((service) => [service, 0]));
  // Item 5 (count breakdown): the people are the figure; the total is their number, never a second sum.
  const people: Movement[] = [];
  for (const summary of edOpenSummaries(movements, now)) {
    people.push(...summary.open);
    byService.set(summary.service, (byService.get(summary.service) ?? 0) + summary.open.length);
  }
  return { total: people.length, byService, people };
}

/**
 * WAITED OVER A LIMIT — an open journey whose person is still in an ED (`isWaitingInEd`) and has
 * waited at least `minutes` since it opened. Waiting's "Over 8h" and "Over 24h" and Movements' "Over
 * 8h" and "Past 24h" pills all read this (NA2-10 and NA3-03, audits 24 and 26 Oct 2026): Movements
 * used to count every open journey for "Over 8h", so it read 19 against Waiting's 15.
 */
export function inEdOver(movement: Movement, now: Instant, minutes: number): boolean {
  return isOpen(movement) && isWaitingInEd(movement) && Math.max(0, now - movement.openedAt) >= minutes;
}

/**
 * WAIT CLOCKS (WF-02, Josh 5 Nov 2026): "waiting" means TIME SINCE REFERRAL, and that is the main
 * figure everywhere a wait is shown. Time in the department is a separate figure that always
 * carries the words "in ED". These two are the only clocks a screen reads, so two screens never
 * print different waits for one person under the same word.
 *
 * `minutesSinceReferral` is undefined when no referral time is recorded: it never falls back to
 * `openedAt` (see `Movement.referredAt`), so a screen shows the in-ED figure, labelled, instead.
 */
export function minutesSinceReferral(movement: Pick<Movement, "referredAt">, now: Instant): number | undefined {
  return movement.referredAt === undefined ? undefined : Math.max(0, now - movement.referredAt);
}

/** Time in the department, counted up from `openedAt`. Always labelled "in ED" where printed. */
export function minutesInEd(movement: Pick<Movement, "openedAt">, now: Instant): number {
  return Math.max(0, now - movement.openedAt);
}

/** All ED-origin journeys remain open during transport; this is not physical ED occupancy. */
export function openEdJourneys(
  movements: readonly Movement[],
  now: Instant,
): WaitingFigure & { stillInEd: number; inTransit: number; people: readonly Movement[] } {
  const byService = new Map<HealthService, number>(HEALTH_SERVICES.map((service) => [service, 0]));
  // Item 5 (count breakdown): the journeys are the figure; the total is their number.
  const people: Movement[] = [];
  let stillInEd = 0;
  let inTransit = 0;
  for (const summary of edJourneySummaries(movements, now)) {
    people.push(...summary.open);
    stillInEd += summary.stillInEd;
    inTransit += summary.inTransit;
    byService.set(summary.service, (byService.get(summary.service) ?? 0) + summary.open.length);
  }
  return { total: people.length, stillInEd, inTransit, byService, people };
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
type NotWaitingReason =
  "in_transit" | "ward_transfer" | "community_origin" | "for_discharge" | "for_follow_up" | "withdrawn";

const NOT_WAITING_REASONS: readonly NotWaitingReason[] = [
  "in_transit",
  "ward_transfer",
  "community_origin",
  "for_discharge",
  "for_follow_up",
  "withdrawn",
];

const NOT_WAITING_WORDS: Record<NotWaitingReason, string> = {
  in_transit: "in transit",
  ward_transfer: "moving between wards",
  community_origin: "from community",
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
  if (movement.sourceAdmissionId !== undefined) return "ward_transfer";
  if (!isEdOriginJourney(movement)) return "community_origin";
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
    community_origin: 0,
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
 * An unrecorded tier takes tier 3's window (D-187, F-30: kept as it is; it reads "Tier not recorded").
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

/**
 * TIER 1 (P002, Josh 27 Oct 2026): every open journey (`isOpen`) at urgency tier 1, in transit
 * included. Home's Tier 1 chip and highlight and Movements' "Tier 1 now" read this, so the screens
 * print one count. The label says what it counts: "Tier 1 open movements" (Q262).
 */
export function isTierOneOpen(movement: Movement): boolean {
  return isOpen(movement) && movement.urgency === 1;
}

/**
 * OVERDUE WAITS (P002): an open journey whose person is still in an ED (`isWaitingInEd`) and has
 * waited past its tier's window (`isTierOverdue`). Somebody already on the road is not a wait.
 */
export function inEdTierOverdue(movement: Movement, now: Instant): boolean {
  return (
    isOpen(movement) && isWaitingInEd(movement) && isTierOverdue(movement.urgency, Math.max(0, now - movement.openedAt))
  );
}

/**
 * P003: a chip narrowed to one ED's journeys says so, by the site's short name: "Tier 1, RPH only".
 * Without a chosen ED the chip keeps its own label.
 */
function scopedChipLabel(label: string, scopedLabel: string, siteShort: string | undefined): string {
  return siteShort ? `${scopedLabel}, ${siteShort} only` : label;
}

/**
 * P032 (Josh 27 Oct 2026): a ward has accepted and the patient is still waiting for the bed to be
 * pulled. That step is the coordinator's ("Waiting on you" on Waiting, "Pull the bed" on Movements,
 * "Bed desk" on Patients), so Handover names the coordinator too, whatever owner the record holds.
 */
export function coordinatorOwnsAcceptedAwaitingBed(movement: Movement): boolean {
  return isOpen(movement) && movement.stage === "accepted_awaiting_bed" && movement.acceptedUnitId !== undefined;
}

/** P002/P003: Home's two highlight chips, counted with the shared rules and labelled for the chosen ED. */
export function homeChipFigures(queue: readonly Movement[], now: Instant, siteShort: string | undefined) {
  return {
    overdueInQueue: queue.filter((movement) => inEdTierOverdue(movement, now)).length,
    tierOneInQueue: queue.filter(isTierOneOpen).length,
    overdueLabel: scopedChipLabel("Overdue waits", "Overdue waits", siteShort),
    tierOneLabel: scopedChipLabel("Tier 1 open movements", "Tier 1", siteShort),
  };
}

/** P028 (Josh 27 Oct 2026): the beds figure counts beds statewide against this desk's admissions. */
export const BEDS_READY_SCOPED_TITLE = "Beds ready statewide (your desk's admissions)";

/** A16-05: the release rule lives in a leaf module (`ward-releases-expected-to-free.ts`) and is re-exported here. */
export {
  isExpectedToFree,
  isFreeingToday,
  releasesExpectedToFree,
} from "@/components/ward-management/ward-releases-expected-to-free";
