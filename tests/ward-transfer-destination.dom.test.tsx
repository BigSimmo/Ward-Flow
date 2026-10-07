import { describe, expect, it } from "vitest";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import type { CareChange } from "@/components/ward-management/ward-care-journey";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("Phase 4: Clinical Invariant Hardening", () => {
  it("safely rejects unknown or unregistered event types without throwing (ADV-SEC-01)", () => {
    const state = seedWardFlowState();
    const maliciousEvent = {
      type: "UNKNOWN_MALICIOUS_ACTION",
      role: "ward",
      now: NOW_ANCHOR,
    } as unknown as WardFlowEvent;

    // Must not throw TypeError on permittedRoles.includes
    const result = wardFlowReducer(state, maliciousEvent);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.reason).toContain("Unknown or unpermitted event type: UNKNOWN_MALICIOUS_ACTION");
  });

  it("retains completed transfer history on the sending stay and starts a fresh receiving journey", () => {
    const state = seedWardFlowState();
    // Pick an occupied admission with a linked movement
    const admission = state.admissions.find((a) => a.state === "occupied" && a.patientId)!;
    expect(admission).toBeDefined();

    const baseMovement = state.movements.find(
      (m) => m.cohort === state.units.find((u) => u.id === admission.unitId)?.cohort,
    )!;
    expect(baseMovement).toBeDefined();
    baseMovement.admissionId = admission.id;
    baseMovement.patientId = admission.patientId!;
    baseMovement.stage = "arrived";
    baseMovement.acceptedUnitId = admission.unitId;
    admission.movementId = baseMovement.id;

    state.units = state.units.map((u) => ({
      ...u,
      allocatable: { ...u.allocatable, confirmedAt: NOW_ANCHOR },
      empty: { ...u.empty, confirmedAt: NOW_ANCHOR },
    }));

    const targetUnit = state.units.find(
      (u) => u.id !== admission.unitId && eligibility(baseMovement, u, NOW_ANCHOR).eligible && u.allocatableLocked > 0,
    )!;
    expect(targetUnit).toBeDefined();

    const command = (s: typeof state, admId: string, change: CareChange): WardFlowEvent => ({
      type: "RECORD_ADMISSION_CARE",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId: admId,
      patientId: s.admissions.find((a) => a.id === admId)!.patientId!,
      expectedGeneration: s.worldGeneration,
      expectedRevision: s.dischargeRevisions[admId] ?? 0,
      change,
    });

    // Step 1: accepted
    let next = wardFlowReducer(
      state,
      command(state, admission.id, { kind: "transfer", receivingUnitId: targetUnit.id, step: "accepted" }),
    );
    // Step 2: handover
    next = wardFlowReducer(
      next,
      command(next, admission.id, { kind: "transfer", receivingUnitId: targetUnit.id, step: "handover" }),
    );
    // Step 3: arrived
    next = wardFlowReducer(
      next,
      command(next, admission.id, { kind: "transfer", receivingUnitId: targetUnit.id, step: "arrived" }),
    );

    expect(next.rejections).toEqual([]);
    const receivingAdmission = next.admissions.find(
      (a) => a.patientId === admission.patientId && a.state === "occupied",
    );
    expect(receivingAdmission).toBeDefined();
    expect(receivingAdmission?.careJourney?.transfer).toBeUndefined();
    expect(next.admissions.find((a) => a.id === admission.id)?.careJourney?.transfer).toMatchObject({
      step: "arrived",
      receivingUnitId: targetUnit.id,
    });
    const onward = wardFlowReducer(
      next,
      command(next, receivingAdmission!.id, { kind: "transfer", step: "accepted", receivingUnitId: admission.unitId }),
    );
    expect(onward.rejections).toEqual([]);
  });
});
