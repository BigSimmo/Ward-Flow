import { describe, expect, it } from "vitest";

import { meetingTvExtras } from "@/components/ward-management/bed-meeting/tv-derivations";
import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { closedWardsNote } from "@/components/ward-management/capacity/capacity-expected-occupancy";
import {
  bedKindBreakdown,
  bedsFreeingTodayTotal,
  networkWardRows,
  type BedKindId,
} from "@/components/ward-management/capacity/capacity-derivations";
import { heldUpReleases } from "@/components/ward-management/capacity/capacity-held-up";
import { expectedOccupancy } from "@/components/ward-management/capacity/expected-occupancy";
import { edAccessRisk } from "@/components/ward-management/forecast/ed-access-risk";
import { releaseText } from "@/components/ward-management/forecast/ed-access-risk-card";
import { bedKindOfNeed, forecastByKind, isWaitingForBed } from "@/components/ward-management/forecast/forecast-by-kind";
import { forecastBrief } from "@/components/ward-management/forecast/forecast-brief";
import { forecastLevers } from "@/components/ward-management/forecast/forecast-levers";
import { forecastReleaseAt } from "@/components/ward-management/forecast/forecast-release-date";
import { hubEntries } from "@/components/ward-management/hub/hub-derivations";
import { leaveBedLabels } from "@/components/ward-management/leave/leave-tracker";
import { downtimePack } from "@/components/ward-management/reports/downtime-pack";
import { networkNamedHolds, readyBedsNow, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { releasesDueByShiftEnd, shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { DEFAULT_DUE_SOON_THRESHOLDS, dayOf, MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { BedRelease, Movement } from "@/components/ward-management/ward-model";
import {
  isExpectedToFree,
  isFreeingToday,
  releasesExpectedToFree,
} from "@/components/ward-management/ward-shared-figures";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

/**
 * Fix package B (Audit 16 R4; root-cause report 3.4 and 3.6, 13 Nov 2026): one shared calculation per
 * headline figure. Synthetic seed only. Each figure two screens print is read through the screens'
 * own selectors and checked against the shared rule, so a screen that drifts back to its own count
 * fails here.
 */
const NOW = NOW_ANCHOR;
const seed = seedWardFlowState();
const holdsOf = (state: WardFlowState) => networkNamedHolds(state.movements, state.referrals);
const sheetOf = (state: WardFlowState) =>
  bedMeetingSheet({
    ...state,
    now: NOW,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    service: null,
    nameOf: (movement) => movement.id,
    referrals: state.referrals,
    referralLimitMinutes: state.configuration.referralDecisionTargetMinutes,
  });

describe("beds expected to free (A16-05)", () => {
  const release = (id: string, expectedAt: number, state: BedRelease["state"] = "expected"): BedRelease => ({
    ...seed.bedReleases[0]!,
    id,
    unitId: seed.units[0]!.id,
    state,
    expectedAt,
    blocker: null,
  });
  const shiftEnd = shiftEndInstant(NOW);
  const releases = [
    release("past-day", NOW - MINUTES_PER_DAY),
    release("earlier-today", NOW - 30),
    release("now", NOW),
    release("by-shift-end", shiftEnd),
    release("tonight", shiftEnd + 60),
    release("done", NOW + 10, "discharged"),
  ];

  it("leaves out a date already passed and a bed already discharged", () => {
    expect(releasesExpectedToFree(releases, NOW, shiftEnd).map((each) => each.id)).toEqual(["now", "by-shift-end"]);
    expect(releases.filter((each) => isFreeingToday(each, NOW)).map((each) => each.id)).toEqual([
      "now",
      "by-shift-end",
      "tonight",
    ]);
  });

  it("is the rule the ward page's 'ready by', Capacity's and the meeting sheet's 'freeing today' read", () => {
    expect(releasesDueByShiftEnd(releases, seed.units[0]!.id, NOW).map((each) => each.id)).toEqual([
      "now",
      "by-shift-end",
    ]);
    expect(bedsFreeingTodayTotal(releases, NOW)).toBe(3);
    const sheet = sheetOf({ ...seed, bedReleases: releases });
    expect(sheet.discharges.freeingToday).toBe(3);
    expect(sheet.discharges.todayRows.length + sheet.discharges.moreTodayRows).toBe(3);
  });

  it("on the seed, 'ready by' adds no overdue date to the ready beds (was 25 + 40 = 65)", () => {
    const overdue = seed.bedReleases.filter((each) => each.state !== "discharged" && each.expectedAt < NOW);
    expect(overdue.length, "the seed has overdue dates, so the guard is not 0 = 0").toBeGreaterThan(0);
    const byShiftEnd = releasesExpectedToFree(seed.bedReleases, NOW, shiftEndInstant(NOW));
    for (const each of byShiftEnd) expect(each.expectedAt).toBeGreaterThanOrEqual(NOW);
    // Every ward's own "ready by" adds up to the All wards header's.
    const perWard = seed.units.reduce(
      (sum, unit) => sum + releasesDueByShiftEnd(seed.bedReleases, unit.id, NOW).length,
      0,
    );
    expect(perWard).toBe(byShiftEnd.length);
    // The shift ends today, so what frees by then is part of what frees today on the meeting sheet.
    const sheet = sheetOf(seed);
    expect(byShiftEnd.length).toBeLessThanOrEqual(sheet.discharges.freeingToday);
    expect(sheet.discharges.freeingToday).toBe(seed.bedReleases.filter((each) => isFreeingToday(each, NOW)).length);
    expect(sheet.discharges.freeingToday).toBeGreaterThan(0);
  });

  it("the sheet's 'held up today' shares the freeing-today day", () => {
    const sheet = sheetOf(seed);
    expect(sheet.discharges.heldUpToday).toBe(
      seed.bedReleases.filter((each) => each.blocker !== null && isFreeingToday(each, NOW)).length,
    );
    expect(isExpectedToFree(release("x", NOW - 1), NOW, NOW + 60)).toBe(false);
  });
});

describe("beds ready agree across screens, with a bed named for an incoming patient (3.4)", () => {
  // Synthetic: one seeded journey re-pointed to hold bed 1 on a ward with a ready bed.
  const unit = seed.units.find(
    (candidate) => !candidate.isClosed && readyBedsNow(candidate, seed.admissions, seed.bedReleases, holdsOf(seed)) > 0,
  )!;
  const holding: Movement = {
    ...seed.movements.find((movement) => movement.originEdId !== undefined)!,
    id: "WF-SYNTH-B-HOLD",
    stage: "accepted_awaiting_bed",
    acceptedUnitId: unit.id,
    heldBedNumber: 1,
    referralId: undefined,
    admissionId: undefined,
    allocatedBed: undefined,
    closure: undefined,
  };
  const state: WardFlowState = { ...seed, movements: [...seed.movements, holding] };
  const holds = holdsOf(state);
  const capacityReady = networkWardRows(
    state.units,
    NOW,
    state.bedReleases,
    state.admissions,
    state.leaveBeds,
    holds,
  ).reduce((sum, row) => sum + row.ready, 0);

  it("the hold takes a bed off Ready on Capacity", () => {
    expect(capacityReady).toBe(totalReadyBedsNow(state.units, state.admissions, state.bedReleases, holds));
    expect(capacityReady).toBe(totalReadyBedsNow(seed.units, seed.admissions, seed.bedReleases, holdsOf(seed)) - 1);
  });

  it("the meeting sheet, hub, downtime pack and TV print Capacity's Ready", () => {
    expect(sheetOf(state).capacity.ready).toBe(capacityReady);
    const hub = hubEntries({ ...state, namedHolds: holds, now: NOW, sites: wardSites });
    expect(hub.reduce((sum, entry) => sum + (entry.kind === "ward" ? (entry.ready ?? 0) : 0), 0)).toBe(capacityReady);
    const pack = downtimePack({ ...state, bedUnits: state.units, now: NOW, identify: () => "Synthetic person" });
    expect(pack.wards.reduce((sum, ward) => sum + ward.counts.ready, 0)).toBe(capacityReady);
    const tv = meetingTvExtras({
      ...state,
      now: NOW,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      nameOf: (movement) => movement.id,
      namedHolds: holds,
      service: null,
    });
    expect(tv.services.reduce((sum, row) => sum + row.ready, 0)).toBe(capacityReady);
  });

  it("the leave tracker numbers beds from the same Ready", () => {
    // A leave bed with no recorded bed number is numbered after the ward's Ready beds.
    const leave = { ...state.leaveBeds[0]!, id: "LB-SYNTH-B", unitId: unit.id, admissionId: "AD-SYNTH-B-NONE" };
    const label = (named: typeof holds) =>
      leaveBedLabels(unit, [leave], state.admissions, state.bedReleases, [leave], named).get(leave.id);
    const ready = readyBedsNow(unit, state.admissions, state.bedReleases, holds);
    expect(label(holds)).toBe(`Bed ${String(ready + 1).padStart(2, "0")}`);
    expect(label([])).toBe(`Bed ${String(ready + 2).padStart(2, "0")}`);
  });
});

describe("the ED access card uses the ward's ready beds (A16-07, 3.6)", () => {
  const risk = edAccessRisk(
    seed.movements,
    seed.units,
    seed.bedReleases,
    seed.admissions,
    NOW,
    seed.configuration.edAccessTargetMinutes,
    seed.referrals,
  );
  const waiting = seed.movements
    .filter(isWaitingForBed)
    .sort((a, b) => a.openedAt - b.openedAt || a.id.localeCompare(b.id));

  // A ward's Ready beds of the kind this person needs, as the mismatch table splits them, never more
  // than the ward's own Ready figure (Codex review on #1657: an open bed never serves a locked need).
  const fittingReady = (unitId: string, kind: BedKindId) => {
    const unit = seed.units.find((each) => each.id === unitId)!;
    const ofKind =
      bedKindBreakdown(kind, seed.movements, seed.units, seed.admissions, seed.referrals).wards.find(
        (ward) => ward.unit.id === unitId,
      )?.beds ?? 0;
    return Math.min(ofKind, readyBedsNow(unit, seed.admissions, seed.bedReleases, holdsOf(seed)));
  };
  const lineOf = (movement: Movement) =>
    waiting.filter(
      (each) => each.acceptedUnitId === movement.acceptedUnitId && bedKindOfNeed(each) === bedKindOfNeed(movement),
    );

  it("never lists a person whose accepting ward shows a fitting bed ready for their place in its line", () => {
    const accepted = risk.atRisk.filter((row) => row.acceptedUnitName !== null);
    for (const row of accepted) {
      const movement = seed.movements.find((each) => each.id === row.movementId)!;
      expect(lineOf(movement).indexOf(movement), row.movementId).toBe(row.ahead);
      expect(row.ahead, `${row.movementId} has a fitting ready bed`).toBeGreaterThanOrEqual(
        fittingReady(movement.acceptedUnitId!, bedKindOfNeed(movement)),
      );
    }
    // The first accepted person of a kind at a ward with a fitting bed ready now is not at risk.
    const firstServed = waiting.filter(
      (each) =>
        each.acceptedUnitId && lineOf(each)[0] === each && fittingReady(each.acceptedUnitId, bedKindOfNeed(each)) > 0,
    );
    expect(firstServed.length, "the seed has an accepted person with a fitting ward bed ready").toBeGreaterThan(0);
    for (const each of firstServed) expect(risk.atRisk.map((row) => row.movementId)).not.toContain(each.id);
  });

  it("does not serve a person from a ready bed of another kind at their accepting ward", () => {
    // An accepted adult in ED, inside the card's window, whose ward has ready beds of one kind only.
    const target = waiting.find((each) => {
      if (!each.acceptedUnitId || each.cohort !== "Adult" || !isWaitingInEd(each)) return false;
      const passesAt = each.openedAt + seed.configuration.edAccessTargetMinutes;
      if (passesAt <= NOW || passesAt > NOW + MINUTES_PER_DAY) return false;
      const other: BedKindId = bedKindOfNeed(each) === "locked_adult" ? "open_adult" : "locked_adult";
      return (
        fittingReady(each.acceptedUnitId, bedKindOfNeed(each)) > 0 && fittingReady(each.acceptedUnitId, other) === 0
      );
    });
    // The seed must keep a case for this check; fail loudly rather than pass silently.
    if (!target) expect.fail("the seed has no accepted adult in ED whose ward has ready beds of one kind only");
    // Flip the bed kind they need, and take away that ward's releases, so only a wrong-kind bed is left.
    const flipped: Movement = { ...target, security: target.security === "Secure" ? "Open" : "Secure" };
    const flippedRisk = edAccessRisk(
      seed.movements.map((each) => (each.id === target.id ? flipped : each)),
      seed.units,
      seed.bedReleases.filter((each) => each.unitId !== target.acceptedUnitId),
      seed.admissions,
      NOW,
      seed.configuration.edAccessTargetMinutes,
      seed.referrals,
    );
    const row = flippedRisk.atRisk.find((each) => each.movementId === target.id);
    expect(row, "a ready bed of another kind does not serve them").toBeDefined();
    expect(row!.slotAt).toBeNull();
  });

  it("says 'ahead in the line' only when someone is ahead", () => {
    const row = risk.atRisk[0]!;
    const withRelease = { ...row, nextRelease: { unitId: "u", unitName: "Ward B", at: NOW + 60 } };
    expect(releaseText({ ...withRelease, ahead: 0 }, NOW, true)).not.toMatch(/ahead in the line/u);
    expect(releaseText({ ...withRelease, ahead: 1 }, NOW, true)).toMatch(/1 person ahead in the line\.$/u);
    expect(releaseText({ ...withRelease, ahead: 3 }, NOW, true)).toMatch(/3 people ahead in the line\.$/u);
  });
});

describe("figures that count different spans say so (A16-19, A16-25)", () => {
  it("Capacity's overdue lever counts overdue dates on open wards that are not held up", () => {
    const open = new Set(seed.units.filter((unit) => !unit.isClosed).map((unit) => unit.id));
    const admissions = new Map(seed.admissions.map((admission) => [admission.id, admission]));
    const expected = seed.bedReleases.filter((each) => {
      const at = forecastReleaseAt(each, admissions.get(each.admissionId));
      return (
        each.state !== "discharged" &&
        open.has(each.unitId) &&
        each.blocker === null &&
        at <= NOW + MINUTES_PER_DAY &&
        dayOf(at) < dayOf(NOW)
      );
    }).length;
    const levers = forecastLevers(seed.units, seed.bedReleases, seed.admissions, NOW);
    const overdue = levers.find((lever) => lever.kind === "review_overdue");
    expect(overdue?.beds).toBe(expected);
    const brief = forecastBrief(
      forecastByKind(seed.units, seed.bedReleases, seed.admissions, seed.movements, NOW, 1),
      [overdue!],
      edAccessRisk([], [], [], [], NOW, 24 * 60, []),
      (id) => id,
    );
    expect(brief.map((line) => line.text).join(" ")).toMatch(/overdue discharges? not held up/u);
  });

  it("held up: Capacity, the sheet and TV all due by tomorrow (D-191 item 5), the sheet's today line today", () => {
    const open = seed.bedReleases.filter((each) => each.state !== "discharged" && each.blocker !== null);
    const byTomorrow = open.filter((each) => dayOf(each.expectedAt) - dayOf(NOW) <= 1).length;
    expect(heldUpReleases(seed.bedReleases, NOW).total).toBe(byTomorrow);
    const sheet = sheetOf(seed);
    expect(sheet.discharges.heldUp).toBe(byTomorrow);
    expect(sheet.discharges.heldUpToday).toBe(open.filter((each) => isFreeingToday(each, NOW)).length);
  });

  it("the TV's causes add up to its open movements figure", () => {
    const sheet = sheetOf(seed);
    expect(sheet.delays.groups.reduce((sum, group) => sum + group.count, 0)).toBe(sheet.delays.total);
  });

  it("expected occupancy names the closed wards its total leaves out", () => {
    const occupancy = expectedOccupancy(seed.units, seed.bedReleases, seed.admissions, NOW, [], holdsOf(seed));
    const closed = seed.units.filter((unit) => unit.isClosed);
    const allBeds = seed.units.reduce((sum, unit) => sum + unit.beds, 0);
    expect(occupancy.total.beds + closed.reduce((sum, unit) => sum + unit.beds, 0)).toBe(allBeds);
    if (closed.length > 0) expect(closedWardsNote(seed.units)).toMatch(/leaves out \d+ closed wards? \(\d+ beds?\)/u);
    expect(closedWardsNote(seed.units.map((unit) => ({ ...unit, isClosed: false })))).toBe("");
  });
});
