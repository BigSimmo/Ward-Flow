// Top 25 item 8 (`top25-step-down-board`): step-down candidates are matched by the main
// `eligibility()` gates, including single sex designation (D-31), legal authorisation and cohort.

import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { eligibility } from "../src/components/ward-management/ward-eligibility";
import { boundedBedAvailability } from "../src/components/ward-management/ward-ready-beds";
import {
  deriveStepDownBoard,
  deriveStepDownSwapCandidates,
  freedStepDownUnit,
  stepDownSubject,
} from "../src/components/ward-management/ward-step-down";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

function board(mark: (admission: { id: string }) => boolean) {
  const state = seedWardFlowState();
  const admissions = state.admissions.map((admission) =>
    admission.state === "occupied" ? { ...admission, stepDownCandidate: mark(admission) } : admission,
  );
  return {
    state,
    rows: deriveStepDownBoard({
      admissions,
      units: state.units,
      movements: state.movements,
      patients: state.patients,
      referrals: state.referrals,
      now: NOW_ANCHOR,
    }),
  };
}

describe("step-down board uses the main matching engine (Top 25 item 8)", () => {
  it("lists only stays marked for step down", () => {
    const { rows } = board(() => false);
    expect(rows).toEqual([]);
  });

  it("offers only wards that pass every eligibility gate and have a Ready bed", () => {
    const { rows } = board(() => true);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      for (const ward of row.wards) {
        expect(ward.unit.id).not.toBe(row.fromUnit.id);
        expect(ward.verdict.eligible).toBe(true);
        expect(ward.verdict.gates.find((gate) => gate.gate === "gender_designation")?.pass).toBe(true);
        expect(boundedBedAvailability(ward.unit).available).toBeGreaterThan(0);
        expect(ward.unit.cohort).toBe(row.fromUnit.cohort);
      }
    }
  });

  it("never offers a male patient a female-only ward", () => {
    const { state } = board(() => true);
    const female = state.units.find((unit) => unit.sexDesignation === "Female only");
    const stay = state.admissions.find((admission) => admission.state === "occupied");
    const fromUnit = state.units.find((unit) => unit.id === stay?.unitId);
    if (!female || !stay || !fromUnit) return;
    const subject = stepDownSubject({ ...stay, sex: "Male", gender: "Male" }, fromUnit, "Voluntary");
    expect(eligibility(subject, female, NOW_ANCHOR).eligible).toBe(false);
  });

  it("treats an unrecorded legal status as needing an authorised ward", () => {
    const { state } = board(() => true);
    const stay = state.admissions.find((admission) => admission.state === "occupied");
    const fromUnit = state.units.find((unit) => unit.id === stay?.unitId);
    const unauthorised = state.units.find((unit) => !unit.authorised);
    if (!stay || !fromUnit || !unauthorised) return;
    const verdict = eligibility(stepDownSubject(stay, fromUnit, undefined), unauthorised, NOW_ANCHOR);
    expect(verdict.gates.find((gate) => gate.gate === "authorisation")?.pass).toBe(false);
  });
});

describe("inter-ward step-down swap pairing (Top 25 item 16, D-30)", () => {
  it("models one freed bed on fromUnit and matches only incoming movements that pass every eligibility gate", () => {
    const { state, rows } = board(() => true);
    const rowWithWard = rows.find((row) => row.wards.length > 0);
    expect(rowWithWard).toBeDefined();
    if (!rowWithWard) return;

    const fullUnit = {
      ...rowWithWard.fromUnit,
      allocatable: { ...rowWithWard.fromUnit.allocatable, value: 0 },
      empty: { ...rowWithWard.fromUnit.empty, value: 0 },
    };
    const freed = freedStepDownUnit(fullUnit);
    expect(freed.allocatable.value).toBe(1);
    expect(freed.empty.value).toBe(1);

    const candidates = deriveStepDownSwapCandidates({
      fromUnit: fullUnit,
      movements: state.movements,
      now: NOW_ANCHOR,
    });
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.incomingMovement.closure).toBeUndefined();
      expect(candidate.incomingMovement.sourceAdmissionId).toBeUndefined();
      expect(candidate.verdict.eligible).toBe(true);
      expect(candidate.verdict.gates.find((gate) => gate.gate === "gender_designation")?.pass).toBe(true);
      expect(candidate.verdict.gates.find((gate) => gate.gate === "cohort")?.pass).toBe(true);
    }
  });

  it("withholds swap candidates when no open receiving ward has a Ready bed now", () => {
    const state = seedWardFlowState();
    const zeroBedUnits = state.units.map((unit) => ({
      ...unit,
      allocatable: { ...unit.allocatable, value: 0 },
      empty: { ...unit.empty, value: 0 },
    }));
    const admissions = state.admissions.map((admission) =>
      admission.state === "occupied" ? { ...admission, stepDownCandidate: true } : admission,
    );
    const rows = deriveStepDownBoard({
      admissions,
      units: zeroBedUnits,
      movements: state.movements,
      patients: state.patients,
      referrals: state.referrals,
      now: NOW_ANCHOR,
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.wards).toEqual([]);
      expect(row.swapCandidates).toEqual([]);
    }
  });
});
