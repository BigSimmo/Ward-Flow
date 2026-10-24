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
import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { HEALTH_SERVICES, type HealthService, type Movement } from "@/components/ward-management/ward-model";
import {
  OVERDUE_AFTER_ANY_TIER_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "@/components/ward-management/ward-operational-defaults";

/**
 * OPEN ED JOURNEYS — people on an open movement out of an emergency department, by the service that
 * runs the department, including transit until arrival. The legacy waitingInEds/waitingText names
 * remain for callers. Home's hero, the header's service picker and Network's ready-against-journeys
 * rows all read this, so each service's figure is the same everywhere and the services add up to
 * the total: a journey originates from exactly one department. This is not physical ED occupancy.
 */
export type WaitingFigure = {
  total: number;
  stillInEd: number;
  inTransit: number;
  byService: ReadonlyMap<HealthService, number>;
};

export function waitingInEds(movements: readonly Movement[], now: Instant): WaitingFigure {
  const byService = new Map<HealthService, number>(HEALTH_SERVICES.map((service) => [service, 0]));
  let total = 0;
  let stillInEd = 0;
  let inTransit = 0;
  for (const summary of edOpenSummaries(movements, now)) {
    total += summary.waiting;
    stillInEd += summary.stillInEd;
    inTransit += summary.inTransit;
    byService.set(summary.service, (byService.get(summary.service) ?? 0) + summary.waiting);
  }
  return { total, stillInEd, inTransit, byService };
}

/** The picker's words name the open-journey population, including transit. */
export function waitingText(count: number): string {
  return `${count} open ED ${count === 1 ? "journey" : "journeys"}`;
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
