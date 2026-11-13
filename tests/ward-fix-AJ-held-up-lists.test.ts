import { describe, expect, it } from "vitest";

import { wardTvSheet } from "@/components/ward-management/bed-meeting/tv-derivations";
import {
  dailySheetGroups,
  dailySheetPeople,
  heldUpStayKeys,
} from "@/components/ward-management/board/ward-daily-sheet";
import { DEFAULT_DUE_SOON_THRESHOLDS, MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { heldUpDueByTomorrow } from "@/components/ward-management/ward-held-up";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Fix package AJ (Josh, 13 Nov 2026, D-191 item 5; F-105). Synthetic data only. "Held up" is due by
 * tomorrow (overdue, today, tomorrow) on the ward TV and the ward daily sheet as on the Ward page,
 * so each list names exactly the people its count counts, and a held-up discharge due later is in
 * neither. The count is `heldUpDueByTomorrow` over the ward's releases, as `ward-screen.tsx` counts.
 */
const NOW = NOW_ANCHOR;

function tvFor(state: WardFlowState, unit: Unit) {
  return wardTvSheet({
    ...state,
    unit,
    now: NOW,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    nameOf: (movement: Movement) => movement.id,
    namedHolds: [...state.movements, ...state.referrals],
  });
}

function sheetHeldUp(state: WardFlowState, unit: Unit) {
  return dailySheetGroups(dailySheetPeople(state.admissions, unit.id, NOW), heldUpStayKeys(state.bedReleases, NOW))
    .heldUp;
}

function wardCount(state: WardFlowState, unit: Unit) {
  return heldUpDueByTomorrow(
    state.bedReleases.filter((release) => release.unitId === unit.id),
    NOW,
  );
}

describe("D-191 item 5: the ward TV and the daily sheet list who their held-up count counts", () => {
  const seed = seedWardFlowState();

  it("on every seeded ward, the TV list and the sheet group are the Ward page's held-up stays", () => {
    let wardsWithHeldUp = 0;
    let laterBlockerLeftOut = 0;
    for (const unit of seed.units) {
      const counted = wardCount(seed, unit);
      const ids = counted.map((release) => release.admissionId).sort();
      const tv = tvFor(seed, unit).heldUp.map((person) => person.key);
      const sheet = sheetHeldUp(seed, unit).map((person) => person.key);
      expect(tv.length, `${unit.id} TV`).toBe(counted.length);
      expect(sheet.length, `${unit.id} sheet`).toBe(counted.length);
      expect([...tv].sort(), `${unit.id} TV`).toEqual(ids);
      expect([...sheet].sort(), `${unit.id} sheet`).toEqual(ids);
      if (counted.length > 0) wardsWithHeldUp += 1;
      // A stay whose hold-up sits on a later discharge: the old any-date rule listed it.
      laterBlockerLeftOut += dailySheetPeople(seed.admissions, unit.id, NOW).filter(
        (person) => person.blockReason !== null && !ids.includes(person.key),
      ).length;
    }
    expect(wardsWithHeldUp, "the seed holds wards with someone held up by tomorrow").toBeGreaterThan(1);
    expect(laterBlockerLeftOut, "the seed holds a blocker the window leaves out").toBeGreaterThan(0);
  });

  it("a held-up discharge moved to 3 days away leaves both lists, and the count, together", () => {
    const state = seedWardFlowState();
    const release = heldUpDueByTomorrow(state.bedReleases, NOW).find((each) =>
      dailySheetPeople(state.admissions, each.unitId, NOW).some((person) => person.key === each.admissionId),
    );
    expect(release, "the seed holds a held-up release due by tomorrow").toBeDefined();
    if (!release) return;
    const unit = state.units.find((each) => each.id === release.unitId)!;
    expect(tvFor(state, unit).heldUp.map((person) => person.key)).toContain(release.admissionId);
    expect(sheetHeldUp(state, unit).map((person) => person.key)).toContain(release.admissionId);

    const later = NOW + 3 * MINUTES_PER_DAY;
    const moved: WardFlowState = {
      ...state,
      bedReleases: state.bedReleases.map((each) => (each.id === release.id ? { ...each, expectedAt: later } : each)),
      admissions: state.admissions.map((each) =>
        each.id === release.admissionId ? { ...each, expectedDischargeAt: later } : each,
      ),
    };
    const movedRelease = moved.bedReleases.find((each) => each.id === release.id)!;
    expect(movedRelease.blocker, "still held up, only later").not.toBeNull();
    expect(wardCount(moved, unit).map((each) => each.id)).not.toContain(release.id);
    expect(tvFor(moved, unit).heldUp.map((person) => person.key)).not.toContain(release.admissionId);
    expect(sheetHeldUp(moved, unit).map((person) => person.key)).not.toContain(release.admissionId);
    expect(tvFor(moved, unit).heldUp).toHaveLength(wardCount(moved, unit).length);
    expect(sheetHeldUp(moved, unit)).toHaveLength(wardCount(moved, unit).length);
  });
});
