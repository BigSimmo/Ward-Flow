import { describe, expect, it } from "vitest";

import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("current plan attribution after release date synchronization", () => {
  it.each([
    { state: "departed" as const, planAt: NOW_ANCHOR + 60, recordedAt: NOW_ANCHOR },
    { state: "waitlisted" as const, planAt: NOW_ANCHOR + 60, recordedAt: NOW_ANCHOR },
    { state: "occupied" as const, planAt: null, recordedAt: NOW_ANCHOR },
    { state: "occupied" as const, planAt: NOW_ANCHOR + 60, recordedAt: null },
    { state: "occupied" as const, planAt: NOW_ANCHOR + 60, recordedAt: NaN },
    { state: "occupied" as const, planAt: NaN, recordedAt: NOW_ANCHOR },
  ])(
    "does not credit inactive or unrecorded plans as a fresh ward update ($state, $planAt, $recordedAt)",
    ({ state, planAt, recordedAt }) => {
      const seed = seedWardFlowState();
      const original = seed.admissions[0];
      const originalUnit = seed.units.find((unit) => unit.id === original.unitId)!;
      const shiftStart = currentShiftStartInstant(NOW_ANCHOR);
      const unit = { ...originalUnit, allocatable: { ...originalUnit.allocatable, confirmedAt: shiftStart - 1 } };
      const stay = { ...original, state, expectedDischargeAt: planAt, dischargeDateSetAt: recordedAt };
      expect(bedsForecast([unit], [], [stay], [], NOW_ANCHOR).sources.notUpdatedThisShift).toBe(1);
    },
  );
  it.each([true, false])("counts a current live discharge-plan update as a ward update (flagged %s)", (flagged) => {
    const seed = seedWardFlowState();
    const original = seed.admissions.find((admission) => admission.state === "occupied")!;
    const originalUnit = seed.units.find((unit) => unit.id === original.unitId)!;
    const shiftStart = currentShiftStartInstant(NOW_ANCHOR);
    const unit = { ...originalUnit, allocatable: { ...originalUnit.allocatable, confirmedAt: shiftStart - 1 } };
    const stay = { ...original, expectedDischargeAt: NOW_ANCHOR + 60, dischargeDateSetAt: NOW_ANCHOR };
    const releases: BedRelease[] = flagged
      ? [
          {
            id: "WR-CURRENT-PLAN",
            unitId: unit.id,
            admissionId: stay.id,
            state: "confirmed",
            expectedAt: NOW_ANCHOR + 60,
            waitingOn: null,
            blocker: null,
            blockedBy: null,
            preparing: false,
            preparationNote: null,
            confirmedAt: shiftStart - 1,
            confirmedBy: "Ward manager",
          },
        ]
      : [];
    const before = bedsForecast([unit], releases, [{ ...stay, dischargeDateSetAt: shiftStart - 1 }], [], NOW_ANCHOR);
    expect(before.sources.notUpdatedThisShift).toBe(1);
    const changed = bedsForecast([unit], releases, [stay], [], NOW_ANCHOR);
    expect(changed.sources.notUpdatedThisShift).toBe(0);
  });
  it("moves the flagged release to a real discharge-date edit without restating release confirmation", () => {
    const seed = seedWardFlowState();
    const original = seed.admissions.find((admission) => admission.state === "occupied")!;
    const unit = seed.units.find((candidate) => candidate.id === original.unitId)!;
    const stay = { ...original, expectedDischargeAt: 13 * 60 };
    const flagged: BedRelease = {
      id: "WR-EDITED-PLAN",
      unitId: unit.id,
      admissionId: stay.id,
      state: "confirmed",
      expectedAt: 13 * 60,
      waitingOn: null,
      blocker: null,
      blockedBy: null,
      preparing: false,
      preparationNote: null,
      confirmedAt: 9 * 60 + 10,
      confirmedBy: "NUM Original Unit",
    };
    const changed = wardFlowReducer(
      { ...seed, admissions: [stay], bedReleases: [flagged] },
      {
        type: "UPDATE_EXPECTED_DISCHARGE",
        role: "ward",
        now: 10 * 60 + 30,
        actingUnitId: unit.id,
        admissionId: stay.id,
        expectedDischargeAt: 14 * 60,
      },
    );
    expect(changed.rejections).toEqual(seed.rejections);
    expect(changed.bedReleases[0]).toEqual({ ...flagged, expectedAt: 14 * 60 });
    expect(changed.admissions[0]).toMatchObject({
      expectedDischargeAt: 14 * 60,
      dischargeDateSetAt: 10 * 60 + 30,
      dischargeDateSetBy: "Nurse in charge",
    });
  });
});
