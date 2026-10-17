// Top 25 item 8 (`top25-step-down-board`): step-down candidates are matched by the main
// `eligibility()` gates, including single sex designation (D-31), legal authorisation and cohort.

import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { eligibility } from "../src/components/ward-management/ward-eligibility";
import { lockedBedsFree } from "../src/components/ward-management/ward-bed-designation";
import type { Movement, Unit } from "../src/components/ward-management/ward-model";
import { boundedBedAvailability } from "../src/components/ward-management/ward-ready-beds";
import {
  deriveStepDownBoard,
  deriveStepDownSwapCandidates,
  stepDownSubject,
} from "../src/components/ward-management/ward-step-down";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { GENDER_PLACEMENT_REASONS } from "../src/components/ward-management/ward-change-reasons";

const GENDER_REASON = GENDER_PLACEMENT_REASONS[0];

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
  function withBeds(unit: Unit, allocatable: number, allocatableLocked = unit.allocatableLocked): Unit {
    return {
      ...unit,
      isClosed: false,
      allocatable: { ...unit.allocatable, value: allocatable },
      empty: { ...unit.empty, value: allocatable },
      allocatableLocked,
    };
  }

  function rowWithWard() {
    const { state, rows } = board(() => true);
    const row = rows.find((candidate) => candidate.wards.length > 0);
    expect(row).toBeDefined();
    return { state, row: row! };
  }

  it("matches only incoming movements that pass every eligibility gate on the live ward", () => {
    const { state, row } = rowWithWard();
    const unit = withBeds(row.fromUnit, 3);
    const { candidates } = deriveStepDownSwapCandidates({
      fromUnit: unit,
      movements: state.movements,
      now: NOW_ANCHOR,
    });
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.incomingMovement.closure).toBeUndefined();
      expect(candidate.incomingMovement.sourceAdmissionId).toBeUndefined();
      expect(candidate.verdict).toEqual(eligibility(candidate.incomingMovement, unit, NOW_ANCHOR));
      expect(candidate.verdict.eligible).toBe(true);
    }
  });

  // Owner ruling (17 Oct 2026, 10:13 PM AWST), item 3: the incoming leg is offered only once the bed
  // is actually free. No modelled freed bed, no combined swap.
  it("offers no incoming leg while the step-down ward is full, however well a movement would fit a freed bed", () => {
    const { state, row } = rowWithWard();
    const withBed = deriveStepDownSwapCandidates({
      fromUnit: withBeds(row.fromUnit, 1),
      movements: state.movements,
      now: NOW_ANCHOR,
    });
    expect(withBed.candidates.length + withBed.placementReview.length).toBeGreaterThan(0);
    const full = deriveStepDownSwapCandidates({
      fromUnit: withBeds(row.fromUnit, 0, 0),
      movements: state.movements,
      now: NOW_ANCHOR,
    });
    expect(full).toEqual({ candidates: [], placementReview: [] });
    // An allocatable slot with no physically empty bed is not a free bed either.
    const noEmptyBed = deriveStepDownSwapCandidates({
      fromUnit: { ...withBeds(row.fromUnit, 1), empty: { ...row.fromUnit.empty, value: 0 } },
      movements: state.movements,
      now: NOW_ANCHOR,
    });
    expect(noEmptyBed).toEqual({ candidates: [], placementReview: [] });
  });

  // Owner ruling (17 Oct 2026, 10:13 PM AWST), item 4: a movement needing a gender placement review
  // is never offered as a swap; it is listed for Placement instead.
  it("routes a movement needing a gender placement review to Placement instead of offering it", () => {
    const { state, row } = rowWithWard();
    const unit = withBeds(row.fromUnit, 3);
    const base = deriveStepDownSwapCandidates({ fromUnit: unit, movements: state.movements, now: NOW_ANCHOR });
    const sexVariants: Movement["sex"][] = ["Not recorded", "Another term"];
    let routed = 0;
    for (const { incomingMovement } of base.candidates) {
      for (const sex of sexVariants) {
        const needsReview: Movement = { ...incomingMovement, sex, genderPlacements: [] };
        const others = state.movements.filter((movement) => movement.id !== incomingMovement.id);
        const result = deriveStepDownSwapCandidates({
          fromUnit: unit,
          movements: [...others, needsReview],
          now: NOW_ANCHOR,
        });
        expect(result.candidates.map((candidate) => candidate.incomingMovement.id)).not.toContain(needsReview.id);
        if (eligibility(needsReview, unit, NOW_ANCHOR).eligible) {
          expect(result.placementReview.map((movement) => movement.id)).toContain(needsReview.id);
          routed += 1;
          // With the coordinator's placement for this ward recorded, it is an ordinary match again.
          const placed: Movement = {
            ...needsReview,
            genderPlacements: [
              { at: NOW_ANCHOR, by: "coordinator", unitIds: [unit.id], reason: GENDER_REASON, wardChecked: true },
            ],
          };
          const afterPlacement = deriveStepDownSwapCandidates({
            fromUnit: unit,
            movements: [...others, placed],
            now: NOW_ANCHOR,
          });
          expect(afterPlacement.placementReview.map((movement) => movement.id)).not.toContain(placed.id);
        }
      }
    }
    expect(routed, "the seed must exercise at least one gender-review match").toBeGreaterThan(0);
  });

  // Owner ruling (17 Oct 2026, 10:13 PM AWST), item 5: a Secure incoming patient is offered only if a
  // locked bed is actually free.
  it("offers a Secure incoming movement only when a locked bed is actually free", () => {
    const { state } = board(() => true);
    const lockedUnit = state.units.find((unit) => unit.lockedBeds > 0 && !unit.isClosed);
    expect(lockedUnit).toBeDefined();
    const noLockedFree = withBeds(lockedUnit!, 3, 0);
    const lockedFree = withBeds(lockedUnit!, 3, 1);
    expect(lockedBedsFree(noLockedFree)).toBe(0);
    expect(lockedBedsFree(lockedFree)).toBe(1);
    const secure = state.movements
      .filter((movement) => !movement.closure && movement.sourceAdmissionId === undefined)
      .map((movement): Movement => ({ ...movement, security: "Secure" }));
    const without = deriveStepDownSwapCandidates({ fromUnit: noLockedFree, movements: secure, now: NOW_ANCHOR });
    expect(without).toEqual({ candidates: [], placementReview: [] });
    const withLocked = deriveStepDownSwapCandidates({ fromUnit: lockedFree, movements: secure, now: NOW_ANCHOR });
    expect(withLocked.candidates.length + withLocked.placementReview.length).toBeGreaterThan(0);
    for (const candidate of withLocked.candidates) expect(candidate.incomingMovement.security).toBe("Secure");
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
