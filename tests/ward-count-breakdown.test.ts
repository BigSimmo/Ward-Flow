import { describe, expect, it } from "vitest";

import {
  breakdownSentence,
  breakdownTotal,
  breakdownView,
  breakdownWithheld,
} from "../src/components/ward-management/count-breakdown-model";
import {
  leaveStays,
  movementBreakdownRows,
  releaseStays,
  stayBreakdownRows,
  wardReadyBreakdownRows,
} from "../src/components/ward-management/count-breakdown-rows";
import { buildIncoming } from "../src/components/ward-management/board/ward-board-model";
import { networkTotals, networkWardRows } from "../src/components/ward-management/capacity/capacity-derivations";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { scopeWorkspace } from "../src/components/ward-management/ward-access-scope";
import { derivedBedReleases } from "../src/components/ward-management/ward-discharge-dates";
import { capacityBreakdown, capacityBreakdownLists } from "../src/components/ward-management/ward-bed-availability";
import { readyBedsByWard, totalReadyBedsNow } from "../src/components/ward-management/ward-bed-states";
import { CLINICAL_VALUES } from "../src/components/ward-management/ward-clinical-values";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { wardNavCounts } from "../src/components/ward-management/ward-nav-counts";
import { STATEWIDE_COORDINATOR, type WardAccess } from "../src/components/ward-management/ward-role-access";
import { openEdJourneys, waitingInEds } from "../src/components/ward-management/ward-shared-figures";
import { NOW_ANCHOR, wardSites } from "../src/components/ward-management/ward-sites";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "../src/components/ward-management/ward-clock";

const state = seedWardFlowState();
const now = NOW_ANCHOR;
const person = () => ({ name: "Synthetic person" });
const listOk = (value: number, rows: Parameters<typeof breakdownTotal>[0]) => {
  expect(breakdownTotal(rows)).toBe(value);
  expect(breakdownView({ value, kind: "people", scope: "own", rows }).state).not.toBe("mismatch");
};

/** Feature plan item 5: for every figure that opens a list, the list adds up to the figure. */
describe("count breakdown: the list equals the figure", () => {
  it("Home: open ED movements", () => {
    const figure = openEdJourneys(state.movements, now);
    expect(figure.total).toBeGreaterThan(0);
    expect(figure.people.length).toBe(figure.total);
    listOk(figure.total, movementBreakdownRows(figure.people, person, now));
  });

  it("Waiting in ED (the badge's figure) is its people", () => {
    const figure = waitingInEds(state.movements, now);
    expect(figure.people.length).toBe(figure.total);
    expect([...figure.byService.values()].reduce((a, b) => a + b, 0)).toBe(figure.total);
  });

  it("Home and the rail: beds ready now", () => {
    const counts = wardNavCounts({
      movements: state.movements,
      units: state.units,
      sites: wardSites,
      referrals: state.referrals,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      admissions: state.admissions,
      now,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    });
    const value = counts.capacity!.value;
    const rows = wardReadyBreakdownRows(counts.capacity!.readyWards ?? []);
    expect(breakdownTotal(rows)).toBe(value);
    expect(value).toBe(
      totalReadyBedsNow(state.units, state.admissions, state.bedReleases, [...state.movements, ...state.referrals]),
    );
    expect(breakdownView({ value, kind: "beds", scope: "own", rows }).state).toBe(value === 0 ? "none" : "list");
  });

  it("Capacity: beds ready", () => {
    const rows = networkWardRows(state.units, now, state.bedReleases, state.admissions, state.leaveBeds);
    const value = networkTotals(rows).ready;
    expect(breakdownTotal(wardReadyBreakdownRows(rows))).toBe(value);
  });

  it("bed board: the day figures and On leave, on every ward", () => {
    const releases = derivedBedReleases([...state.admissions], now);
    for (const unit of state.units) {
      const counts = capacityBreakdown(unit, releases, [...state.leaveBeds], now);
      const lists = capacityBreakdownLists(unit, releases, state.leaveBeds, now);
      const pairs: [number, ReturnType<typeof releaseStays>][] = [
        [counts.confirmedToday, releaseStays(lists.confirmedToday)],
        [counts.expectedToday, releaseStays(lists.expectedToday)],
        [counts.blockedToday, releaseStays(lists.blockedToday)],
        [counts.onLeave, leaveStays(lists.onLeave)],
      ];
      for (const [value, stays] of pairs) listOk(value, stayBreakdownRows(stays, person));
    }
  });

  it("bed board: Pulled, not arrived", () => {
    for (const unit of state.units) {
      const pulled = buildIncoming(unit, state.admissions, state.movements, now).filter((p) => p.state === "pulled");
      const rows = stayBreakdownRows(
        pulled.map((p) => ({ key: p.key, admissionId: p.key })),
        person,
      );
      listOk(pulled.length, rows);
    }
  });

  it("refuses to show a list that does not add up", () => {
    expect(breakdownView({ value: 3, kind: "people", scope: "own", rows: [{ id: "a", label: "A" }] }).state).toBe(
      "mismatch",
    );
  });
});

describe("count breakdown: scope", () => {
  const places = wardPlaceLookup(state.units);

  it("a ward desk lists only its own ward's people and beds", () => {
    const unit = state.units.find((candidate) =>
      state.admissions.some((admission) => admission.unitId === candidate.id),
    )!;
    const desk: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [unit.id] } };
    const scoped = scopeWorkspace(state, desk, { now, places });
    const releases = derivedBedReleases([...scoped.admissions], now);
    const lists = capacityBreakdownLists(unit, releases, scoped.leaveBeds, now);
    const own = new Set(state.admissions.filter((a) => a.unitId === unit.id).map((a) => a.id));
    for (const record of [...lists.confirmedToday, ...lists.expectedToday, ...lists.blockedToday, ...lists.onLeave])
      expect(own.has(record.admissionId)).toBe(true);
    const pulled = buildIncoming(unit, scoped.admissions, scoped.movements, now);
    for (const p of pulled) expect(own.has(p.key)).toBe(true);
    // Beds are not people: a ward desk sees the network's ready beds as counts (D-115), so a bed
    // breakdown lists wards and numbers, never a person.
    for (const row of wardReadyBreakdownRows(readyBedsByWard(scoped.units, scoped.admissions, scoped.bedReleases)))
      expect(row.count).toBeGreaterThan(0);
  });

  it("a site desk's Home ED list holds only journeys its own workspace holds", () => {
    const siteCode = state.units[0].siteCode;
    const desk: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode } };
    const scoped = scopeWorkspace(state, desk, { now, places });
    const inScope = new Set(scoped.movements.map((movement) => movement.id));
    const figure = openEdJourneys(scoped.movements, now);
    for (const movement of figure.people) expect(inScope.has(movement.id)).toBe(true);
    expect(scopeWorkspace(state, STATEWIDE_COORDINATOR, { now, places }).movements.length).toBeGreaterThanOrEqual(
      scoped.movements.length,
    );
  });
});

describe("count breakdown: small numbers and words", () => {
  const line = CLINICAL_VALUES.smallNumberHidden.value;

  it("hides a list of people at any count in an aggregate view (D-137)", () => {
    expect(breakdownWithheld("people", "aggregate", 1)).toBe(true);
    expect(breakdownWithheld("people", "aggregate", line)).toBe(true);
    expect(breakdownWithheld("people", "aggregate", line * 10)).toBe(true);
    expect(breakdownWithheld("people", "aggregate", 0)).toBe(false);
    expect(breakdownWithheld("people", "own", 1)).toBe(false);
    expect(breakdownWithheld("beds", "aggregate", 1)).toBe(false);
    const rows = [{ id: "a", label: "A" }];
    expect(breakdownView({ value: 1, kind: "people", scope: "aggregate", rows }).state).toBe("withheld");
  });

  it("names the panel in plain words", () => {
    expect(breakdownSentence(6, "open ED movements", 14 * 60 + 32)).toBe("6 open ED movements. Counted 14:32.");
  });
});
