import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR + 5;

function send(state: WardFlowState, event: WardFlowEvent) {
  const next = wardFlowReducer(state, event);
  expect(next.rejections, next.rejections.at(-1)?.reason).toEqual(state.rejections);
  return next;
}

describe("agreed return request withdrawal recovery", () => {
  it("closes the return after a ward request is added while preserving the source stay and its bed", () => {
    const seed = seedWardFlowState();
    const source = seed.admissions.find(
      (row) =>
        row.state === "occupied" &&
        row.patientId !== null &&
        !row.unitId.startsWith("rph-") &&
        wardFlowReducer(seed, {
          type: "RECORD_LEAVING",
          role: "ward",
          now: NOW,
          actingUnitId: row.unitId,
          admissionId: row.id,
          leavingDestination: "discharged-to-the-community",
        }).rejections.length === seed.rejections.length,
    )!;
    expect(source).toBeDefined();
    const agreed = send(seed, {
      type: "RECORD_REPATRIATION",
      role: "coordinator",
      now: NOW,
      admissionId: source.id,
      homeHospital: "RPH",
      receivingWardAgreed: true,
      mode: "road",
      provider: "Ambulance service",
      cadNumber: "SYN-CAD-RETURN-0042",
      transportLegalStatus: "voluntary",
      estimatedAt: NOW + 120,
    });
    const returning = agreed.movements.at(-1)!;
    expect(returning.sourceAdmissionId).toBe(source.id);
    expect(returning.referredUnitIds).toEqual([]);
    const target = agreed.units.find(
      (unit) => unit.id !== source.unitId && !unit.isClosed && eligibility(returning, unit, NOW).eligible,
    )!;
    expect(target).toBeDefined();
    const requested = send(agreed, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: returning.id,
      unitIds: [target.id],
    });
    expect(requested.movements.find((row) => row.id === returning.id)?.referredUnitIds).toContain(target.id);
    const withdrawn = send(requested, {
      type: "WITHDRAW_REFERRAL",
      role: "coordinator",
      now: NOW,
      movementId: returning.id,
    });
    const stopped = withdrawn.movements.find((row) => row.id === returning.id)!;
    expect(stopped.closure?.outcome).toBe("did_not_proceed");
    expect(stopped.referredUnitIds).toEqual([]);
    expect(withdrawn.admissions).toEqual(agreed.admissions);
    expect(withdrawn.units).toEqual(agreed.units);
    expect(withdrawn.repatriations).toEqual(agreed.repatriations);
  });
});
