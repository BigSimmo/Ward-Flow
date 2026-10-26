import { describe, expect, it } from "vitest";

import { bedIsOccupied } from "../src/components/ward-management/ward-admissions";
import { OVERRIDE_REASONS } from "../src/components/ward-management/ward-change-reasons";
import { bedMoveNeedsOpenBedReason } from "../src/components/ward-management/ward-bed-move-reason";
import {
  admissionLegalStatus,
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

// Audit CS3-12 (Josh, 26 Oct 2026, Part A 3): a bed move follows the admission step. A stay that
// needs a locked bed moves from a locked bed to an open one only with a recorded reason. Synthetic
// seed data only.
const UNIT = "fsh-adult-secure";

/** A mixed ward with one current stay in a locked bed, and free beds of both kinds. */
function bench(legalStatus?: string) {
  const state = seedWardFlowStateAt(0);
  const unit = state.units.find((row) => row.id === UNIT)!;
  const occupiedLocked = unit.lockedBeds - unit.allocatableLocked;
  const current = state.admissions.filter((row) => row.unitId === UNIT && bedIsOccupied(row));
  current.forEach((row, index) => {
    row.bedKind = index < occupiedLocked ? "locked" : "open";
    row.bedNumber = index < occupiedLocked ? index + 1 : unit.lockedBeds + 1 + index - occupiedLocked;
  });
  const stay = current.find((row) => row.bedKind === "locked" && row.state === "occupied")!;
  if (legalStatus !== undefined) {
    // Make the stay's status come from its patient record alone.
    stay.movementId = null;
    delete stay.plannedLegalStatus;
    const patient = state.patients.find((row) => row.id === stay.patientId)!;
    patient.legalStatus = legalStatus as typeof patient.legalStatus;
  }
  const openBed = Math.max(...current.map((row) => row.bedNumber!)) + 1;
  const lockedBed = occupiedLocked + 1;
  return { state, stay, openBed, lockedBed };
}

function move(state: WardFlowState, admissionId: string, bedNumber: number, overrideReason?: string) {
  return wardFlowReducer(state, {
    type: "PLACE_IN_BED",
    role: "ward",
    now: NOW_ANCHOR,
    admissionId,
    actingUnitId: UNIT,
    bedNumber,
    ...(overrideReason === undefined ? {} : { overrideReason }),
  } as WardFlowEvent);
}

describe("a bed move to an open bed (audit CS3-12)", () => {
  it("refuses a stay with no recorded Voluntary status, and changes nothing", () => {
    const { state, stay, openBed } = bench();
    expect(admissionLegalStatus(state, stay)).not.toBe("Voluntary");
    const after = move(state, stay.id, openBed);
    expect(after.rejections.at(-1)?.reason).toMatch(/is an open bed.*needs a recorded override reason/);
    expect(after.admissions).toEqual(state.admissions);
    expect(after.units).toEqual(state.units);
  });

  it("moves it with a recorded reason, and keeps the reason in the audit trail", () => {
    const { state, stay, openBed } = bench();
    const after = move(state, stay.id, openBed, OVERRIDE_REASONS[1]);
    expect(after.rejections).toEqual(state.rejections);
    expect(after.admissions.find((row) => row.id === stay.id)).toMatchObject({ bedNumber: openBed, bedKind: "open" });
    expect(after.auditEvents.at(-1)).toMatchObject({
      category: "bed-placement",
      details: { toBed: openBed, openBedReason: OVERRIDE_REASONS[1] },
    });
  });

  it("refuses a reason that is not on the list", () => {
    const { state, stay, openBed } = bench();
    expect(move(state, stay.id, openBed, "Because").rejections.length).toBe(state.rejections.length + 1);
  });

  it("needs no reason for a recorded Voluntary stay", () => {
    const { state, stay, openBed } = bench("Voluntary");
    const after = move(state, stay.id, openBed);
    expect(after.rejections).toEqual(state.rejections);
    expect(after.auditEvents.at(-1)?.details).not.toHaveProperty("openBedReason");
  });

  it("needs a reason for an Involuntary inpatient", () => {
    const { state, stay, openBed } = bench("Involuntary inpatient");
    expect(move(state, stay.id, openBed).rejections.length).toBe(state.rejections.length + 1);
  });

  it("needs no reason to move between locked beds", () => {
    const { state, stay, lockedBed } = bench();
    expect(move(state, stay.id, lockedBed).rejections).toEqual(state.rejections);
  });
});

describe("which bed moves need a reason (audit CS3-12)", () => {
  const base = { fromKind: "locked", toKind: "open", secureRequest: false } as const;
  it.each([
    [{ ...base, legalStatus: "Voluntary" }, false],
    [{ ...base, legalStatus: undefined }, true],
    [{ ...base, legalStatus: "Not recorded" }, true],
    [{ ...base, legalStatus: "Involuntary inpatient" }, true],
    [{ ...base, secureRequest: true, legalStatus: "Voluntary" }, true],
    [{ ...base, fromKind: "open", legalStatus: undefined }, false],
    [{ ...base, toKind: "locked", legalStatus: undefined }, false],
  ] as const)("%j needs a reason: %s", (moveFacts, expected) => {
    expect(bedMoveNeedsOpenBedReason(moveFacts)).toBe(expected);
  });
});
