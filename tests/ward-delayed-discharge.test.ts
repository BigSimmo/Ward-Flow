import { describe, expect, it } from "vitest";

import {
  DELAYED_DISCHARGE_REASONS,
  DISCHARGE_BARRIERS,
  type Admission,
} from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import {
  clinicallyReadyOf,
  clinicallyReadyText,
  delayedBedDaysByReason,
} from "@/components/ward-management/ward-delayed-discharge";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";

const DAY = MINUTES_PER_DAY;

function stay(overrides: Partial<Admission>): Admission {
  const base = seedWardFlowState().admissions.find((admission) => admission.state === "occupied")!;
  return {
    ...base,
    id: "AD-TEST",
    unitId: "unit-a",
    state: "occupied",
    arrivedAt: -30 * DAY,
    leftAt: null,
    clinicallyReadySince: null,
    delayedDischargeReason: null,
    ...overrides,
  };
}

describe("delayed discharge reasons (Josh, 9 Nov 2026)", () => {
  it("is the long-stay list less Clinical / Treatment, in its order", () => {
    expect(DELAYED_DISCHARGE_REASONS).toEqual(DISCHARGE_BARRIERS.filter((entry) => entry !== "Clinical / Treatment"));
  });

  it("reads the board line", () => {
    const line = clinicallyReadyOf(
      { clinicallyReadySince: -5 * DAY, delayedDischargeReason: "Accommodation / Housing" },
      10 * 60,
    );
    expect(line).toEqual({ since: -5 * DAY, reason: "Accommodation / Housing", days: 5 });
    // Day zero 9 Nov 2026 at Perth midnight (UTC+8).
    const dayZero = new Date(Date.UTC(2026, 10, 8, 16));
    expect(clinicallyReadyText(line!, dayZero)).toBe("Ready since 4 Nov · Housing · 5 days");
    expect(clinicallyReadyText(line!, null)).toBe("Ready 5 days · Housing");
    expect(clinicallyReadyOf({ clinicallyReadySince: -DAY, delayedDischargeReason: null }, 0)).toBeNull();
  });
});

describe("delayedBedDaysByReason", () => {
  const week = { from: -7 * DAY, to: 0 };

  it("counts from the ready day to the end of the period, per ward and network", () => {
    const result = delayedBedDaysByReason(
      [
        stay({ id: "A", clinicallyReadySince: -3 * DAY, delayedDischargeReason: "NDIS" }),
        // Ready before the week began: only the week's seven days count.
        stay({ id: "B", unitId: "unit-b", clinicallyReadySince: -20 * DAY, delayedDischargeReason: "NDIS" }),
        // Left two days ago, so five days of the week.
        stay({
          id: "C",
          unitId: "unit-b",
          state: "departed",
          leftAt: -2 * DAY,
          clinicallyReadySince: -10 * DAY,
          delayedDischargeReason: "Accommodation / Housing",
        }),
        // Not recorded ready: nothing.
        stay({ id: "D" }),
        // Another network's ward: nothing.
        stay({ id: "E", unitId: "unit-z", clinicallyReadySince: -3 * DAY, delayedDischargeReason: "NDIS" }),
      ],
      ["unit-a", "unit-b"],
      week,
    );
    const ndis = result.network.rows.find((row) => row.reason === "NDIS")!;
    const housing = result.network.rows.find((row) => row.reason === "Accommodation / Housing")!;
    expect(ndis).toEqual({ reason: "NDIS", bedDays: 10, stays: 2 });
    expect(housing).toEqual({ reason: "Accommodation / Housing", bedDays: 5, stays: 1 });
    expect(result.network.bedDays).toBe(15);
    expect(result.network.stays).toBe(3);
    expect(result.network.rows.map((row) => row.reason)).toEqual([...DELAYED_DISCHARGE_REASONS]);
    expect(result.wards.map((ward) => [ward.unitId, ward.bedDays, ward.stays])).toEqual([
      ["unit-a", 3, 1],
      ["unit-b", 12, 2],
    ]);
  });

  it("counts nothing for a stay ready only after the period, or one left before it", () => {
    const result = delayedBedDaysByReason(
      [
        stay({ id: "late", clinicallyReadySince: DAY, delayedDischargeReason: "Several" }),
        stay({
          id: "gone",
          state: "departed",
          leftAt: -8 * DAY,
          clinicallyReadySince: -9 * DAY,
          delayedDischargeReason: "Several",
        }),
      ],
      ["unit-a"],
      week,
    );
    expect(result.network.bedDays).toBe(0);
    expect(result.network.stays).toBe(0);
  });
});

describe("SET_CLINICALLY_READY", () => {
  const base = seedWardFlowState();
  const now = 10 * 60;
  const admission = base.admissions.find((row) => row.state === "occupied" && !row.clinicallyReadySince)!;
  const raise = (ready: { since: number; reason: string } | null, role: "ward" | "ed" = "ward") =>
    wardFlowReducer(base, {
      type: "SET_CLINICALLY_READY",
      role,
      now,
      actingUnitId: admission.unitId,
      admissionId: admission.id,
      ready: ready as never,
    });
  const today = Math.floor(now / DAY) * DAY;

  it("records the day and reason, and clears both", () => {
    const set = raise({ since: today - DAY, reason: "SAT / Public Guardian" });
    expect(set.rejections).toHaveLength(base.rejections.length);
    const updated = set.admissions.find((row) => row.id === admission.id)!;
    expect(updated.clinicallyReadySince).toBe(today - DAY);
    expect(updated.delayedDischargeReason).toBe("SAT / Public Guardian");
    const cleared = wardFlowReducer(set, {
      type: "SET_CLINICALLY_READY",
      role: "ward",
      now,
      actingUnitId: admission.unitId,
      admissionId: admission.id,
      ready: null,
    });
    const after = cleared.admissions.find((row) => row.id === admission.id)!;
    expect(after.clinicallyReadySince).toBeNull();
    expect(after.delayedDischargeReason).toBeNull();
  });

  it("refuses Clinical / Treatment, a future day, a day before arrival and the wrong role", () => {
    for (const result of [
      raise({ since: today, reason: "Clinical / Treatment" }),
      raise({ since: today + DAY, reason: "NDIS" }),
      raise({ since: (admission.arrivedAt as number) - 2 * DAY, reason: "NDIS" }),
      raise({ since: today, reason: "NDIS" }, "ed"),
    ]) {
      expect(result.rejections.length).toBe(base.rejections.length + 1);
      expect(result.admissions.find((row) => row.id === admission.id)!.clinicallyReadySince ?? null).toBeNull();
    }
  });

  it("seeds a few ready-but-delayed stays across reasons", () => {
    const seeded = base.admissions.filter((row) => row.clinicallyReadySince != null);
    expect(seeded.length).toBeGreaterThanOrEqual(3);
    expect(new Set(seeded.map((row) => row.delayedDischargeReason)).size).toBeGreaterThanOrEqual(3);
  });
});
