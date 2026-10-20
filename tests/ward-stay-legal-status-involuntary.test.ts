import { describe, expect, it } from "vitest";
import { stayLegalStatusIsInvoluntary } from "@/components/ward-management/ward-discharge-records";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement } from "@/components/ward-management/ward-model";

function world(): { state: WardFlowState; admission: Admission; movement: Movement } {
  const state = seedWardFlowState();
  const movement = state.movements.find((m) => m.admissionId !== undefined && m.legalStatus !== undefined)!;
  const admission = state.admissions.find((a) => a.id === movement.admissionId)!;
  expect(movement).toBeDefined();
  expect(admission).toBeDefined();
  return { state, admission, movement };
}

function withMovementStatus(state: WardFlowState, id: string, legalStatus: Movement["legalStatus"]): WardFlowState {
  return { ...state, movements: state.movements.map((m) => (m.id === id ? { ...m, legalStatus } : m)) };
}

describe("stayLegalStatusIsInvoluntary", () => {
  it("reads the linked movement: anything but Voluntary is involuntary", () => {
    const { state, admission, movement } = world();
    expect(stayLegalStatusIsInvoluntary(withMovementStatus(state, movement.id, "Voluntary"), admission)).toBe(false);
    expect(
      stayLegalStatusIsInvoluntary(withMovementStatus(state, movement.id, "Involuntary inpatient"), admission),
    ).toBe(true);
  });

  it("falls back to the stay's retained booking status when no movement says anything", () => {
    const { state, admission } = world();
    const noMovement = { ...state, movements: [] };
    expect(stayLegalStatusIsInvoluntary(noMovement, { ...admission, plannedLegalStatus: undefined })).toBe(false);
    expect(
      stayLegalStatusIsInvoluntary(noMovement, { ...admission, plannedLegalStatus: "Involuntary inpatient" }),
    ).toBe(true);
    expect(stayLegalStatusIsInvoluntary(noMovement, { ...admission, plannedLegalStatus: "Voluntary" })).toBe(false);
  });

  it("falls back to an older save's arrived booking", () => {
    const { state, admission } = world();
    const booking = { ...state.plannedAdmissions[0]!, state: "arrived" as const, admissionId: admission.id };
    const older = {
      ...state,
      movements: [],
      plannedAdmissions: [{ ...booking, legalStatus: "Involuntary inpatient" as const }],
    };
    expect(stayLegalStatusIsInvoluntary(older, { ...admission, plannedLegalStatus: undefined })).toBe(true);
  });

  it("lets the movement's Voluntary decide over the booking, as before", () => {
    const { state, admission, movement } = world();
    const voluntary = withMovementStatus(state, movement.id, "Voluntary");
    expect(
      stayLegalStatusIsInvoluntary(
        voluntary,
        { ...admission, plannedLegalStatus: "Involuntary inpatient" },
        {
          ...movement,
          legalStatus: "Voluntary",
        },
      ),
    ).toBe(false);
  });

  it("uses the movement it is handed rather than looking one up", () => {
    const { state, admission, movement } = world();
    expect(
      stayLegalStatusIsInvoluntary(withMovementStatus(state, movement.id, "Voluntary"), admission, {
        ...movement,
        legalStatus: "Involuntary inpatient",
      }),
    ).toBe(true);
  });
});
