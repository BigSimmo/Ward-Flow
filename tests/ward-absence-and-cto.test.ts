import { describe, expect, it } from "vitest";
import { seedWardFlowStateAt, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { ABSENCE_STEPS } from "@/components/ward-management/ward-model";
import { shiftInstants } from "@/components/ward-management/ward-reanchor";

/**
 * D-38 (9 October 2026): absent without leave rides on the stay's held bed, and a community
 * treatment order is a field on the patient record. Both hold ids, fixed choices and times only.
 */
const NOW = 10 * 60 + 42;

function occupiedStay() {
  const state = seedWardFlowStateAt(0);
  const stay = state.admissions.find(
    (a) => a.state === "occupied" && !state.leaveBeds.some((bed) => bed.admissionId === a.id),
  )!;
  return { state, stay };
}

describe("absent without leave (D-38)", () => {
  it("holds the bed for a stay that was on the ward, without moving any other bed", () => {
    const { state, stay } = occupiedStay();
    const next = wardFlowReducer(state, {
      type: "RECORD_ABSENT_WITHOUT_LEAVE",
      role: "ward",
      now: NOW,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
    });
    const bed = next.leaveBeds.find((b) => b.admissionId === stay.id)!;
    expect(bed.absentWithoutLeave).toEqual({ since: NOW, steps: [] });
    expect(next.leaveBeds).toHaveLength(state.leaveBeds.length + 1);
    expect(next.admissions).toEqual(state.admissions);
  });

  it("turns an existing leave into an absence rather than adding a second held bed", () => {
    const { state, stay } = occupiedStay();
    const onLeave = wardFlowReducer(state, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW,
      unitId: stay.unitId,
      actingUnitId: stay.unitId,
      admissionId: stay.id,
      expectedReturn: NOW + 240,
    });
    const absent = wardFlowReducer(onLeave, {
      type: "RECORD_ABSENT_WITHOUT_LEAVE",
      role: "ward",
      now: NOW + 300,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
    });
    expect(absent.leaveBeds).toHaveLength(onLeave.leaveBeds.length);
    const bed = absent.leaveBeds.find((b) => b.admissionId === stay.id)!;
    expect(bed.expectedReturn).toBe(NOW + 240);
    expect(bed.absentWithoutLeave?.since).toBe(NOW + 300);
  });

  it("records each missing person step once, and refuses a step with no absence", () => {
    const { state, stay } = occupiedStay();
    const refused = wardFlowReducer(state, {
      type: "RECORD_ABSENCE_STEP",
      role: "ward",
      now: NOW,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
      step: "searched",
    });
    expect(refused.rejections[0]?.reason).toMatch(/not recorded absent without leave/);

    let next = wardFlowReducer(state, {
      type: "RECORD_ABSENT_WITHOUT_LEAVE",
      role: "ward",
      now: NOW,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
    });
    for (const [i, step] of ABSENCE_STEPS.entries()) {
      next = wardFlowReducer(next, {
        type: "RECORD_ABSENCE_STEP",
        role: "ward",
        now: NOW + i + 1,
        admissionId: stay.id,
        actingUnitId: stay.unitId,
        step,
      });
    }
    const steps = next.leaveBeds.find((b) => b.admissionId === stay.id)!.absentWithoutLeave!.steps;
    expect(steps.map((done) => done.step)).toEqual([...ABSENCE_STEPS]);
    expect(steps.map((done) => done.at)).toEqual([NOW + 1, NOW + 2, NOW + 3, NOW + 4, NOW + 5]);
    const again = wardFlowReducer(next, {
      type: "RECORD_ABSENCE_STEP",
      role: "ward",
      now: NOW + 20,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
      step: "searched",
    });
    expect(again.rejections[0]?.reason).toMatch(/already recorded/);
  });

  it("refuses a step timed before the absence began, and a saved one that is", () => {
    const { state, stay } = occupiedStay();
    const absent = wardFlowReducer(state, {
      type: "RECORD_ABSENT_WITHOUT_LEAVE",
      role: "ward",
      now: NOW,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
    });
    const early = wardFlowReducer(absent, {
      type: "RECORD_ABSENCE_STEP",
      role: "ward",
      now: NOW - 5,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
      step: "searched",
    });
    expect(early.rejections.at(-1)?.reason).toMatch(/before the absence began/);
    expect(early.leaveBeds).toEqual(absent.leaveBeds);
    const saved = {
      ...absent,
      leaveBeds: absent.leaveBeds.map((bed) =>
        bed.absentWithoutLeave
          ? { ...bed, absentWithoutLeave: { since: NOW, steps: [{ step: "searched", at: NOW - 5 }] } }
          : bed,
      ),
    };
    expect(isValidStoredWardFlowState(saved)).toBe(false);
  });

  it("refuses another ward, a stay that is not in a bed, and a second absence", () => {
    const { state, stay } = occupiedStay();
    const otherUnit = state.units.find((u) => u.id !== stay.unitId)!.id;
    const wrongWard = wardFlowReducer(state, {
      type: "RECORD_ABSENT_WITHOUT_LEAVE",
      role: "ward",
      now: NOW,
      admissionId: stay.id,
      actingUnitId: otherUnit,
    });
    expect(wrongWard.rejections[0]?.reason).toMatch(/acting as unit/);
    const notInBed = state.admissions.find((a) => a.state !== "occupied");
    if (notInBed) {
      const refused = wardFlowReducer(state, {
        type: "RECORD_ABSENT_WITHOUT_LEAVE",
        role: "ward",
        now: NOW,
        admissionId: notInBed.id,
        actingUnitId: notInBed.unitId,
      });
      expect(refused.rejections[0]?.reason).toMatch(/only somebody occupying a bed/);
    }
    const once = wardFlowReducer(state, {
      type: "RECORD_ABSENT_WITHOUT_LEAVE",
      role: "ward",
      now: NOW,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
    });
    const twice = wardFlowReducer(once, {
      type: "RECORD_ABSENT_WITHOUT_LEAVE",
      role: "ward",
      now: NOW + 5,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
    });
    expect(twice.rejections[0]?.reason).toMatch(/already recorded absent/);
  });

  it("ends on return through END_LEAVE_BED, and a saved absence reloads", () => {
    const { state, stay } = occupiedStay();
    let next = wardFlowReducer(state, {
      type: "RECORD_ABSENT_WITHOUT_LEAVE",
      role: "ward",
      now: NOW,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
    });
    next = wardFlowReducer(next, {
      type: "RECORD_ABSENCE_STEP",
      role: "ward",
      now: NOW + 3,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
      step: "police_notified",
    });
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(next)))).toBe(true);

    const bad = JSON.parse(JSON.stringify(next));
    const badBed = bad.leaveBeds.find((b: { admissionId: string }) => b.admissionId === stay.id);
    badBed.absentWithoutLeave.steps = [{ step: "typed_step", at: NOW }];
    expect(isValidStoredWardFlowState(bad)).toBe(false);

    const bed = next.leaveBeds.find((b) => b.admissionId === stay.id)!;
    const back = wardFlowReducer(next, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW + 30,
      leaveBedId: bed.id,
      actingUnitId: stay.unitId,
    });
    expect(back.leaveBeds.some((b) => b.admissionId === stay.id)).toBe(false);
  });
});

describe("re-anchoring the demo clock (D-38)", () => {
  it("moves an absence's start, its step times and a CTO's recorded time with every other time", () => {
    const { state, stay } = occupiedStay();
    let next = wardFlowReducer(state, {
      type: "RECORD_ABSENT_WITHOUT_LEAVE",
      role: "ward",
      now: NOW,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
    });
    next = wardFlowReducer(next, {
      type: "RECORD_ABSENCE_STEP",
      role: "ward",
      now: NOW + 5,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
      step: "searched",
    });
    next = wardFlowReducer(next, {
      type: "RECORD_COMMUNITY_TREATMENT_ORDER",
      role: "community",
      now: NOW,
      patientId: next.patients[0]!.id,
    });
    const shifted = shiftInstants(next, 60);
    const absence = shifted.leaveBeds.find((b) => b.admissionId === stay.id)!.absentWithoutLeave!;
    expect(absence.since).toBe(NOW + 60);
    expect(absence.steps[0]).toEqual({ step: "searched", at: NOW + 65 });
    expect(shifted.patients[0]!.communityTreatmentOrder!.recordedAt).toBe(NOW + 60);
  });
});

describe("community treatment order (D-38)", () => {
  it("records Form 5A with time and role only, refuses a second, and ends on request", () => {
    const state = seedWardFlowStateAt(0);
    const patient = state.patients.find((p) => !p.communityTreatmentOrder)!;
    const recorded = wardFlowReducer(state, {
      type: "RECORD_COMMUNITY_TREATMENT_ORDER",
      role: "community",
      now: NOW,
      patientId: patient.id,
    });
    const order = recorded.patients.find((p) => p.id === patient.id)!.communityTreatmentOrder!;
    expect(order.form).toBe("5A");
    expect(order.recordedAt).toBe(NOW);
    expect(Object.keys(order).sort()).toEqual(["form", "recordedAt", "recordedBy"]);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(recorded)))).toBe(true);

    const second = wardFlowReducer(recorded, {
      type: "RECORD_COMMUNITY_TREATMENT_ORDER",
      role: "community",
      now: NOW + 1,
      patientId: patient.id,
    });
    expect(second.rejections[0]?.reason).toMatch(/already has a community treatment order/);

    const ended = wardFlowReducer(recorded, {
      type: "END_COMMUNITY_TREATMENT_ORDER",
      role: "community",
      now: NOW + 2,
      patientId: patient.id,
    });
    expect(ended.patients.find((p) => p.id === patient.id)!.communityTreatmentOrder).toBeUndefined();
  });

  it("refuses a saved order with a lapse time or any field beyond form, time and role", () => {
    const state = seedWardFlowStateAt(0);
    const patient = state.patients[0]!;
    const recorded = wardFlowReducer(state, {
      type: "RECORD_COMMUNITY_TREATMENT_ORDER",
      role: "community",
      now: NOW,
      patientId: patient.id,
    });
    const bad = JSON.parse(JSON.stringify(recorded));
    bad.patients.find((p: { id: string }) => p.id === patient.id).communityTreatmentOrder.lapsesAt = NOW + 100;
    expect(isValidStoredWardFlowState(bad)).toBe(false);
  });

  it("is the community team's to record, not a ward's", () => {
    const state = seedWardFlowStateAt(0);
    const refused = wardFlowReducer(state, {
      type: "RECORD_COMMUNITY_TREATMENT_ORDER",
      role: "ward",
      now: NOW,
      patientId: state.patients[0]!.id,
    });
    expect(refused.patients[0]!.communityTreatmentOrder).toBeUndefined();
    expect(refused.rejections.length).toBeGreaterThan(state.rejections.length);
  });
});
