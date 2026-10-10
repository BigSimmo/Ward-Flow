import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Leave, absence without leave and a trip to ED are three different answers to where a ward patient
 * is now, so one stay holds at most one of them. The reducer refuses the second until the first ends.
 */
const seed = seedWardFlowState();
const stay = seed.admissions.find(
  (a) =>
    a.state === "occupied" &&
    a.awayAtEmergencyDepartmentSince === null &&
    !seed.leaveBeds.some((bed) => bed.admissionId === a.id),
)!;
const base = { role: "ward" as const, now: NOW_ANCHOR, actingUnitId: stay.unitId };

const goneToEd = wardFlowReducer(seed, {
  ...base,
  type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
  admissionId: stay.id,
});
const onLeave = wardFlowReducer(seed, {
  ...base,
  type: "RECORD_LEAVE_BED",
  unitId: stay.unitId,
  admissionId: stay.id,
  expectedReturn: NOW_ANCHOR + 120,
});

describe("leave, absence and ED exclude each other on one stay", () => {
  it("refuses leave while the stay is away at ED", () => {
    const next = wardFlowReducer(goneToEd, {
      ...base,
      type: "RECORD_LEAVE_BED",
      unitId: stay.unitId,
      admissionId: stay.id,
      expectedReturn: NOW_ANCHOR + 120,
    });
    expect(next.leaveBeds.some((bed) => bed.admissionId === stay.id)).toBe(false);
    expect(next.rejections.at(-1)?.reason).toMatch(/away at an emergency department/);
  });

  it("refuses absence without leave while the stay is away at ED", () => {
    const next = wardFlowReducer(goneToEd, { ...base, type: "RECORD_ABSENT_WITHOUT_LEAVE", admissionId: stay.id });
    expect(next.leaveBeds.some((bed) => bed.admissionId === stay.id)).toBe(false);
    expect(next.rejections.at(-1)?.reason).toMatch(/away at an emergency department/);
  });

  it("refuses ED while the stay is on leave or absent", () => {
    const fromLeave = wardFlowReducer(onLeave, {
      ...base,
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
      admissionId: stay.id,
    });
    expect(fromLeave.admissions.find((a) => a.id === stay.id)?.awayAtEmergencyDepartmentSince).toBeNull();
    expect(fromLeave.rejections.at(-1)?.reason).toMatch(/is on leave/);

    const absent = wardFlowReducer(onLeave, { ...base, type: "RECORD_ABSENT_WITHOUT_LEAVE", admissionId: stay.id });
    const fromAbsence = wardFlowReducer(absent, {
      ...base,
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
      admissionId: stay.id,
    });
    expect(fromAbsence.rejections.at(-1)?.reason).toMatch(/absent without leave/);
  });

  it("still lets an absence follow leave, as the If not back card does", () => {
    const absent = wardFlowReducer(onLeave, { ...base, type: "RECORD_ABSENT_WITHOUT_LEAVE", admissionId: stay.id });
    expect(absent.leaveBeds.find((bed) => bed.admissionId === stay.id)?.absentWithoutLeave?.since).toBe(NOW_ANCHOR);
  });
});
