import { describe, expect, it } from "vitest";

import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  ARRIVAL_LATE_AFTER_MINUTES,
  EXPECT_FLAG_INVOLUNTARY_MINUTES,
  EXPECT_FLAG_VOLUNTARY_MINUTES,
  LEAVE_BED_OPEN_WARNING_MINUTES,
} from "@/components/ward-management/ward-legal-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { applyRulingsDemoOverlay, rulingsDemoOverlay } from "@/components/ward-management/ward-rulings-demo";

describe("rulingsDemoOverlay", () => {
  const overlay = rulingsDemoOverlay(NOW_ANCHOR);

  it("returns the stable RD-01..RD-12 example ids", () => {
    expect(overlay.exampleIds).toEqual([
      "RD-01",
      "RD-02",
      "RD-03",
      "RD-04",
      "RD-05",
      "RD-06",
      "RD-07",
      "RD-08",
      "RD-09",
      "RD-10",
      "RD-11",
      "RD-12",
    ]);
  });

  it("builds one clear record for each example the types can hold", () => {
    const byId = Object.fromEntries(overlay.movements.map((row) => [row.id, row]));

    expect(byId["WF-RD01"]?.arrivalDetails).toBeUndefined();
    expect(byId["WF-RD02"]?.arrivalDetails?.estimatedArrivalAt).toBeGreaterThan(NOW_ANCHOR);
    expect(byId["WF-RD03"]?.stage).not.toBe("arrived");
    expect(byId["WF-RD03"]?.arrivalDetails?.estimatedArrivalAt).toBeLessThan(NOW_ANCHOR - ARRIVAL_LATE_AFTER_MINUTES);

    expect(overlay.admissions.some((row) => row.id === "AD-RD04" && row.state === "waitlisted")).toBe(true);
    expect(byId["WF-RD05"]?.waitlistedUnitIds).toEqual(["fsh-adult-secure"]);
    expect(byId["WF-RD05"]?.declines).toEqual([]);

    const wardToWard = overlay.referrals.find((row) => row.id === "RF-RD06");
    expect(wardToWard?.source).toBe("psychiatric_ward");
    expect(wardToWard?.originUnitId).toBe("gry-adult-secure");

    const leave = overlay.leaveBeds.find((row) => row.id === "WL-RD07");
    const medical = overlay.leaveBeds.find((row) => row.id === "WL-RD08");
    expect(leave?.kind).toBe("off_ward");
    expect(NOW_ANCHOR - (leave?.confirmedAt ?? 0)).toBeGreaterThan(LEAVE_BED_OPEN_WARNING_MINUTES);
    expect(medical?.kind).toBe("medical_trip");
    expect(NOW_ANCHOR - (medical?.confirmedAt ?? 0)).toBeGreaterThan(LEAVE_BED_OPEN_WARNING_MINUTES);

    const legalExamples = overlay.movements.filter((row) => row.legalForm !== undefined);
    expect(legalExamples.length).toBeGreaterThanOrEqual(10);
    expect(legalExamples.every((row) => row.legalClock === undefined && row.legalForm?.dueAt === undefined)).toBe(true);
    expect(byId["WF-RD10"]?.legalMismatch?.kind).toBe("voluntary_on_locked_ward");
    expect(byId["WF-RD11"]?.expectFlag?.kind).toBe("voluntary_48h");
    expect(NOW_ANCHOR - (byId["WF-RD11"]?.openedAt ?? 0)).toBeGreaterThan(EXPECT_FLAG_VOLUNTARY_MINUTES);
    expect(byId["WF-RD12"]?.expectFlag?.kind).toBe("involuntary_7d");
    expect(NOW_ANCHOR - (byId["WF-RD12"]?.openedAt ?? 0)).toBeGreaterThan(EXPECT_FLAG_INVOLUNTARY_MINUTES);
  });

  it("records skipped examples rather than inventing missing fields", () => {
    expect(overlay.skipped.map((row) => row.field)).toEqual(["writtenAt", "Movement.originUnitId"]);
  });

  it("seedWardFlowState includes RD-01 without dropping the existing night", () => {
    const seeded = seedWardFlowState();
    expect(seeded.movements.some((row) => row.id === "WF-RD01")).toBe(true);
    expect(seeded.movements.some((row) => row.id === "WF-001")).toBe(true);
    const rd01 = overlay.movements.find((row) => row.id === "WF-RD01");
    expect(rd01).toBeDefined();
    const merged = applyRulingsDemoOverlay(
      {
        movements: [rd01!],
        referrals: [],
        admissions: [],
        patients: [],
        leaveBeds: [],
      },
      NOW_ANCHOR,
    );
    expect(merged.movements.filter((row) => row.id === "WF-RD01")).toHaveLength(1);
  });
});
