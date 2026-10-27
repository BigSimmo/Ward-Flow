import { describe, expect, it } from "vitest";

import { commandScopeRefusal, type StateScopeOptions } from "../src/components/ward-management/ward-access-state";
import { type WardAccess } from "../src/components/ward-management/ward-role-access";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { observationAt } from "../src/components/ward-management/ward-observation";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { allEmergencyDepartments, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

describe("audit remaining authority and concurrency fixes (27 Oct 2026)", () => {
  it("refuses HANDOVER_READY for a receiving ward when another ward sent the transfer (Issue 7)", () => {
    const seed = seedWardFlowState();
    const places = wardPlaceLookup(seed.units);
    const options: StateScopeOptions = { now: NOW_ANCHOR, places };

    const sendingUnit = seed.units[0].id;
    const receivingUnit = seed.units[1].id;
    const movement = {
      ...seed.movements[0],
      id: "WF-TRANSFER-01" as const,
      stage: "pulled" as const,
      acceptedUnitId: receivingUnit,
      sourceAdmissionId: "adm-sending-source",
    };
    const sourceAdmission = {
      ...seed.admissions[0],
      id: "adm-sending-source",
      unitId: sendingUnit,
    };
    const state: WardFlowState = {
      ...seed,
      movements: [movement, ...seed.movements.filter((m) => m.id !== movement.id)],
      admissions: [sourceAdmission, ...seed.admissions.filter((a) => a.id !== sourceAdmission.id)],
    };

    const receivingAccess: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [receivingUnit] } };
    const sendingAccess: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [sendingUnit] } };

    expect(
      commandScopeRefusal(
        state,
        receivingAccess,
        { type: "HANDOVER_READY", role: "ward", movementId: movement.id },
        options,
      ),
    ).toMatch(/outside/);

    expect(
      commandScopeRefusal(
        state,
        sendingAccess,
        { type: "HANDOVER_READY", role: "ward", movementId: movement.id },
        options,
      ),
    ).toBeNull();
  });

  it("refuses RAISE_REFERRAL when role is ward and acceptedUnitId is omitted (Issue 10)", () => {
    const seed = seedWardFlowState();
    const ed = allEmergencyDepartments()[0];
    const wardUnit = seed.units[0].id;

    const event = {
      type: "RAISE_REFERRAL" as const,
      role: "ward" as const,
      actingUnitId: wardUnit,
      edId: ed.id,
      now: NOW_ANCHOR,
      draft: {
        cohort: "Adult" as const,
        sex: "Female" as const,
        security: "Open" as const,
        highAcuity: false,
        observation: observationAt("general"),
        legalFormCode: null,
        legalStatus: "Voluntary" as const,
        urgency: 1 as const,
      },
    };

    const after = wardFlowReducer(seed, event);
    expect(after.rejections.at(-1)?.reason).toBe(
      "A ward desk raises a placement only for an accepted direct continuation",
    );
  });

  it("refuses RECORD_OBSERVATION_LEVEL when linked movement and admission observations disagree even without expected token (Issue 6)", () => {
    const seed = seedWardFlowState();
    const movement = seed.movements.find((m) => m.admissionId && !m.closure)!;
    const admission = seed.admissions.find((a) => a.id === movement.admissionId)!;

    // Simulate divergent linked records where both sides point to each other
    const divergentState: WardFlowState = {
      ...seed,
      movements: seed.movements.map((m) =>
        m.id === movement.id
          ? {
              ...m,
              observation: observationAt("general"),
              observationChanges: [],
              admissionId: admission.id,
            }
          : m,
      ),
      admissions: seed.admissions.map((a) =>
        a.id === admission.id
          ? {
              ...a,
              observation: observationAt("within_sight"),
              observationChanges: [],
              movementId: movement.id,
              state: "occupied" as const,
            }
          : a,
      ),
    };

    const after = wardFlowReducer(divergentState, {
      type: "RECORD_OBSERVATION_LEVEL",
      role: "ed",
      now: NOW_ANCHOR + 10,
      target: { kind: "movement", movementId: movement.id },
      observation: observationAt("intermittent"),
    });

    expect(after.rejections.at(-1)?.reason).toBe("Observation changed. Reopen it.");
  });

  it("copies movement observationChanges onto the new admission during PULL_PATIENT (Issue 5)", () => {
    let state = seedWardFlowState();
    const unit = state.units.find((candidate) => candidate.allocatable.value > 0)!;
    const movementId = "WF-009";

    // Attach observation history to the movement
    state = {
      ...state,
      movements: state.movements.map((m) =>
        m.id === movementId
          ? {
              ...m,
              observation: observationAt("within_sight"),
              observationChanges: [
                { at: NOW_ANCHOR - 60, from: observationAt("general"), to: observationAt("within_sight") },
              ],
            }
          : m,
      ),
    };

    // Step 1: Refer
    state = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId,
      unitIds: [unit.id],
    });

    // Step 2: Accept
    state = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW_ANCHOR,
      movementId,
      unitId: unit.id,
    });

    // Step 3: Pull
    state = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW_ANCHOR,
      movementId,
      unitId: unit.id,
    });

    const pulledAdmission = state.admissions.find((a) => a.movementId === movementId);
    expect(pulledAdmission).toBeDefined();
    expect(pulledAdmission?.observationChanges).toHaveLength(1);
    expect(pulledAdmission?.observationChanges?.[0].to.level).toBe("within_sight");
  });
});
