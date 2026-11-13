import { describe, expect, it } from "vitest";

import { wardTvSheet } from "@/components/ward-management/bed-meeting/tv-derivations";
import { buildTiles } from "@/components/ward-management/board/ward-board-model";
import { bedMapWards } from "@/components/ward-management/capacity/bed-map";
import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { bedKindGaps, networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { toHandoverWard } from "@/components/ward-management/handover/handover-model";
import { bedMapCells } from "@/components/ward-management/statistics/statistics-bed-map";
import { boardReadyCounts } from "@/components/ward-management/ward/ward-bed-board-logic";
import {
  bedsPendingPreparation,
  capacityBreakdown,
  openBedsNow,
} from "@/components/ward-management/ward-bed-availability";
import { bedStates, networkNamedHolds, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { headlineAvailable } from "@/components/ward-management/ward-board-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

/*
 * D-179 item 8 and D-181 item 5 (Josh, 13 Nov 2026), from Audit 9 question 11 (A9-13 cause 3):
 * "Ready" no longer includes a bed still being made ready. It is counted and shown on its own
 * ("1 ready, 1 being made ready") on every screen together, and such a bed may still be pulled.
 * This replaces the 5 September 2026 ruling that the bed stays offered and counted in Ready.
 *
 * One seeded state, every surface's own selector, and the one ward the seed has with a bed being
 * made ready (derived, never typed, so the guard cannot pass on a seed with nothing to test).
 */

const now = NOW_ANCHOR;
const thresholds = DEFAULT_DUE_SOON_THRESHOLDS;
const nameOf = (movement: Movement) => movement.id;

function unitOf(state: WardFlowState, id: string): Unit {
  const unit = state.units.find((candidate) => candidate.id === id);
  if (!unit) throw new Error(`no unit ${id}`);
  return unit;
}

/** Each surface's Ready figure and its being-made-ready figure for one ward. */
function wardReadings(state: WardFlowState, unitId: string) {
  const unit = unitOf(state, unitId);
  const holds = networkNamedHolds(state.movements, state.referrals);
  const states = bedStates(unit, state.admissions, state.bedReleases, state.leaveBeds, holds);
  const capacityRow = networkWardRows(
    state.units,
    now,
    state.bedReleases,
    state.admissions,
    state.leaveBeds,
    holds,
  ).find((row) => row.unit.id === unitId)!;
  const map = bedMapWards(state.units, state.bedReleases, state.admissions, state.leaveBeds, holds).find(
    (ward) => ward.unit.id === unitId,
  )!;
  const statsMap = bedMapCells(unit, state.admissions, state.bedReleases, state.leaveBeds, now, holds);
  const tiles = buildTiles(unit, state.admissions, state.bedReleases, now, { holds });
  const tv = wardTvSheet({ ...state, now, nameOf, namedHolds: holds, unit, thresholds });
  const handover = toHandoverWard(unit, state.admissions, now, state.bedReleases, holds);
  return {
    ready: [
      { screen: "bedStates", value: states.ready },
      { screen: "Capacity row", value: capacityRow.ready },
      { screen: "Capacity bed map", value: map.ready },
      { screen: "Statistics bed map", value: statsMap.counts.ready },
      {
        screen: "board headline",
        value: headlineAvailable(unit, state.admissions, state.bedReleases, state.leaveBeds, now, holds),
      },
      { screen: "board Ready tiles", value: tiles.filter((tile) => tile.kind === "empty" && !tile.preparing).length },
      { screen: "ward TV", value: tv.capacity.ready },
      { screen: "handover", value: handover.ready },
    ],
    beingMadeReady: [
      { screen: "bedStates", value: states.beingMadeReady },
      { screen: "Capacity row", value: capacityRow.beingMadeReady },
      { screen: "Capacity row note", value: capacityRow.pendingPreparation ?? null },
      { screen: "Capacity bed map", value: map.beingMadeReady },
      { screen: "Statistics bed map", value: statsMap.counts.prep },
      { screen: "board tiles", value: tiles.filter((tile) => tile.kind === "empty" && tile.preparing).length },
      { screen: "ward TV", value: tv.pendingPreparation },
      { screen: "handover", value: handover.pendingPreparation },
    ],
    states,
  };
}

/** The network's Ready figure on Home, the TV and print, Statistics, the forecast and the morning rollup. */
function networkReady(state: WardFlowState) {
  const holds = networkNamedHolds(state.movements, state.referrals);
  const sheet = bedMeetingSheet({
    ...state,
    now,
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
    now,
    [],
    state.referrals,
  );
  return [
    { screen: "Home", value: wardNavCounts({ ...state, now, sites: wardSites, thresholds }).capacity?.value ?? null },
    { screen: "Statistics", value: totalReadyBedsNow(state.units, state.admissions, state.bedReleases, holds) },
    { screen: "TV and printed sheet", value: sheet.capacity.ready },
    { screen: "forecast ready now", value: forecast.horizons[0]!.readyNow },
  ];
}

function values(readings: readonly { value: number | null }[]) {
  return [...new Set(readings.map((reading) => reading.value))];
}

describe("D-179 item 8: a bed being made ready is not Ready, on every screen together", () => {
  const seeded = seedWardFlowState();
  const preparingUnit = seeded.units.find((unit) => bedsPendingPreparation(unit.id, seeded.bedReleases) > 0);

  it("the seed has a ward with a bed being made ready, so nothing below is vacuous", () => {
    expect(preparingUnit, "no seeded ward has a bed being made ready").toBeDefined();
  });

  it("every ward surface shows the same Ready, which leaves the bed out, and the same being-made-ready count", () => {
    const readings = wardReadings(seeded, preparingUnit!.id);
    expect(values(readings.ready), JSON.stringify(readings.ready)).toHaveLength(1);
    expect(values(readings.beingMadeReady), JSON.stringify(readings.beingMadeReady)).toHaveLength(1);
    const pending = bedsPendingPreparation(preparingUnit!.id, seeded.bedReleases);
    expect(readings.states.beingMadeReady).toBe(pending);
    // The bed came off Ready: Ready plus the bed being made ready is the ward's offered figure.
    const unit = unitOf(seeded, preparingUnit!.id);
    expect(readings.states.ready + readings.states.beingMadeReady).toBe(
      bedStates(unit, seeded.admissions, [], seeded.leaveBeds, networkNamedHolds(seeded.movements, seeded.referrals))
        .ready,
    );
    expect(capacityBreakdown(unit, seeded.bedReleases, seeded.leaveBeds, now).availableNow).toBe(
      openBedsNow(unit, seeded.bedReleases),
    );
  });

  it("the five boxes still add up to the ward's beds, for every ward", () => {
    const holds = networkNamedHolds(seeded.movements, seeded.referrals);
    for (const unit of seeded.units) {
      const s = bedStates(unit, seeded.admissions, seeded.bedReleases, seeded.leaveBeds, holds);
      expect(s.ready + s.beingMadeReady + s.pulled + s.closed + s.occupied, unit.id).toBe(unit.beds);
    }
  });

  it("Home, Statistics, the TV, print and the forecast agree on the network's Ready", () => {
    const readings = networkReady(seeded);
    expect(values(readings), JSON.stringify(readings)).toHaveLength(1);
    expect(readings[0]!.value).toBeGreaterThan(0);
  });

  it("ready that fit never counts a bed being made ready", () => {
    const holds = networkNamedHolds(seeded.movements, seeded.referrals);
    const fit = bedKindGaps(
      seeded.movements,
      seeded.units,
      now,
      seeded.admissions,
      seeded.referrals,
      seeded.bedReleases,
    );
    const ready = totalReadyBedsNow(seeded.units, seeded.admissions, seeded.bedReleases, holds);
    expect(fit.reduce((sum, row) => sum + row.bedsThatFit, 0)).toBeLessThanOrEqual(ready);
  });

  it("the ward page's bed board counts a bed being made ready apart from Ready", () => {
    const beds = [
      { bedNumber: 1, status: "ready" as const, designation: undefined, heldFor: undefined, preparing: false },
      { bedNumber: 2, status: "ready" as const, designation: undefined, heldFor: undefined, preparing: true },
      { bedNumber: 3, status: "occupied" as const, designation: undefined, heldFor: undefined, preparing: false },
    ];
    expect(boardReadyCounts(beds)).toEqual({ ready: 1, beingMadeReady: 1 });
  });

  it("marking the bed ready moves Ready up by one and being made ready down by one, on every screen", () => {
    const release = seeded.bedReleases.find(
      (candidate) => candidate.unitId === preparingUnit!.id && candidate.state === "discharged" && candidate.preparing,
    )!;
    const before = wardReadings(seeded, preparingUnit!.id);
    const networkBefore = networkReady(seeded)[0]!.value!;
    const marked = wardFlowReducer(seeded, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      now,
      actingUnitId: release.unitId,
      releaseId: release.id,
      preparing: false,
    });
    expect(marked.rejections).toHaveLength(seeded.rejections.length);
    const after = wardReadings(marked, preparingUnit!.id);
    expect(values(after.ready), JSON.stringify(after.ready)).toEqual([before.states.ready + 1]);
    expect(values(after.beingMadeReady), JSON.stringify(after.beingMadeReady)).toEqual([
      before.states.beingMadeReady - 1,
    ]);
    const network = networkReady(marked);
    expect(values(network), JSON.stringify(network)).toEqual([networkBefore + 1]);
  });
});

describe("D-181 item 5: a bed being made ready may still be pulled", () => {
  it("pulls into the ward's only free bed while it is being made ready, and counts it as Pulled", () => {
    let state = seedWardFlowState();
    const unitId = "rph-adult-secure";
    const movementId = "WF-009";
    state = wardFlowReducer(state, { type: "REFER_TO_UNITS", role: "coordinator", now, movementId, unitIds: [unitId] });
    state = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now,
      movementId,
      unitId,
      actingUnitId: unitId,
    });
    const unit = unitOf(state, unitId);
    const holds = networkNamedHolds(state.movements, state.referrals);
    const offered = bedStates(unit, state.admissions, state.bedReleases, state.leaveBeds, holds);
    const free = offered.ready;
    expect(free, "the ward must have a free bed to make ready").toBeGreaterThan(0);
    state = {
      ...state,
      bedReleases: [
        ...state.bedReleases,
        ...Array.from({ length: free }, (_unused, index) => ({
          id: `BR-FIX-L-${index}`,
          unitId,
          admissionId: `AD-FIX-L-${index}`,
          state: "discharged" as const,
          expectedAt: now,
          waitingOn: null,
          blocker: null,
          blockedBy: null,
          preparing: true,
          preparationNote: null,
          confirmedAt: now,
          confirmedBy: "Ward",
        })),
      ],
    };
    const preparing = bedStates(unit, state.admissions, state.bedReleases, state.leaveBeds, holds);
    expect(preparing).toMatchObject({ ready: 0, beingMadeReady: free });

    const pulled = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "coordinator",
      now,
      movementId,
      unitId,
    });
    expect(pulled.rejections).toHaveLength(state.rejections.length);
    expect(pulled.movements.find((movement) => movement.id === movementId)?.stage).toBe("pulled");
    const after = bedStates(
      unitOf(pulled, unitId),
      pulled.admissions,
      pulled.bedReleases,
      pulled.leaveBeds,
      networkNamedHolds(pulled.movements, pulled.referrals),
    );
    // The pulled bed is Pulled, never also counted as being made ready.
    expect(after.ready).toBe(0);
    expect(after.beingMadeReady).toBe(free - 1);
    expect(after.pulled).toBe(preparing.pulled + 1);
  });
});
