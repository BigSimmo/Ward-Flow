import { describe, expect, it } from "vitest";

import { alertKindOf, isQueueItem } from "@/components/ward-management/alerts/alerts-model";
import { queueWaitThresholds } from "@/components/ward-management/coordinator/priority-queue";
import { changesSinceInstant } from "@/components/ward-management/coordinator/since-last-look";
import { sinceLastLookCount } from "@/components/ward-management/coordinator/since-last-look-panel";
import { waitingByService } from "@/components/ward-management/network/network-overview-derivations";
import { deriveServiceBedAlerts } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { occupancyPercent, occupiedBeds } from "@/components/ward-management/statistics/statistics-occupancy";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { activeActNowItems, activeTaskItems, taskItems } from "@/components/ward-management/ward-act-now-items";
import { isOpen, unitCapacity } from "@/components/ward-management/ward-derivations";
import { SNOOZE_REASON_IDS } from "@/components/ward-management/ward-inbox-snooze";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { OVERDUE_AFTER_MINUTES_BY_TIER } from "@/components/ward-management/ward-operational-defaults";
import { edPressure } from "@/components/ward-management/ward-pressure";
import { isTierOverdue, tierOverdueAfterMinutes, waitingInEds } from "@/components/ward-management/ward-shared-figures";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
/**
 * L1 (site review, 12 Oct 2026): "one shared calculation per figure, a noun on every figure, and one
 * test that checks the hero, chip, badge and list counts agree." This is that test, over the seed:
 * every figure below is read through the selector each screen now calls, and each pair that the
 * review found disagreeing must agree, and be non-zero so the agreement is not vacuous.
 */
describe("the shared figures agree on the seed (hero, chip, badge and list)", () => {
  const state = seedWardFlowState();
  const now = NOW_ANCHOR;

  it("occupancy: Home's ring, the rail, and Statistics read one figure, Occupied + Pulled", () => {
    const home = wardOccupancy(state.units, state.admissions, state.bedReleases);
    const rail = deriveServiceBedAlerts(state.units, state.bedReleases, undefined, [], 0, undefined, state.admissions);
    const statistics = occupiedBeds(state.units, state.admissions, state.bedReleases, state.leaveBeds);
    expect(home.percent).not.toBeNull();
    expect(rail.statewideOccupancyPercent, "rail vs Home").toBe(home.percent);
    expect(statistics.inUse, "Statistics count vs Home").toBe(home.inUse);
    expect(occupancyPercent(statistics), "Statistics percent vs Home, rounded").toBe(Math.round(home.percent!));
    expect(statistics.pulled, "the seed must pull beds or Occupied alone would agree").toBeGreaterThan(0);
  });

  it("tasks: the header badge, Alerts Now and Home Exceptions count one list", () => {
    const all = taskItems(state, now);
    const badge = activeTaskItems(state, now).length;
    expect(badge, "the seed has tasks").toBeGreaterThan(0);
    // Alerts shows every task row, notification rows included.
    expect(all.filter(isQueueItem)).toHaveLength(all.length);
    expect(all.some((item) => alertKindOf(item.id) === "notify")).toBe(true);
    // Home Exceptions is the active list: snoozed rows leave it, as they leave the badge.
    const target = all.find((item) => item.tone !== "danger") ?? all[0]!;
    const snoozed = {
      ...state,
      inboxSnoozes: {
        [target.id]: [
          { at: now, by: "Coordinator", kind: "snoozed" as const, until: now + 30, reason: SNOOZE_REASON_IDS[0]! },
        ],
      },
    };
    expect(activeTaskItems(snoozed, now)).toHaveLength(badge - 1);
  });

  it("act now: the red subset of the same active list, everywhere", () => {
    const actNow = activeActNowItems(state, now);
    expect(actNow.length, "the seed has act-now rows").toBeGreaterThan(0);
    expect(actNow).toEqual(activeTaskItems(state, now).filter((item) => item.tone === "danger"));
  });

  it("waiting: Home's hero, the service picker and Network read one figure, and the services add up", () => {
    const waiting = waitingInEds(state.movements, now);
    const home = edPressure(now, state.movements).reduce((sum, row) => sum + row.waiting, 0);
    expect(waiting.total, "the seed has people waiting").toBeGreaterThan(0);
    expect(waiting.total, "picker All services vs Home").toBe(home);
    const sum = HEALTH_SERVICES.reduce((total, service) => total + (waiting.byService.get(service) ?? 0), 0);
    expect(sum, "the services add up to All services").toBe(waiting.total);
    for (const [service, count] of waitingByService(edPressure(now, state.movements))) {
      expect(waiting.byService.get(service), `${service}: picker vs Network`).toBe(count);
    }
  });

  it("beds ready: Home's hero and the Statistics ready count read one figure", () => {
    const home = wardNavCounts({ ...state, now, thresholds: DEFAULT_DUE_SOON_THRESHOLDS }).capacity?.value;
    const statistics = state.units.reduce((sum, unit) => sum + unitCapacity(unit, state.bedReleases).available, 0);
    expect(home, "the seed has ready beds").toBeGreaterThan(0);
    expect(home).toBe(statistics);
  });

  it("overdue: Home's markers use the Settings tier rule (Tier 1 overdue after 1h)", () => {
    for (const tier of [1, 2, 3] as const) {
      expect(tierOverdueAfterMinutes(tier)).toBe(OVERDUE_AFTER_MINUTES_BY_TIER[tier]);
      expect(queueWaitThresholds(tier).overdue, `tier ${tier}`).toBe(tierOverdueAfterMinutes(tier));
    }
    const open = state.movements.filter(isOpen);
    const homeOverdue = open.filter((m) => now - m.openedAt >= queueWaitThresholds(m.urgency).overdue).length;
    const ruleOverdue = open.filter((m) => isTierOverdue(m.urgency, now - m.openedAt)).length;
    expect(ruleOverdue, "the seed has overdue waits").toBeGreaterThan(0);
    expect(homeOverdue).toBe(ruleOverdue);
  });

  it("since you looked: before a look, Home counts what the record says happened since the shift began", () => {
    const since = currentShiftStartInstant(now);
    const changes = changesSinceInstant(state, since, now);
    expect(changes.basis).toBe("shift");
    const opened =
      state.referrals.filter((referral) => referral.raisedAt >= since && referral.raisedAt <= now).length +
      state.movements.filter(
        (movement) =>
          isOpen(movement) &&
          movement.referralId === undefined &&
          movement.openedAt >= since &&
          movement.openedAt <= now,
      ).length;
    expect(sinceLastLookCount(changes)).toBeGreaterThanOrEqual(opened);
    expect(opened, "the seed has activity since the shift began").toBeGreaterThan(0);
  });
});
