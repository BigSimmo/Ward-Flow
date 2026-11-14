import { describe, expect, it } from "vitest";

import { bedKindGaps, bedKindTotals } from "@/components/ward-management/capacity/capacity-derivations";
import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { openReferrals } from "@/components/ward-management/community/team-2026/midland-decisions";
import { REFERRALS } from "@/components/ward-management/community/team-2026/midland-demo";
import {
  TEAM_REFERRAL_IDS,
  teamReferralsToAnswer,
} from "@/components/ward-management/community/team-2026/team-referral-count";
import { flowStageOf } from "@/components/ward-management/coordinator/priority-queue";
import { ALL_FIGURES } from "@/components/ward-management/figures/all-figures";
import { needsABed, noWardYet } from "@/components/ward-management/figures/bed-demand";
import { needsYouCount, referralsAwaitingDecision } from "@/components/ward-management/figures/decision-counts";
import { FIGURE_WINDOWS } from "@/components/ward-management/figures/figure-windows";
import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { activeTaskItems } from "@/components/ward-management/ward-act-now-items";
import { alertsNowFigures } from "@/components/ward-management/ward-alerts-figures";
import { totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { heldUpDueByTomorrow } from "@/components/ward-management/ward-held-up";
import { MOVEMENT_STAGES, type Movement } from "@/components/ward-management/ward-model";
import { serviceRollup } from "@/components/ward-management/ward-morning-rollup";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { openEdJourneys, waitingInEds } from "@/components/ward-management/ward-shared-figures";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

/**
 * The figure dictionary (R-FIGS-9, figures spec 3 and 5, D-220). Phase 1: every row is complete,
 * and on the seed the rows' functions agree with the inline copies the screens still hold, so
 * phase 2 can point each screen at its row without changing a figure.
 */

const COUNT_WINDOWS = [
  "now",
  "today",
  "by tomorrow",
  "next 4h",
  "next 24h",
  "last 24h",
  "this week",
  "since 07:00",
  "any date",
];

describe("every figure row is complete", () => {
  it("has unique ids and names", () => {
    const ids = ALL_FIGURES.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = ALL_FIGURES.map((row) => row.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(ALL_FIGURES.map((row) => [row.id, row] as const))("%s has every field", (_id, row) => {
    expect(row.name.trim()).not.toBe("");
    expect(row.rule.trim()).not.toBe("");
    expect(row.population.trim()).not.toBe("");
    expect(row.home.trim()).not.toBe("");
    expect(row.basis.trim()).not.toBe("");
    expect(COUNT_WINDOWS).toContain(row.window);
    expect(FIGURE_WINDOWS.map((window) => window.id)).toContain(row.windowId);
    if (row.status === "reserved") {
      expect(row.compute, "a reserved row has no function until PR A lands").toBeNull();
      expect(row.basis).toMatch(/^Reserved: PR A builds/);
    } else {
      expect(typeof row.compute).toBe("function");
      expect(row.how.length, "a built row explains how it is counted").toBeGreaterThan(0);
    }
  });

  it("reserves exactly PR A's four figures (R-FIGS-12, R-FIGS-16)", () => {
    expect(
      ALL_FIGURES.filter((row) => row.status === "reserved")
        .map((row) => row.id)
        .sort(),
    ).toEqual(["average-completed-stay", "expected-to-leave-today", "left-today", "stay-so-far"]);
  });

  it("shows each rail badge from one row per desk", () => {
    const rails = ALL_FIGURES.flatMap((row) => (row.rail ? [`${row.rail.id}/${row.rail.desk ?? "any"}`] : []));
    expect(new Set(rails).size).toBe(rails.length);
    expect(rails.sort()).toEqual(["capacity/any", "delays/any", "discharges/any", "referrals/any", "referrals/team"]);
  });
});

describe("the bed-demand rules (D-220: Need a bed is the Capacity rule; No ward yet is Home's stage tab)", () => {
  const state = seedWardFlowState();
  const now = NOW_ANCHOR;
  const needABed = state.movements.filter(needsABed);
  const noWard = state.movements.filter(noWardYet);

  it("Need a bed counts the people Capacity and the forecast count", () => {
    expect(needABed.length, "the seed has people needing a bed").toBeGreaterThan(0);
    expect(bedKindTotals(bedKindGaps(state.movements, state.units, now, state.admissions)).waiting).toBe(
      needABed.length,
    );
    expect(
      bedsForecast(state.units, state.bedReleases, state.admissions, state.movements, now).horizons.map(
        (horizon) => horizon.waitingForBed,
      ),
    ).toEqual([needABed.length, needABed.length, needABed.length]);
  });

  it("No ward yet is Home's flow stage 'bed' for every stage, open or closed", () => {
    for (const stage of MOVEMENT_STAGES) {
      for (const closed of [false, true]) {
        const movement = {
          ...state.movements[0]!,
          stage,
          closure: closed ? state.movements.find((m) => m.closure)?.closure : undefined,
        } as Movement;
        expect(noWardYet(movement), `${stage}${closed ? " closed" : ""}`).toBe(
          isOpen(movement) && flowStageOf(movement) === "bed",
        );
      }
    }
    expect(noWard.length).toBe(state.movements.filter(isOpen).filter((m) => flowStageOf(m) === "bed").length);
  });

  it("Need a bed less No ward yet is the accepted journeys with no bed pulled or named", () => {
    const acceptedNoBed = needABed.filter((movement) => movement.stage === "accepted_awaiting_bed");
    const noWardHoldingABed = noWard.filter((movement) => !needsABed(movement));
    expect(acceptedNoBed.length, "the seed has accepted journeys waiting for the pull").toBeGreaterThan(0);
    expect(needABed.length - noWard.length).toBe(acceptedNoBed.length - noWardHoldingABed.length);
  });
});

describe("the ED figures: Waiting in ED and ED journeys open are two populations (D-220)", () => {
  const state = seedWardFlowState();
  const now = NOW_ANCHOR;

  it("ED journeys open is the people still in the department plus the people in transit", () => {
    const journeys = openEdJourneys(state.movements, now);
    expect(journeys.inTransit, "the seed has people in transit").toBeGreaterThan(0);
    expect(journeys.total).toBe(journeys.stillInEd + journeys.inTransit);
    expect(waitingInEds(state.movements, now).total).toBeLessThanOrEqual(journeys.stillInEd);
  });

  it("the rail's Waiting badge is the Waiting in ED row", () => {
    const counts = wardNavCounts({ ...state, sites: wardSites, now, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    expect(counts.delays?.value).toBe(waitingInEds(state.movements, now).total);
  });
});

describe("the beds and discharges rows agree with the rail", () => {
  const state = seedWardFlowState();
  const now = NOW_ANCHOR;
  const counts = wardNavCounts({ ...state, sites: wardSites, now, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });

  it("Beds ready now is the rail's ready figure (PR A aligns every other caller's hold list)", () => {
    expect(counts.capacity?.value).toBe(
      totalReadyBedsNow(state.units, state.admissions, state.bedReleases, [...state.movements, ...state.referrals]),
    );
  });

  it("Held up · by tomorrow is the rail's Discharges figure over the open wards' releases", () => {
    const openUnitIds = new Set(state.units.filter((unit) => !unit.isClosed).map((unit) => unit.id));
    const rollup = serviceRollup(wardSites, state.units, state.bedReleases, state.leaveBeds, now);
    expect(rollup.service.blockedToday, "the seed has releases held up").toBeGreaterThan(0);
    expect(counts.discharges?.value).toBe(rollup.service.blockedToday);
    expect(
      heldUpDueByTomorrow(
        state.bedReleases.filter((release) => openUnitIds.has(release.unitId)),
        now,
      ).length,
    ).toBe(rollup.service.blockedToday);
  });
});

describe("the alerts and decision rows (Q260, A9-04)", () => {
  const state = seedWardFlowState();
  const now = NOW_ANCHOR;
  const awaitingPull = acceptedReferralsAwaitingPull(state.referrals, state.units, state.movements).length;
  const figures = alertsNowFigures(activeTaskItems(state, now), awaitingPull);

  it("Referrals awaiting a decision is the rail badge and Home's referral queue", () => {
    const counts = wardNavCounts({ ...state, sites: wardSites, now, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    const awaiting = referralsAwaitingDecision(state.referrals);
    expect(awaiting.length, "the seed has referrals to decide").toBeGreaterThan(0);
    expect(counts.referrals?.value).toBe(awaiting.length);
    expect(
      referralQueueOrder(state.referrals)
        .map((r) => r.id)
        .sort(),
    ).toEqual(awaiting.map((r) => r.id).sort());
  });

  it("Needs you is act now plus the referrals to decide; Open alerts is act now plus waiting", () => {
    const toDecide = referralQueueOrder(state.referrals).length;
    expect(needsYouCount(figures.actNow, toDecide)).toBe(figures.actNow + toDecide);
    expect(figures.outstanding).toBe(figures.actNow + figures.waiting);
  });
});

describe("the team's Referrals to answer (R-STRUCT-24)", () => {
  it("holds the demo list's ids, in order", () => {
    expect([...TEAM_REFERRAL_IDS]).toEqual(REFERRALS.map((referral) => referral.id));
  });

  it("counts what the team page counts", () => {
    const none = {};
    const one = { [TEAM_REFERRAL_IDS[1]]: { id: TEAM_REFERRAL_IDS[1], line: "Accepted", at: 0 } };
    expect(teamReferralsToAnswer(none)).toBe(openReferrals(REFERRALS, none).length);
    expect(teamReferralsToAnswer(one)).toBe(openReferrals(REFERRALS, one).length);
    expect(teamReferralsToAnswer(one)).toBe(REFERRALS.length - 1);
  });
});
