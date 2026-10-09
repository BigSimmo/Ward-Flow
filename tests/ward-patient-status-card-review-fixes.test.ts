import { describe, expect, it } from "vitest";
import {
  buildPatientStatus,
  type PatientStatusContext,
} from "@/components/ward-management/patients/patient-status-card";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * PR #147 review fixes on the gate board status card. Each case is one the first build got wrong:
 * declined wards counted twice, a refused forward step shown as ready, and a closed movement's
 * form shown as the legal status in force.
 */
const seed = seedWardFlowState();
const base = seed.movements[0];
const noop = () => {};

function ctx(movement: Movement, extra: Partial<PatientStatusContext> = {}): PatientStatusContext {
  return {
    movement,
    hasBedHold: true,
    now: NOW_ANCHOR,
    dayZero: new Date(0),
    onOpenPlacement: noop,
    onClearance: noop,
    onBookTransport: noop,
    onArrivalTime: noop,
    onRecordReturn: noop,
    onMarkAbsent: noop,
    onAbsenceStep: noop,
    onRecordCto: noop,
    onEndCto: noop,
    ...extra,
  };
}

function bedCell(movement: Movement) {
  return buildPatientStatus("find", ctx(movement)).cells.find((cell) => cell.key === "bed")!;
}

describe("gate board status card review fixes", () => {
  it("counts live requests only once: one ward left after a decline is still awaiting an answer", () => {
    const movement: Movement = {
      ...base,
      referredUnitIds: ["unit-b"],
      declines: [{ ...base.declines[0], unitId: "unit-a", at: NOW_ANCHOR - 10 } as Movement["declines"][number]],
    };
    expect(bedCell(movement).value).toBe("1 awaiting answer");
    expect(bedCell(movement).sub).toBe("1 declined");
  });

  it("says none found only when no request is live and a ward has declined", () => {
    const declined: Movement = {
      ...base,
      referredUnitIds: [],
      declines: [{ ...base.declines[0], unitId: "unit-a", at: NOW_ANCHOR - 10 } as Movement["declines"][number]],
    };
    expect(bedCell(declined).value).toBe("None found");
    expect(bedCell({ ...base, referredUnitIds: [], declines: [] }).value).toBe("No ward asked");
  });

  it("shows Cannot move with the engine's reason when the next forward step would be refused", () => {
    const movement: Movement = {
      ...base,
      medicalClearance: { cleared: true, at: NOW_ANCHOR - 5 } as Movement["medicalClearance"],
      transportNeed: { needed: false } as Movement["transportNeed"],
    };
    const ready = buildPatientStatus("held", ctx(movement));
    const refused = buildPatientStatus("held", ctx(movement, { handoverRefusal: "This ward no longer suits." }));
    expect(refused.verdict).toBe("Cannot move");
    expect(refused.meta).toBe("This ward no longer suits.");
    expect(refused.tone).toBe("danger");
    expect(ready.verdict).not.toBe("Cannot move");
  });

  it("reads the patient's legal status, not a closed movement's form, while on leave", () => {
    const closed: Movement = {
      ...base,
      legalStatus: "Involuntary inpatient",
      legalForm: { code: "1A" } as Movement["legalForm"],
      closure: { at: NOW_ANCHOR - 60 } as Movement["closure"],
    };
    const status = buildPatientStatus(
      "leave",
      ctx(closed, {
        patient: { legalStatus: "Voluntary patient" } as PatientStatusContext["patient"],
        leaveBed: { expectedReturn: NOW_ANCHOR + 60 } as PatientStatusContext["leaveBed"],
      }),
    );
    expect(status.cells.find((cell) => cell.key === "legal")?.value).toBe("Voluntary patient");
  });
});
