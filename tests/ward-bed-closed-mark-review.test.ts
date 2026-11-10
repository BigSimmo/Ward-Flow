import { describe, expect, it } from "vitest";

import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import {
  bedReviewDue,
  bedReviewLine,
  closedBedsPastReview,
} from "@/components/ward-management/capacity/bed-closure-review";
import { reviewAtFrom, REVIEW_AFTER_CHOICES } from "@/components/ward-management/capacity/closure-choice";
import { WARD_REOPEN_AFTER_HOURS } from "@/components/ward-management/capacity/ward-closure";
import { closedBedsReviewSection } from "@/components/ward-management/bed-meeting/bed-meeting-agenda";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import type { Unit } from "@/components/ward-management/ward-model";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";
import { wardStaySeats } from "@/components/ward-management/ward/ward-bed-layout";

/**
 * Item 6 (10 Nov 2026), bed closures with a review time: closing one bed may carry "look at this
 * again" (`reviewAt`). It only prompts: nothing reopens by itself, and Ready is the same with or
 * without it. Synthetic seeded state only.
 */
const NOW = NOW_ANCHOR;
const MAX_MINUTES = Math.max(...WARD_REOPEN_AFTER_HOURS) * 60;

function takenBeds(state: WardFlowState, unit: Unit): Set<number> {
  const stays = state.admissions.filter((admission) => admission.unitId === unit.id);
  const seats = wardStaySeats(unit, stays);
  return new Set(
    stays.flatMap((stay) => {
      const bed = bedIsOccupied(stay) ? (stay.bedNumber ?? seats.get(stay.id)) : undefined;
      return bed === undefined ? [] : [bed];
    }),
  );
}

function setup() {
  const state = seedWardFlowState();
  const unit = state.units.find(
    (candidate) =>
      (candidate.closedBeds ?? []).length === 0 &&
      boundedBedAvailability(candidate).available >= 2 &&
      takenBeds(state, candidate).size < candidate.beds,
  )!;
  const taken = takenBeds(state, unit);
  const freeBed = [...Array(unit.beds).keys()].map((i) => unit.beds - i).find((bed) => !taken.has(bed))!;
  return { state, unit, freeBed };
}

const close = (state: WardFlowState, unitId: string, bedNumber: number, extra: { reviewAt?: number } = {}) =>
  wardFlowReducer(state, {
    type: "SET_BED_CLOSED",
    role: "ward",
    now: NOW,
    unitId,
    actingUnitId: unitId,
    bedNumber,
    closed: true,
    ...extra,
  });

const unitOf = (state: WardFlowState, unitId: string) => state.units.find((unit) => unit.id === unitId)!;
const readyOf = (state: WardFlowState, unitId: string) =>
  bedStates(unitOf(state, unitId), state.admissions, state.bedReleases, state.leaveBeds).ready;

describe("SET_BED_CLOSED with a review time", () => {
  it("records the review time and leaves Ready exactly as a closure without one", () => {
    const { state, unit, freeBed } = setup();
    const plain = close(state, unit.id, freeBed);
    const reviewed = close(state, unit.id, freeBed, { reviewAt: NOW + 4 * 60 });
    expect(reviewed.rejections).toEqual(state.rejections);
    expect(unitOf(reviewed, unit.id).closedBeds).toEqual([
      { bedNumber: freeBed, at: NOW, by: expect.any(String), reviewAt: NOW + 240 },
    ]);
    expect(readyOf(reviewed, unit.id)).toBe(readyOf(plain, unit.id));
    expect(boundedBedAvailability(unitOf(reviewed, unit.id))).toEqual(boundedBedAvailability(unitOf(plain, unit.id)));
    // Past the review time the bed is still closed and Ready still the same: the time only prompts.
    const later = { ...reviewed, now: NOW + 300 };
    expect(readyOf(later, unit.id)).toBe(readyOf(plain, unit.id));
    expect(unitOf(later, unit.id).closedBeds?.[0]?.reopenedAt).toBeUndefined();
  });

  it("refuses a review time not later than now or beyond the longest choice", () => {
    const { state, unit, freeBed } = setup();
    for (const reviewAt of [NOW, NOW - 1, NOW + MAX_MINUTES + 1, Number.NaN]) {
      const refused = close(state, unit.id, freeBed, { reviewAt });
      expect(refused.rejections).toHaveLength(state.rejections.length + 1);
      expect(unitOf(refused, unit.id).closedBeds).toBeUndefined();
    }
    expect(close(state, unit.id, freeBed, { reviewAt: NOW + MAX_MINUTES }).rejections).toEqual(state.rejections);
  });

  it("refuses a review time on a reopening, as it refuses a reason", () => {
    const { state, unit, freeBed } = setup();
    const closed = close(state, unit.id, freeBed, { reviewAt: NOW + 60 });
    const refused = wardFlowReducer(closed, {
      type: "SET_BED_CLOSED",
      role: "ward",
      now: NOW,
      unitId: unit.id,
      actingUnitId: unit.id,
      bedNumber: freeBed,
      closed: false,
      reviewAt: NOW + 60,
    });
    expect(refused.rejections.at(-1)?.reason).toMatch(/takes no review time/);
    expect(unitOf(refused, unit.id).closedBeds?.[0]?.reopenedAt).toBeUndefined();
  });
});

describe("closed bed review prompts", () => {
  const mark = { bedNumber: 3, at: NOW - 60, by: "Ward manager" };

  it("is due only once the review time has come on a bed still closed", () => {
    expect(bedReviewDue(mark, NOW)).toBe(false);
    expect(bedReviewLine(mark, NOW)).toBeNull();
    expect(bedReviewDue({ ...mark, reviewAt: NOW + 30 }, NOW)).toBe(false);
    expect(bedReviewLine({ ...mark, reviewAt: NOW + 30 }, NOW)).toMatch(/^Review \d\d:\d\d$/);
    expect(bedReviewDue({ ...mark, reviewAt: NOW }, NOW)).toBe(true);
    expect(bedReviewLine({ ...mark, reviewAt: NOW - 5 }, NOW)).toBe("Review overdue");
    expect(bedReviewDue({ ...mark, reviewAt: NOW - 5, reopenedAt: NOW - 1 }, NOW)).toBe(false);
  });

  it("offers Not known first, which leaves the time out", () => {
    expect(REVIEW_AFTER_CHOICES[0]).toEqual({ id: "", label: "Not known" });
    expect(REVIEW_AFTER_CHOICES.map((choice) => choice.id).slice(1)).toEqual(WARD_REOPEN_AFTER_HOURS.map(String));
    expect(reviewAtFrom("", NOW)).toBeUndefined();
    expect(reviewAtFrom("8", NOW)).toBe(NOW + 480);
  });

  it("lists closed beds past review in service then ward-name order, never by lateness", () => {
    const units = seedWardFlowState().units.map((unit) => ({ ...unit, closedBeds: [] as Unit["closedBeds"] }));
    const [first, second] = [units[units.length - 1]!, units[0]!];
    first.closedBeds = [{ ...mark, reviewAt: NOW - 1 }];
    second.closedBeds = [
      { ...mark, bedNumber: 5, reviewAt: NOW - 600 },
      { ...mark, bedNumber: 2, reviewAt: NOW + 60 },
    ];
    const rows = closedBedsPastReview(units, NOW);
    expect(rows.map((row) => row.mark.bedNumber).sort()).toEqual([3, 5]);
    const key = (unit: Unit) => `${siteByCode(unit.siteCode)?.service ?? ""}|${unit.name}`;
    const keys = rows.map((row) => key(row.unit));
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
  });
});

describe("seeded demo closed bed", () => {
  it("has one closed bed past its review on the standard seed, shown on the agenda", () => {
    const state = seedWardFlowState();
    const rows = closedBedsPastReview(state.units, NOW);
    expect(rows.length).toBeGreaterThan(0);
    const section = closedBedsReviewSection(state.units, NOW);
    expect(section.total).toBe(rows.length);
    expect(section.items[0]).toMatchObject({ unitId: rows[0]!.unit.id, bedNumber: rows[0]!.mark.bedNumber });
    // The seeded bed has nobody in it, and the ward still has a Ready bed.
    const unit = rows[0]!.unit;
    expect(takenBeds(state, unit).has(rows[0]!.mark.bedNumber)).toBe(false);
    expect(boundedBedAvailability(unit).available).toBeGreaterThan(0);
  });

  it("loads a stored state with a review time and an older mark without one", () => {
    const state = JSON.parse(JSON.stringify(seedWardFlowState())) as WardFlowState;
    const unit = state.units.find((candidate) => (candidate.closedBeds ?? []).length > 0)!;
    expect(isValidStoredWardFlowState(state)).toBe(true);
    const older = { ...unit.closedBeds![0]! };
    delete older.reviewAt;
    unit.closedBeds = [older];
    expect(isValidStoredWardFlowState(state)).toBe(true);
    unit.closedBeds = [{ ...older, reviewAt: "soon" as unknown as number }];
    expect(isValidStoredWardFlowState(state)).toBe(false);
  });
});
