import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isOnOrder, stayLegalStatus } from "@/components/ward-management/ward-stay-legal";

const copy = () => JSON.parse(JSON.stringify(seedWardFlowState())) as ReturnType<typeof seedWardFlowState>;

// Fresh audit S-1 (26 Oct 2026): a stay linked to its movement only by `movement.admissionId`, or
// converted from a booking, lost its legal status, so an absence on an order raised no task.
describe("stay legal status reads every link", () => {
  it("finds the movement linked only by movement.admissionId", () => {
    const state = copy();
    const movement = state.movements.find((row) => row.id === "WF-004")!;
    const admission = state.admissions.find((stay) => stay.id === "AD-BTYS-04")!;
    expect(movement.admissionId).toBe(admission.id);
    expect(admission.movementId).toBeNull();
    expect(movement.legalStatus).toBeDefined();
    expect(stayLegalStatus(admission, state)).toBe(movement.legalStatus);
  });

  it("reads a converted booking's legal status when no movement brought the stay", () => {
    const state = copy();
    const admission = {
      ...state.admissions.find((stay) => stay.state === "occupied")!,
      id: "AD-TEST-CONVERTED",
      movementId: null,
      patientId: null,
      plannedLegalStatus: "Involuntary inpatient" as const,
    };
    expect(isOnOrder(stayLegalStatus(admission, state))).toBe(true);
    const older = { ...admission, plannedLegalStatus: undefined };
    const bookings = [
      {
        ...state.plannedAdmissions[0]!,
        state: "arrived" as const,
        admissionId: admission.id,
        legalStatus: "Involuntary inpatient" as const,
      },
    ];
    expect(isOnOrder(stayLegalStatus(older, { ...state, plannedAdmissions: bookings }))).toBe(true);
    expect(stayLegalStatus(older, { ...state, plannedAdmissions: [] })).toBeUndefined();
  });
});
