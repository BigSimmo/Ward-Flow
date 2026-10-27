import { describe, expect, it } from "vitest";

import { alertGroupOf, alertKindOf, isQueueItem } from "@/components/ward-management/alerts/alerts-model";
import { queueWaitThresholds } from "@/components/ward-management/coordinator/priority-queue";
import { changesSinceInstant } from "@/components/ward-management/coordinator/since-last-look";
import { sinceLastLookCount } from "@/components/ward-management/coordinator/since-last-look-panel";
import { deriveServiceBedAlerts } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { occupancyPercent, occupiedBeds } from "@/components/ward-management/statistics/statistics-occupancy";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { activeActNowItems, activeTaskItems, taskItems } from "@/components/ward-management/ward-act-now-items";
import { isOpen, unitCapacity } from "@/components/ward-management/ward-derivations";
import { SNOOZE_REASON_IDS } from "@/components/ward-management/ward-inbox-snooze";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { movementBelongsToService } from "@/components/ward-management/ward-service-scope";
import { wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { OVERDUE_AFTER_MINUTES_BY_TIER } from "@/components/ward-management/ward-operational-defaults";
import { edPressure } from "@/components/ward-management/ward-pressure";
import {
  coordinatorOwnsAcceptedAwaitingBed,
  inEdTierOverdue,
  isTierOneOpen,
  isTierOverdue,
  notWaitingMoreText,
  notWaitingParts,
  openJourneySplit,
  tierOverdueAfterMinutes,
  waitingInEds,
  waitingSplit,
} from "@/components/ward-management/ward-shared-figures";
import { boardRows } from "@/components/ward-management/delays/delays-board-model";
import { causeOf, delayGroups, ownerOf } from "@/components/ward-management/delays/delays-derivations";
import { HANDOVER_ME, toHandoverRow } from "@/components/ward-management/handover/handover-model";
import { movementNextStep } from "@/components/ward-management/movements/movement-next-step";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { queueOrder } from "@/components/ward-management/ward-priority";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

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
  });

  it("waiting and the rest: a list that holds more than waiting says what the rest are, and it adds up", () => {
    const split = openJourneySplit(state.movements);
    const queue = state.movements.filter(isOpen);
    expect(split.listed, "Home's queue and Waiting list every open journey").toBe(queue.length);
    expect(split.waiting, "the hero's waiting part is the one waiting figure").toBe(
      waitingInEds(state.movements, now).total,
    );
    const rest = Object.values(split.notWaiting).reduce((sum, count) => sum + count, 0);
    expect(rest, "the seed has people in transit, so the two figures differ").toBeGreaterThan(0);
    expect(split.waiting + rest).toBe(split.listed);
    expect(notWaitingParts(split)).toContain(`${split.notWaiting.in_transit} in transit`);
    expect(notWaitingMoreText(split)).toBe(`${split.notWaiting.in_transit} more in transit`);
    const twoKinds = { ...split, notWaiting: { ...split.notWaiting, in_transit: 2, ward_transfer: 1 } };
    expect(notWaitingMoreText(twoKinds)).toBe("3 more: 2 in transit, 1 moving between wards");
    expect(notWaitingMoreText({ ...split, notWaiting: { ...split.notWaiting, in_transit: 0 } })).toBeNull();
  });

  it("badges: the menu's Waiting badge is Waiting's title figure, in the same words", () => {
    const counts = wardNavCounts({ ...state, now, sites: wardSites, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    const rows = boardRows(delayGroups(state.movements, state.units, now, DEFAULT_DUE_SOON_THRESHOLDS), now);
    const title = waitingSplit(rows.map((row) => row.movement));
    expect(counts.delays?.value).toBe(title.waiting);
    expect(counts.delays?.noun).toBe("waiting in ED");
    // Movements' badge counts every open journey, so it differs from Waiting's by the people in transit.
    expect(counts.movements?.value).toBe(rows.length);
    expect(counts.movements?.value).not.toBe(counts.delays?.value);
    // The severe causes stay available for the phone menu's Needs you row, under their own noun.
    expect(counts.delays?.need?.noun).toBe("at a time limit or with nowhere to go");
    expect(counts.delays?.need?.value).toBe(rows.filter((row) => row.severe).length);
  });

  it("badges: with a service chosen, the Waiting badge counts the same people as Waiting's title", () => {
    const statewide = wardNavCounts({ ...state, now, sites: wardSites, thresholds: DEFAULT_DUE_SOON_THRESHOLDS }).delays
      ?.value;
    let narrower = 0;
    for (const service of HEALTH_SERVICES) {
      const scoped = state.movements.filter((movement) => movementBelongsToService(movement, service, state.units));
      const rows = boardRows(delayGroups(scoped, state.units, now, DEFAULT_DUE_SOON_THRESHOLDS), now);
      const counts = wardNavCounts({
        ...state,
        now,
        sites: wardSites,
        thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
        service,
      });
      expect(counts.delays?.value, service).toBe(waitingSplit(rows.map((row) => row.movement)).waiting);
      if (counts.delays?.value !== statewide) narrower += 1;
    }
    expect(narrower, "the seed spreads waiting people across services").toBeGreaterThan(0);
  });

  it("act now: the Alerts screen's Act now group is the menu's act-now count, row for row", () => {
    const items = taskItems(state, now).filter(isQueueItem);
    for (const item of items) {
      if (alertGroupOf(item) === "running") continue;
      expect(alertGroupOf(item) === "act", item.id).toBe(item.tone === "danger");
    }
  });

  it("beds ready: Home's hero and the Statistics ready count read one figure", () => {
    const home = wardNavCounts({ ...state, now, sites: wardSites, thresholds: DEFAULT_DUE_SOON_THRESHOLDS }).capacity
      ?.value;
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

/**
 * P002, P032 (Josh, 27 Oct 2026, "Go ahead with all recommendations"). One seed: Home, Movements
 * and Patients count Tier 1 as every open journey at tier 1 (in transit included); Overdue waits
 * count people still in an ED past their tier's window; an accepted patient still waiting for the
 * bed is the coordinator's on Waiting, Movements, Patients and Handover.
 */
const DAY_ZERO = new Date("2026-10-01T00:00:00+08:00");

describe("one Tier 1 and Overdue count everywhere (P002), one owner for accepted awaiting a bed (P032)", () => {
  const state = seedWardFlowState();
  const now = NOW_ANCHOR;
  const open = state.movements.filter(isOpen);

  it("Home's queue, Movements' Tier 1 now and the Patients census count the same Tier 1 journeys", () => {
    const home = queueOrder(state.movements, now).filter(isTierOneOpen).length;
    const movements = open.filter(isTierOneOpen).length;
    const census = buildCensus({ ...state, now, thresholds: DEFAULT_DUE_SOON_THRESHOLDS, dayZero: DAY_ZERO });
    const patients = census.rows.filter((row) => row.kind === "movement" && row.tier === 1).length;
    expect(home, "the seed has Tier 1 journeys").toBeGreaterThan(0);
    expect(movements, "Movements vs Home").toBe(home);
    expect(patients, "Patients vs Home").toBe(home);
    expect(
      open.some((m) => isTierOneOpen(m) && !isWaitingInEd(m)),
      "in transit counts too, so the rule is not just waiting in ED",
    ).toBe(true);
  });

  it("Overdue waits count only people still in an ED, past their tier's window", () => {
    const overdue = open.filter((m) => inEdTierOverdue(m, now));
    expect(overdue.length, "the seed has overdue waits").toBeGreaterThan(0);
    for (const m of overdue) expect(isWaitingInEd(m) && isTierOverdue(m.urgency, now - m.openedAt)).toBe(true);
    const pastWindowNotInEd = open.filter((m) => !isWaitingInEd(m) && isTierOverdue(m.urgency, now - m.openedAt));
    expect(pastWindowNotInEd.length, "the seed has people past the window who already left the ED").toBeGreaterThan(0);
    for (const m of pastWindowNotInEd) expect(inEdTierOverdue(m, now)).toBe(false);
  });

  it("accepted, awaiting a bed: Waiting on you, Pull the bed, Bed desk and Coordinator on Handover", () => {
    const accepted = open.filter(coordinatorOwnsAcceptedAwaitingBed);
    expect(
      accepted.some((m) => m.owner === "ED mental health team"),
      "the seed records some of them against the ED team",
    ).toBe(true);
    const census = buildCensus({ ...state, now, thresholds: DEFAULT_DUE_SOON_THRESHOLDS, dayZero: DAY_ZERO });
    for (const m of accepted) {
      const cause = causeOf(m, state.units, now, DEFAULT_DUE_SOON_THRESHOLDS);
      expect(ownerOf(cause), `${m.id} on Waiting`).toBe("yours");
      expect(movementNextStep(m)?.owner, `${m.id} on Movements`).toBe("Coordinator");
      expect(census.rows.find((row) => row.key === m.id)?.nextWho, `${m.id} on Patients`).toBe("Bed desk");
      const handover = toHandoverRow(m, state.units, state.patients, state.referrals);
      expect(handover.owner, `${m.id} on Handover`).toBe(HANDOVER_ME);
      expect(handover.ownerShort, `${m.id} on Handover`).toBe("Coordinator");
    }
  });
});

describe("Beds ready names whose admissions it counts (P028)", () => {
  it("the Referrals beds sheet reads the scoped label", async () => {
    const figures = await import("@/components/ward-management/ward-shared-figures");
    expect((figures as Record<string, unknown>).BEDS_READY_SCOPED_TITLE).toBe(
      "Beds ready statewide (your desk's admissions)",
    );
    const { readFileSync } = await import("node:fs");
    const board = readFileSync("src/components/ward-management/referrals/referral-board.tsx", "utf8");
    expect(board).toContain('phoneSheet === "beds" ? BEDS_READY_SCOPED_TITLE');
  });
});
