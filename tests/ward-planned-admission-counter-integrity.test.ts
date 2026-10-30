import { describe, expect, it } from "vitest";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const fields = {
  role: "coordinator",
  now: NOW_ANCHOR,
  reason: "respite",
  unitId: "fre-adult-open",
  expectedArrivalAt: NOW_ANCHOR + 60,
  expectedStayDays: 7,
  legalStatus: "Voluntary",
  gender: "Female",
} as const;
const book: WardFlowEvent = {
  ...fields,
  type: "BOOK_PLANNED_ADMISSION",
  initials: "AB",
  sex: "Female",
  ageBand: "Adult",
};
const reloads = (state: ReturnType<typeof seedWardFlowState>) =>
  isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...state, rejections: [] })));
type Operation = "booking" | "edit" | "arrival";
function fixture(operation: Operation, counter: number) {
  const seed = seedWardFlowState();
  const booked = wardFlowReducer(seed, book);
  const id = booked.plannedAdmissions.at(-1)!.id;
  if (operation === "booking") return { state: { ...seed, plannedAdmissionSequence: counter }, event: book };
  if (operation === "edit")
    return {
      state: {
        ...booked,
        plannedAdmissions: booked.plannedAdmissions.map((row) =>
          row.id === id ? { ...row, changeCount: counter, changedAt: NOW_ANCHOR } : row,
        ),
      },
      event: {
        ...fields,
        type: "CHANGE_PLANNED_ADMISSION",
        plannedAdmissionId: id,
        expectedStayDays: 5,
      } as WardFlowEvent,
    };
  return {
    state: { ...booked, admissionSequence: counter },
    event: {
      type: "CONVERT_PLANNED_ADMISSION",
      role: "ward",
      now: NOW_ANCHOR + 5,
      unitId: fields.unitId,
      actingUnitId: fields.unitId,
      plannedAdmissionId: id,
    } as WardFlowEvent,
  };
}

describe.each(["booking", "edit", "arrival"] as const)("planned admission %s counter", (operation) => {
  it("refuses exhaustion without changing records, bookings or capacity", () => {
    const { state, event } = fixture(operation, Number.MAX_SAFE_INTEGER);
    expect(reloads(state)).toBe(true);
    const next = wardFlowReducer(state, event);
    expect(next.rejections).toHaveLength(state.rejections.length + 1);
    expect(next.units).toBe(state.units);
    expect(next.admissions).toBe(state.admissions);
    expect(next.plannedAdmissions).toBe(state.plannedAdmissions);
    expect(next.admissionSequence).toBe(state.admissionSequence);
    expect(next.plannedAdmissionSequence).toBe(state.plannedAdmissionSequence);
    expect(reloads(next)).toBe(true);
  });

  it("allows the final safe increment and preserves reloadability", () => {
    const { state, event } = fixture(operation, Number.MAX_SAFE_INTEGER - 1);
    expect(reloads(state)).toBe(true);
    const next = wardFlowReducer(state, event);
    expect(next.rejections).toHaveLength(state.rejections.length);
    const result =
      operation === "booking"
        ? next.plannedAdmissionSequence
        : operation === "arrival"
          ? next.admissionSequence
          : next.plannedAdmissions.at(-1)!.changeCount;
    expect(result).toBe(Number.MAX_SAFE_INTEGER);
    expect(reloads(next)).toBe(true);
  });
});
