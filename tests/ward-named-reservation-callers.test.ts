import { describe, expect, it } from "vitest";

import { bedMapWards } from "@/components/ward-management/capacity/bed-map";
import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import {
  bedKindBreakdown,
  bedKindGaps,
  bedKindTotals,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { meetingTvExtras, wardTvSheet } from "@/components/ward-management/bed-meeting/tv-derivations";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import type { ReservationReferral } from "@/components/ward-management/ward-bed-states";
import { numberedBedKind } from "@/components/ward-management/ward-bed-designation";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * WF-FIG-017 (Josh, 7 Nov 2026): a named reservation makes the bed unavailable, so it is held, not
 * free. `bedStates` already applies this when it is given the reservations; these are the Capacity
 * callers (forecast, Mismatch cards, network table and bed map) that once called it without them.
 * Synthetic: one seeded journey re-pointed to hold bed 1 on an open ward with a bed ready.
 */
const NOW = NOW_ANCHOR;
// An older-adult or youth ward, so every Ready bed fits that one bed kind on the Mismatch cards.
const unit: Unit = allUnits().find(
  (candidate) =>
    !candidate.isClosed &&
    candidate.cohort !== "Adult" &&
    bedKindGaps([], [candidate], NOW_ANCHOR).some((row) => row.bedsThatFit > 0),
)!;
const holding: Movement = {
  ...wardMovements[0]!,
  id: "WF-SYNTH-HOLD",
  stage: "accepted_awaiting_bed",
  acceptedUnitId: unit.id,
  heldBedNumber: 1,
  referralId: undefined,
  admissionId: undefined,
  allocatedBed: undefined,
  closure: undefined,
};
const before = bedStates(unit, [], [], [], []);
const held = bedStates(unit, [], [], [], [holding]);

describe("named reservations on Capacity (WF-FIG-017)", () => {
  it("the shared rule takes the held bed off Ready", () => {
    expect(unit).toBeDefined();
    expect(held.ready).toBe(before.ready - 1);
    expect(held.pulled).toBe(before.pulled + 1);
  });

  it("the forecast does not count the held bed as free now", () => {
    const tomorrow = bedsForecast([unit], [], [], [holding], NOW).horizons[0]!;
    expect(tomorrow.readyNow).toBe(held.ready);
    // The holder has a bed: they are not also counted as still waiting for one.
    expect(tomorrow.waitingForBed).toBe(0);
  });

  it("the network table and bed map show the held bed as held", () => {
    const [row] = networkWardRows([unit], NOW, [], [], [], [holding]);
    expect(row!.ready).toBe(held.ready);
    expect(row!.pulled).toBe(held.pulled);
    const [ward] = bedMapWards([unit], [], [], [], [holding]);
    expect(ward!.ready).toBe(held.ready);
    expect(ward!.pulled).toBe(held.pulled);
  });

  it("the Mismatch cards neither offer the held bed nor count its holder as still waiting", () => {
    const without = bedKindGaps([], [unit], NOW).find((row) => row.bedsThatFit > 0)!;
    const withHold = bedKindGaps([holding], [unit], NOW).find((row) => row.id === without.id)!;
    expect(withHold.bedsThatFit).toBe(without.bedsThatFit - 1);
    expect(bedKindTotals(bedKindGaps([holding], [unit], NOW)).waiting).toBe(0);
    const breakdown = bedKindBreakdown(without.id, [holding], [unit]);
    expect(breakdown.waiting).toEqual([]);
    expect(breakdown.wards.reduce((sum, ward) => sum + ward.beds, 0)).toBe(withHold.bedsThatFit);
  });

  it("a held locked bed comes off locked supply, not open (Codex review on #1506)", () => {
    const fits = (gaps: ReturnType<typeof bedKindGaps>, id: string) => gaps.find((row) => row.id === id)!.bedsThatFit;
    const mixed = allUnits().find((candidate) => {
      const gaps = bedKindGaps([], [candidate], NOW);
      return (
        !candidate.isClosed &&
        candidate.cohort === "Adult" &&
        numberedBedKind(candidate, 1) === "locked" &&
        fits(gaps, "locked_adult") > 0 &&
        fits(gaps, "open_adult") > 0
      );
    })!;
    expect(mixed).toBeDefined();
    const holdLocked: Movement = { ...holding, acceptedUnitId: mixed.id, heldBedNumber: 1 };
    const before = bedKindGaps([], [mixed], NOW);
    const after = bedKindGaps([holdLocked], [mixed], NOW);
    expect(fits(after, "locked_adult")).toBe(fits(before, "locked_adult") - 1);
    expect(fits(after, "open_adult")).toBe(fits(before, "open_adult"));
  });

  it("a referral-only hold is held on the ward and service TVs too", () => {
    // Synthetic accepted referral arm holding bed 1 with no journey yet.
    const referralHold = {
      id: "WF-SYNTH-REF-HOLD",
      state: "accepted",
      destination: { kind: "psychiatric_ward", unitId: unit.id },
      heldBedNumber: 1,
    } as unknown as ReservationReferral;
    const tv = { units: [unit], movements: [], bedReleases: [], admissions: [], leaveBeds: [], now: NOW };
    const common = { ...tv, thresholds: DEFAULT_DUE_SOON_THRESHOLDS, nameOf: () => "" };
    expect(wardTvSheet({ ...common, unit }).capacity.ready).toBe(before.ready);
    expect(wardTvSheet({ ...common, unit, namedHolds: [referralHold] }).capacity.ready).toBe(before.ready - 1);
    const service = unitHealthService(unit)!;
    const [ward] = meetingTvExtras({ ...common, service, namedHolds: [referralHold] }).wards;
    expect(ward!.ready).toBe(before.ready - 1);
  });
});
