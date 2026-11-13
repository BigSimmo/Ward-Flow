import { describe, expect, it } from "vitest";

import { wardTvSheet } from "@/components/ward-management/bed-meeting/tv-derivations";
import { buildTiles } from "@/components/ward-management/board/ward-board-model";
import { bedMapWards } from "@/components/ward-management/capacity/bed-map";
import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import {
  bedKindGaps,
  bedKindTotals,
  combinedKindGap,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { heldUpReleases } from "@/components/ward-management/capacity/capacity-held-up";
import { forecastByKind } from "@/components/ward-management/forecast/forecast-by-kind";
import { toHandoverWard } from "@/components/ward-management/handover/handover-model";
import { bedMapCells } from "@/components/ward-management/statistics/statistics-bed-map";
import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { bedStates, networkNamedHolds, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { headlineAvailable } from "@/components/ward-management/ward-board-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { heldUpDueByTomorrow } from "@/components/ward-management/ward-held-up";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { WARD_SCENARIOS, scenarioWardNetwork, type WardScenario } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * F-88, the sample-day check suite (D-175 item 1; Audit 16 question 13 and A16-25; root-cause review
 * 3.4). Part 2 of 2: the figures. Each screen reads the built day through its own selector, as it
 * does in the app, and the figures must agree, ward by ward and for the network, on every scenario
 * and on the Standard day with the worked examples on. Nothing here re-derives a figure: a
 * disagreement means a screen or a generator no longer follows the one shared rule. Synthetic data only.
 */

const NOW = NOW_ANCHOR;
const thresholds = DEFAULT_DUE_SOON_THRESHOLDS;
const nameOf = (movement: Movement) => movement.id;

type Built = { label: string; scenario: WardScenario; state: WardFlowState };

const DAYS: readonly Built[] = [
  ...WARD_SCENARIOS.map((scenario) => ({ label: scenario, scenario, state: seedWardFlowState(scenario) })),
  {
    label: "standard + worked examples",
    scenario: "standard" as const,
    state: seedWardFlowState("standard", { workedExamples: true }),
  },
];

type Reading = { screen: string; value: number | null | undefined };

/** The readings that disagree, as "ward: screen=value, screen=value", or nothing when they all agree. */
function disagreement(where: string, readings: readonly Reading[]): string[] {
  const values = new Set(readings.map((reading) => reading.value));
  if (values.size <= 1) return [];
  return [`${where}: ${readings.map((reading) => `${reading.screen}=${String(reading.value)}`).join(", ")}`];
}

/** Each ward screen's Ready, Being made ready and Closed for one ward, from that screen's own selector. */
function wardReadings(state: WardFlowState, unit: Unit) {
  const holds = networkNamedHolds(state.movements, state.referrals);
  const states = bedStates(unit, state.admissions, state.bedReleases, state.leaveBeds, holds);
  const row = networkWardRows(state.units, NOW, state.bedReleases, state.admissions, state.leaveBeds, holds).find(
    (each) => each.unit.id === unit.id,
  );
  const map = bedMapWards(state.units, state.bedReleases, state.admissions, state.leaveBeds, holds).find(
    (each) => each.unit.id === unit.id,
  );
  const statsMap = bedMapCells(unit, state.admissions, state.bedReleases, state.leaveBeds, NOW, holds);
  const tiles = buildTiles(unit, state.admissions, state.bedReleases, NOW, { holds });
  const tv = wardTvSheet({ ...state, now: NOW, nameOf, namedHolds: holds, unit, thresholds });
  const handover = toHandoverWard(unit, state.admissions, NOW, state.bedReleases, holds);
  return {
    ready: [
      { screen: "bedStates", value: states.ready },
      { screen: "Capacity row", value: row?.ready },
      { screen: "Capacity bed map", value: map?.ready },
      { screen: "Statistics bed map", value: statsMap.counts.ready },
      {
        screen: "Ward board headline",
        value: headlineAvailable(unit, state.admissions, state.bedReleases, state.leaveBeds, NOW, holds),
      },
      { screen: "Ward board tiles", value: tiles.filter((tile) => tile.kind === "empty" && !tile.preparing).length },
      { screen: "Ward TV", value: tv.capacity.ready },
      { screen: "Handover", value: handover.ready },
    ],
    beingMadeReady: [
      { screen: "bedStates", value: states.beingMadeReady },
      { screen: "Capacity row", value: row?.beingMadeReady },
      { screen: "Capacity bed map", value: map?.beingMadeReady },
      { screen: "Ward board tiles", value: tiles.filter((tile) => tile.kind === "empty" && tile.preparing).length },
      { screen: "Ward TV", value: tv.pendingPreparation },
      { screen: "Handover", value: handover.pendingPreparation },
    ],
    closed: [
      { screen: "bedStates", value: states.closed },
      { screen: "Capacity row", value: row?.closed },
      { screen: "Capacity bed map", value: map?.closed },
      { screen: "Ward board tiles", value: tiles.filter((tile) => tile.kind === "closed").length },
      { screen: "Ward TV", value: tv.capacity.closed },
    ],
  };
}

describe("F-88 ward figures agree on every screen", () => {
  // R-B-09 ("Ready, everywhere"), D-179 item 8 and D-181 item 5 (being made ready is its own count on
  // every screen together), A16-25 and RC 3.4 (one rule, every screen fed the same named holds).
  for (const figure of ["ready", "beingMadeReady", "closed"] as const) {
    it(`gives each ward one ${figure} figure on Capacity, the bed maps, the Ward board, its TV and Handover`, () => {
      const found: string[] = [];
      for (const day of DAYS) {
        for (const unit of day.state.units) {
          found.push(...disagreement(`${day.label} ${unit.id}`, wardReadings(day.state, unit)[figure]));
        }
      }
      expect(found).toEqual([]);
    });
  }

  // R-B-05: the five boxes add up to the ward's beds, so no bed is drawn twice or lost.
  it("adds each ward's five boxes up to its beds", () => {
    const found: string[] = [];
    for (const day of DAYS) {
      const holds = networkNamedHolds(day.state.movements, day.state.referrals);
      for (const unit of day.state.units) {
        const s = bedStates(unit, day.state.admissions, day.state.bedReleases, day.state.leaveBeds, holds);
        const total = s.ready + s.beingMadeReady + s.pulled + s.closed + s.occupied;
        if (total !== unit.beds) found.push(`${day.label} ${unit.id}: ${total} of ${unit.beds}`);
      }
    }
    expect(found).toEqual([]);
  });

  // A16-13 and R-B-05: every occupied bed has exactly one stay. The ward's occupied box and the
  // stays recorded as in a bed on that ward are the same number.
  it("has exactly one stay for every occupied bed", () => {
    const found: string[] = [];
    for (const day of DAYS) {
      const holds = networkNamedHolds(day.state.movements, day.state.referrals);
      for (const unit of day.state.units) {
        const s = bedStates(unit, day.state.admissions, day.state.bedReleases, day.state.leaveBeds, holds);
        const stays = day.state.admissions.filter(
          (admission) => admission.unitId === unit.id && admission.state === "occupied",
        ).length;
        if (stays !== s.occupied) found.push(`${day.label} ${unit.id}: ${s.occupied} occupied, ${stays} stays`);
      }
    }
    expect(found).toEqual([]);
  });
});

describe("F-88 network figures agree", () => {
  // R-B-09 and D-115 item 3 (the one Ready figure, named holds off Ready on every screen).
  it("gives the network one Ready figure on Home, Statistics, the TV sheet and the forecast", () => {
    const found: string[] = [];
    for (const day of DAYS) {
      const { state } = day;
      const holds = networkNamedHolds(state.movements, state.referrals);
      const sheet = bedMeetingSheet({
        ...state,
        now: NOW,
        thresholds,
        service: null,
        nameOf,
        namedHolds: holds,
        referrals: state.referrals,
        referralLimitMinutes: state.configuration.referralDecisionTargetMinutes,
      });
      const forecast = bedsForecast(
        state.units,
        state.bedReleases,
        state.admissions,
        state.movements,
        NOW,
        [],
        state.referrals,
      );
      const sites = scenarioWardNetwork(day.scenario).sites;
      found.push(
        ...disagreement(day.label, [
          { screen: "Home", value: wardNavCounts({ ...state, now: NOW, sites, thresholds }).capacity?.value ?? null },
          { screen: "Statistics", value: totalReadyBedsNow(state.units, state.admissions, state.bedReleases, holds) },
          { screen: "TV and printed sheet", value: sheet.capacity.ready },
          { screen: "forecast ready now", value: forecast.horizons[0]!.readyNow },
        ]),
      );
    }
    expect(found).toEqual([]);
  });

  // D-191 item 5: "held up" is due by tomorrow on Capacity, Ward, the TV, the sheet and Home.
  it("gives one held-up count, ward by ward and for the network, on Capacity, the sheet and the menu", () => {
    const found: string[] = [];
    for (const day of DAYS) {
      const { state } = day;
      const expected = heldUpDueByTomorrow(state.bedReleases, NOW).length;
      for (const unit of state.units) {
        found.push(
          ...disagreement(`${day.label} ${unit.id}`, [
            {
              screen: "held-up rule",
              value: heldUpDueByTomorrow(
                state.bedReleases.filter((release) => release.unitId === unit.id),
                NOW,
              ).length,
            },
            {
              screen: "ward breakdown",
              value: capacityBreakdown(unit, state.bedReleases, state.leaveBeds, NOW).blockedToday,
            },
          ]),
        );
      }
      const sheet = bedMeetingSheet({
        ...state,
        now: NOW,
        thresholds,
        service: null,
        nameOf,
        referrals: state.referrals,
        referralLimitMinutes: state.configuration.referralDecisionTargetMinutes,
      });
      const nav = wardNavCounts({ ...state, now: NOW, sites: scenarioWardNetwork(day.scenario).sites, thresholds });
      found.push(
        ...disagreement(day.label, [
          { screen: "held-up rule", value: expected },
          { screen: "Capacity", value: heldUpReleases(state.bedReleases, NOW).total },
          { screen: "sheet and TV", value: sheet.discharges.heldUp },
          { screen: "menu", value: nav.discharges?.value ?? 0 },
        ]),
      );
    }
    expect(found).toEqual([]);
  });

  // D-191 item 6: "short" adds each bed kind's shortfall and never subtracts a spare bed of another kind.
  it("gives one short figure on Capacity's bed kinds and the forecast's Now", () => {
    const found: string[] = [];
    for (const day of DAYS) {
      const { state } = day;
      const rows = bedKindGaps(state.movements, state.units, NOW, state.admissions, state.referrals, state.bedReleases);
      const tomorrow = forecastByKind(state.units, state.bedReleases, state.admissions, state.movements, NOW, 1);
      found.push(
        ...disagreement(day.label, [
          { screen: "Capacity totals", value: bedKindTotals(rows).gap },
          { screen: "shortfalls added", value: combinedKindGap(rows.map((row) => row.gap)) },
          { screen: "forecast Now", value: tomorrow.total.now },
          { screen: "forecast kinds added", value: combinedKindGap(tomorrow.kinds.map((kind) => kind.now)) },
        ]),
      );
    }
    expect(found).toEqual([]);
  });
});
