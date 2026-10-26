import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { commandScopeRefusal } from "../src/components/ward-management/ward-access-state";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowRole } from "../src/components/ward-management/ward-flow-events";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { admittedFormLine, admittedOnAForm } from "../src/components/ward-management/legal-forms/legal-forms-admitted";

/**
 * Walk-through WT-03 (26 Oct 2026): a person who arrived on a Form 1A still showed Form 1A on the
 * ward, and nobody could record the inpatient order because arrival closed the journey. Josh's
 * yes (26 Oct): the ward records the next form for a person admitted to its own bed, and they stay
 * on Legal forms. Only the time typed from the paper is recorded; nothing is computed.
 */
const NOW = NOW_ANCHOR;

/** A synthetic person who arrived on a Form 1A and is in an occupied bed. */
function arrivedOnA1A(): { state: WardFlowState; movementId: string; unitId: string; admissionId: string } {
  const seed = seedWardFlowState();
  const stay = seed.admissions.find((admission) => admission.state === "occupied" && admission.patientId !== null)!;
  const journey = seed.movements.find((movement) => !movement.closure)!;
  const arrived = {
    ...journey,
    stage: "arrived" as const,
    acceptedUnitId: stay.unitId,
    admissionId: stay.id,
    patientId: stay.patientId ?? undefined,
    legalStatus: "Involuntary inpatient" as const,
    legalForm: { code: "1A", kind: "examination" as const },
    closure: { at: NOW - 60, outcome: "arrived" as const, reason: "Patient arrived at the accepting unit" },
  };
  return {
    state: { ...seed, movements: seed.movements.map((movement) => (movement.id === journey.id ? arrived : movement)) },
    movementId: journey.id,
    unitId: stay.unitId,
    admissionId: stay.id,
  };
}

function record(state: WardFlowState, role: WardFlowRole, movementId: string) {
  return wardFlowReducer(state, {
    type: "RECORD_LEGAL_FORM_WRITTEN",
    role,
    now: NOW,
    movementId,
    formCode: "6A",
    writtenAt: NOW - 30,
  });
}

describe("the ward records the next form for a person admitted on a form (WT-03)", () => {
  it("shows the admitted person on Legal forms with the form still to record", () => {
    const { state, movementId } = arrivedOnA1A();
    const rows = admittedOnAForm(state.movements, state.admissions);
    expect(rows.map((movement) => movement.id)).toContain(movementId);
    const row = rows.find((movement) => movement.id === movementId)!;
    expect(admittedFormLine(row)).toBe("Form 6A not recorded (Form 1A ended at arrival)");
  });

  it("lets the ward record Form 6A with the time written on it, and computes no expiry", () => {
    const { state, movementId } = arrivedOnA1A();
    const next = record(state, "ward", movementId);
    expect(next.rejections).toHaveLength(state.rejections.length);
    const updated = next.movements.find((movement) => movement.id === movementId)!;
    expect(updated.legalForm?.code).toBe("6A");
    expect(updated.formedAt).toBe(NOW - 30);
    expect(updated.legalForm?.dueAt).toBeUndefined();
    expect(admittedFormLine(updated)).toBe("Form 6A recorded");
  });

  it("lets the coordinator record for the ward", () => {
    const { state, movementId } = arrivedOnA1A();
    expect(record(state, "coordinator", movementId).rejections).toHaveLength(state.rejections.length);
  });

  it("refuses ED once the person has arrived", () => {
    const { state, movementId } = arrivedOnA1A();
    const next = record(state, "ed", movementId);
    expect(next.rejections).toHaveLength(state.rejections.length + 1);
    expect(next.rejections.at(-1)?.reason).toMatch(/closed movement/);
  });

  it("refuses the ward once the person has left the bed", () => {
    const { state, movementId, admissionId } = arrivedOnA1A();
    const left = {
      ...state,
      admissions: state.admissions.map((admission) =>
        admission.id === admissionId ? { ...admission, state: "departed" as const, leftAt: NOW - 10 } : admission,
      ),
    };
    const next = record(left, "ward", movementId);
    expect(next.rejections).toHaveLength(left.rejections.length + 1);
    expect(next.rejections.at(-1)?.reason).toBe(
      "A ward records a written form only for a person admitted to its own bed.",
    );
    expect(admittedOnAForm(left.movements, left.admissions).map((movement) => movement.id)).not.toContain(movementId);
  });

  it("refuses a ward recording for another ward's patient", () => {
    const { state, movementId, unitId } = arrivedOnA1A();
    const places = wardPlaceLookup(state.units);
    const options = { now: NOW, places };
    const command = {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "ward",
      movementId,
      formCode: "6A",
      writtenAt: NOW - 30,
    };
    const own: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [unitId] } };
    const otherUnit = state.units.find((unit) => unit.id !== unitId)!.id;
    const other: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [otherUnit] } };
    expect(commandScopeRefusal(state, own, command, options)).toBeNull();
    expect(commandScopeRefusal(state, other, command, options)).toMatch(/outside your role's place/);
  });
});
