import { describe, expect, it } from "vitest";

import {
  edTvSheet,
  meetingTvExtras,
  tvHealthServices,
  wardTvSheet,
} from "@/components/ward-management/bed-meeting/tv-derivations";
import { buildIncoming, outgoingToday } from "@/components/ward-management/board/ward-board-model";
import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { edOpenSummaries, isUnderAForm } from "@/components/ward-management/ed/ed-home-derivations";
import { occupiedBeds } from "@/components/ward-management/statistics/statistics-occupancy";
import { bedStates, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { headlineAvailable } from "@/components/ward-management/ward-board-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS, type Instant } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { edPressure } from "@/components/ward-management/ward-pressure";
import { openEdJourneys, waitingInEds } from "@/components/ward-management/ward-shared-figures";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

/**
 * AUDIT 4, ONE NUMBER, ONE ANSWER ACROSS SCREENS (issue #1567). One state, from the seed, and every
 * screen's headline figures built from it through the selector or view model that screen calls:
 *
 * - Home (`coordinator-screen.tsx` and its ED strip, `home-ed-pressure.tsx`);
 * - the ward board (`board/ward-board.tsx` and `ward-board-hero.tsx`);
 * - the TV (`bed-meeting/bed-meeting-tv.tsx`: the network view, a ward view and an ED view);
 * - Statistics (`statistics/statistics-screen.tsx`, whose inline figures the DOM twin of this file
 *   reads off the rendered page);
 * - print: the bed meeting sheet (`capacity/bed-meeting-sheet.tsx`, opened from Capacity).
 *
 * Each figure that two screens print under the same words must read the same. Each is checked
 * non-zero on the seed, so agreement is never 0 = 0, and `mismatches` is shown to catch a change
 * to one screen's input. Figures that genuinely disagree today are named in `it.todo` at the foot,
 * with both values in the comment, and are not changed here.
 */

const thresholds = DEFAULT_DUE_SOON_THRESHOLDS;
const nameOf = (movement: Movement) => movement.id;

/** Home's hero: the calls `CoordinatorScreen` makes with no service or ED chosen. */
function homeFigures(state: WardFlowState, now: Instant) {
  const counts = wardNavCounts({ ...state, now, sites: wardSites, thresholds });
  const journeys = openEdJourneys(state.movements, now);
  const occupancy = wardOccupancy(state.units, state.admissions, state.bedReleases);
  return {
    bedsReady: counts.capacity?.value ?? 0,
    openEdMovements: journeys.total,
    inUse: occupancy.inUse,
    occupancyPercent: occupancy.percent === null ? null : Math.round(occupancy.percent),
  };
}

/** Home's ED strip, per department: `edPressure` for "N waiting", `isUnderAForm` over the open list. */
function homeEdTile(state: WardFlowState, now: Instant, edId: string) {
  const row = edPressure(now, state.movements).find((each) => each.ed.id === edId);
  const open = edOpenSummaries(state.movements, now).find((each) => each.ed.id === edId)?.open ?? [];
  return { waiting: row?.waiting ?? 0, onForms: open.filter(isUnderAForm).length };
}

/** The ward board's hero for one ward, as `WardBoard` computes it. */
function boardFigures(state: WardFlowState, now: Instant, unit: Unit) {
  const states = bedStates(unit, state.admissions, [...state.bedReleases], [...state.leaveBeds]);
  const incoming = buildIncoming(unit, state.admissions, state.movements, now);
  return {
    readyNow: headlineAvailable(unit, state.admissions, state.bedReleases, state.leaveBeds, now),
    readyFigure: states.ready,
    occupied: states.occupied,
    pulledNotArrived: incoming.filter((person) => person.state === "pulled").length,
  };
}

/** The TV's inputs, as `BedMeetingTvScreen` builds them (WF-FIG-017 named holds included). */
function tvInputs(state: WardFlowState, now: Instant) {
  return { ...state, now, nameOf, namedHolds: [...state.movements, ...state.referrals] };
}

/** The TV's network view ("All services"). */
function networkTvFigures(state: WardFlowState, now: Instant) {
  const inputs = tvInputs(state, now);
  const sheet = bedMeetingSheet({
    ...inputs,
    service: null,
    thresholds,
    referrals: state.referrals,
    referralLimitMinutes: state.configuration.referralDecisionTargetMinutes,
  });
  const extras = meetingTvExtras({ ...inputs, service: null, thresholds });
  return {
    bedsReady: sheet.capacity.ready,
    waitingInEd: sheet.ed.waiting,
    dischargesDue: sheet.discharges.heldUp + sheet.discharges.confirmed + sheet.discharges.expected,
    serviceRowsReady: extras.services.reduce((sum, row) => sum + row.ready, 0),
    serviceRowsWaiting: extras.services.reduce((sum, row) => sum + row.edWaiting, 0),
    serviceRowsGoing: extras.services.reduce((sum, row) => sum + row.going, 0),
  };
}

/** Print: the bed meeting sheet, as Capacity's "Meeting sheet" opens it for all services. */
function printFigures(state: WardFlowState, now: Instant) {
  const sheet = bedMeetingSheet({
    ...state,
    now,
    thresholds,
    service: null,
    nameOf,
    referrals: state.referrals,
    referralLimitMinutes: state.configuration.referralDecisionTargetMinutes,
  });
  return {
    bedsReady: sheet.capacity.ready,
    occupied: sheet.capacity.occupied,
    pulled: sheet.capacity.pulled,
    waitingInEd: sheet.ed.waiting,
    dischargedToday: sheet.discharges.dischargedToday,
    dischargesDue: sheet.discharges.heldUp + sheet.discharges.confirmed + sheet.discharges.expected,
    departments: sheet.ed.departments,
  };
}

/** Statistics' network figures, from the selectors `StatisticsScreen` calls for its hero. */
function statisticsFigures(state: WardFlowState, now: Instant) {
  const occupancy = occupiedBeds(state.units, state.admissions, state.bedReleases, state.leaveBeds);
  return {
    bedsReady: totalReadyBedsNow(state.units, state.admissions, state.bedReleases),
    occupied: occupancy.occupied,
    pulled: occupancy.pulled,
    inUse: occupancy.inUse,
    occupancyPercent: occupancy.beds > 0 ? Math.round((occupancy.inUse / occupancy.beds) * 100) : 0,
    openEdMovements: openEdJourneys(state.movements, now).total,
  };
}

type Reading = { screen: string; value: number | null };

/** The readings that do not match the first. Empty means one number, one answer. */
function mismatches(readings: readonly Reading[]): Reading[] {
  const [first, ...rest] = readings;
  return rest.filter((reading) => reading.value !== first!.value);
}

/** Every reading agrees, and the figure is not zero on the seed. */
function expectOneAnswer(figure: string, readings: readonly Reading[]) {
  expect(readings.length, `${figure}: at least two screens`).toBeGreaterThanOrEqual(2);
  expect(readings[0]!.value, `${figure}: non-zero on the seed`).toBeGreaterThan(0);
  expect(mismatches(readings), `${figure}: ${JSON.stringify(readings)}`).toEqual([]);
}

describe("one number, one answer across Home, the board, the TV, Statistics and print (Audit 4)", () => {
  const state = seedWardFlowState();
  const now = NOW_ANCHOR;
  const home = homeFigures(state, now);
  const tv = networkTvFigures(state, now);
  const print = printFigures(state, now);
  const statistics = statisticsFigures(state, now);
  const boards = state.units.map((unit) => ({ unit, board: boardFigures(state, now, unit) }));

  it("beds ready now: Home, every ward board summed, the TV, Statistics and the printed sheet", () => {
    expectOneAnswer("beds ready now", [
      { screen: "Home hero", value: home.bedsReady },
      { screen: "ward boards, summed", value: boards.reduce((sum, { board }) => sum + board.readyNow, 0) },
      { screen: "TV, all services", value: tv.bedsReady },
      { screen: "TV, service rows summed", value: tv.serviceRowsReady },
      { screen: "Statistics", value: statistics.bedsReady },
      { screen: "printed sheet", value: print.bedsReady },
    ]);
  });

  it("beds ready now, per ward: the board's headline, its figure row and that ward's TV", () => {
    let wardsWithReady = 0;
    for (const { unit, board } of boards) {
      const wardTv = wardTvSheet({ ...tvInputs(state, now), unit, thresholds });
      expect(
        mismatches([
          { screen: "board headline", value: board.readyNow },
          { screen: "board figure row", value: board.readyFigure },
          { screen: "ward TV", value: wardTv.capacity.ready },
        ]),
        unit.id,
      ).toEqual([]);
      if (board.readyNow > 0) wardsWithReady += 1;
    }
    expect(wardsWithReady, "the seed has wards with ready beds").toBeGreaterThan(1);
  });

  it("occupied and pulled, per ward: the board's hero and that ward's TV sheet", () => {
    let pulledWards = 0;
    for (const { unit, board } of boards) {
      const wardTv = wardTvSheet({ ...tvInputs(state, now), unit, thresholds });
      expect(board.occupied, `${unit.id} occupied`).toBe(wardTv.capacity.occupied);
      expect(board.pulledNotArrived, `${unit.id} pulled, not arrived`).toBe(wardTv.capacity.pulled);
      if (board.pulledNotArrived > 0) pulledWards += 1;
    }
    expect(pulledWards, "the seed has pulled beds on several wards").toBeGreaterThan(1);
  });

  it("occupied, pulled and in use: Home, Statistics and the printed sheet", () => {
    expectOneAnswer("occupied", [
      { screen: "Statistics", value: statistics.occupied },
      { screen: "printed sheet", value: print.occupied },
      { screen: "ward boards, summed", value: boards.reduce((sum, { board }) => sum + board.occupied, 0) },
    ]);
    expectOneAnswer("pulled", [
      { screen: "Statistics", value: statistics.pulled },
      { screen: "printed sheet", value: print.pulled },
      { screen: "ward boards, summed", value: boards.reduce((sum, { board }) => sum + board.pulledNotArrived, 0) },
    ]);
    expectOneAnswer("in use", [
      { screen: "Home ring", value: home.inUse },
      { screen: "Statistics", value: statistics.inUse },
      { screen: "printed sheet, occupied + pulled", value: print.occupied + print.pulled },
    ]);
    expectOneAnswer("occupancy percent", [
      { screen: "Home ring", value: home.occupancyPercent },
      { screen: "Statistics", value: statistics.occupancyPercent },
    ]);
  });

  it("waiting in ED: the TV, its service rows, the printed sheet and the shared waiting figure", () => {
    expectOneAnswer("waiting in ED", [
      { screen: "TV, all services", value: tv.waitingInEd },
      { screen: "TV, service rows summed", value: tv.serviceRowsWaiting },
      { screen: "printed sheet", value: print.waitingInEd },
      { screen: "menu badge and service picker (waitingInEds)", value: waitingInEds(state.movements, now).total },
    ]);
  });

  it("open ED movements: Home's hero and Statistics' chip", () => {
    expectOneAnswer("open ED movements", [
      { screen: "Home hero", value: home.openEdMovements },
      { screen: "Statistics", value: statistics.openEdMovements },
    ]);
  });

  it("per department: Home's ED strip, that ED's TV and the printed sheet count the same waiting and forms", () => {
    let busy = 0;
    let withForms = 0;
    for (const summary of edOpenSummaries(state.movements, now)) {
      const edId = summary.ed.id;
      const tile = homeEdTile(state, now, edId);
      const edTv = edTvSheet({
        ...tvInputs(state, now),
        edId,
        accessTargetMinutes: state.configuration.edAccessTargetMinutes,
        thresholds,
      });
      expect(edTv, edId).toBeDefined();
      const printed = print.departments.find((row) => row.id === edId)?.waiting ?? 0;
      expect(
        mismatches([
          { screen: "Home ED strip", value: tile.waiting },
          { screen: "ED TV", value: edTv!.summary.waiting },
          { screen: "printed sheet", value: printed },
        ]),
        `${edId} waiting`,
      ).toEqual([]);
      // Legal status: "on forms" (Home) and "under a form" (ED TV) are the one `isUnderAForm` rule.
      expect(tile.onForms, `${edId} under a form`).toBe(edTv!.underForm);
      if (tile.waiting > 0) busy += 1;
      if (tile.onForms > 0) withForms += 1;
    }
    expect(busy, "the seed has several busy departments").toBeGreaterThan(1);
    expect(withForms, "the seed has several departments with people under a form").toBeGreaterThan(1);
  });

  it("discharges due today and tomorrow: the TV, its service rows and the printed sheet", () => {
    expectOneAnswer("discharges due", [
      { screen: "TV, all services", value: tv.dischargesDue },
      { screen: "TV, service rows summed", value: tv.serviceRowsGoing },
      { screen: "printed sheet", value: print.dischargesDue },
    ]);
  });

  it("is not vacuous: a change to one screen's input shows as a mismatch", () => {
    // Home alone loses one busy ward from its input; every other screen keeps the seed.
    const busyWard = boards.find(({ board }) => board.occupied > 0)!.unit;
    const perturbed = { ...state, units: state.units.filter((unit) => unit.id !== busyWard.id) };
    const changedHome = homeFigures(perturbed, now);
    const readings = [
      { screen: "Home ring", value: changedHome.inUse },
      { screen: "Statistics", value: statistics.inUse },
      { screen: "printed sheet, occupied + pulled", value: print.occupied + print.pulled },
    ];
    expect(mismatches(readings).map((reading) => reading.screen)).toEqual([
      "Statistics",
      "printed sheet, occupied + pulled",
    ]);
  });

  /*
   * D-115 (Josh, 9 Nov 2026) settled the first two disagreements this audit found:
   * 1. "Coming in" is the ward board's figure, beds pulled or waitlisted for an admission
   *    (`buildIncoming`). The ward TV used to count accepted journeys (scgh-adult-open board 3, TV 0).
   * 2. "Going out today and tomorrow" counts confirmed discharges only, the board's default basis.
   *    The ward TV used to add expected ones (rph-adult-secure board 1, TV 3).
   */
  const serviceWardRows = new Map(
    tvHealthServices(state.units).flatMap((service) =>
      meetingTvExtras({ ...tvInputs(state, now), service, thresholds }).wards.map((row) => [row.id, row] as const),
    ),
  );

  it("coming in (D-115): the ward board, that ward's TV and the service TV's ward row", () => {
    let wardsComing = 0;
    for (const unit of state.units) {
      const wardTv = wardTvSheet({ ...tvInputs(state, now), unit, thresholds });
      const board = buildIncoming(unit, state.admissions, state.movements, now).length;
      expect(
        mismatches([
          { screen: "ward board", value: board },
          { screen: "ward TV", value: wardTv.incoming.total },
          { screen: "service TV ward row", value: serviceWardRows.get(unit.id)?.coming ?? null },
        ]),
        unit.id,
      ).toEqual([]);
      if (board > 0) wardsComing += 1;
    }
    expect(wardsComing, "the seed has people coming in on several wards").toBeGreaterThan(1);
  });

  it("going out today and tomorrow (D-115): confirmed only, on the ward board and both TVs", () => {
    let wardsGoing = 0;
    let expectedLeftOut = 0;
    for (const unit of state.units) {
      const wardTv = wardTvSheet({ ...tvInputs(state, now), unit, thresholds });
      const board = outgoingToday(unit, state.bedReleases, "confirmed", now).length;
      expect(
        mismatches([
          { screen: "ward board", value: board },
          {
            screen: "ward TV",
            value: wardTv.discharges.heldUp + wardTv.discharges.confirmed + wardTv.discharges.expected,
          },
          { screen: "service TV ward row", value: serviceWardRows.get(unit.id)?.going ?? null },
        ]),
        unit.id,
      ).toEqual([]);
      expect(wardTv.discharges.expected, `${unit.id}: no expected discharge is counted`).toBe(0);
      if (board > 0) wardsGoing += 1;
      expectedLeftOut += outgoingToday(unit, state.bedReleases, "expected", now).length;
    }
    expect(wardsGoing, "the seed has confirmed discharges").toBeGreaterThan(0);
    expect(expectedLeftOut, "the seed has expected discharges the rule leaves out").toBeGreaterThan(0);
  });

  /*
   * 3. "Beds ready now" after a referral is accepted into a named bed (`ACCEPT_REFERRAL` with
   *    `bedNumber`, the ward board's "Place here"). D-115: that bed is ready on no screen. The TV and
   *    print subtract the hold (WF-FIG-017); Home, the ward board, Statistics, Handover and Referrals
   *    still call `readyBedsNow`/`totalReadyBedsNow` without it. Seed + RF-005 accepted into
   *    rph-older-adult bed 1: Home, board and Statistics 26, TV and print 25. Not fixed yet: the board
   *    passes no journeys or referrals (`board/ward-board.tsx`, held by open PRs).
   */
  it.todo(
    "Beds ready now (D-115): Home, the board and Statistics subtract a referral's named bed hold, as the TV and print do",
  );
});
