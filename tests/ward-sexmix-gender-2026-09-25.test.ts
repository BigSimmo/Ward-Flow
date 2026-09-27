import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import type { Movement } from "../src/components/ward-management/ward-model";

/**
 * Owner rulings 2026-09-10 and 2026-09-25: bed matching (and now the ward's own male/female
 * counts, `Unit.sexMix`) read GENDER, never sex. `PATIENT_ARRIVED` and departure (`RECORD_LEAVING`
 * / `RECORD_PATIENT_DISCHARGE`, via the shared `departAdmission`) must write `sexMix` keyed by the
 * gender recorded at referral (`Movement.gender`), falling back to `sex` only when no gender was
 * ever recorded, through the same `mixSexOf` rule `eligibility()` uses (`ward-eligibility.ts`).
 * A `Non-binary` person counts under their recorded sex (owner ruling 2026-09-25: "default to sex").
 * Adapted from the audit follow-up helper's ward/audit-followup-truth-a @ 4373744f8d, whose
 * non-binary case counted neither bucket before that ruling.
 */

const NOW = NOW_ANCHOR;

function seeded() {
  return seedWardFlowState();
}

function unit(state: WardFlowState, id: string) {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

function replaceMovement(state: WardFlowState, id: string, next: Movement): WardFlowState {
  return { ...state, movements: state.movements.map((m) => (m.id === id ? next : m)) };
}

describe("sexMix follows gender, never raw sex (owner ruling 2026-09-25)", () => {
  it("PATIENT_ARRIVED counts a Male-sex, Female-gender movement as female", () => {
    const state = seeded();
    const base = movement(state, "WF-004");
    // WF-004 is seeded `sex: "Male"`, pulled, accepted at `bty-adult-secure`, with no `gender`
    // recorded. Give it a gender opposite its sex, and mark transport not needed so
    // `PATIENT_ARRIVED` can fire straight from `pulled` (owner answer 10, second round,
    // 2026-09-17) without walking the whole transport chain.
    const withGender: Movement = {
      ...base,
      gender: "Female",
      transportNeed: { needed: false, at: NOW - 10 },
    };
    const before = replaceMovement(state, "WF-004", withGender);
    const beforeUnit = unit(before, "bty-adult-secure");

    const after = wardFlowReducer(before, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW,
      movementId: "WF-004",
      actingUnitId: "bty-adult-secure",
    });

    expect(after.rejections).toHaveLength(0);
    const afterUnit = unit(after, "bty-adult-secure");
    expect(afterUnit.sexMix.Female).toBe((beforeUnit.sexMix.Female ?? 0) + 1);
    // The sex bucket must NOT move just because `movement.sex` is "Male" — gender decides.
    expect(afterUnit.sexMix.Male).toBe(beforeUnit.sexMix.Male ?? 0);
  });

  it("PATIENT_ARRIVED counts a Non-binary gender under its recorded sex", () => {
    const state = seeded();
    const base = movement(state, "WF-004");
    const withGender: Movement = {
      ...base,
      gender: "Non-binary",
      transportNeed: { needed: false, at: NOW - 10 },
    };
    const before = replaceMovement(state, "WF-004", withGender);
    const beforeUnit = unit(before, "bty-adult-secure");

    const after = wardFlowReducer(before, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW,
      movementId: "WF-004",
      actingUnitId: "bty-adult-secure",
    });

    expect(after.rejections).toHaveLength(0);
    const afterUnit = unit(after, "bty-adult-secure");
    // WF-004 is recorded `sex: "Male"`.
    expect(afterUnit.sexMix.Female).toBe(beforeUnit.sexMix.Female ?? 0);
    expect(afterUnit.sexMix.Male).toBe((beforeUnit.sexMix.Male ?? 0) + 1);
  });

  it("RECORD_LEAVING (departAdmission) decrements the gender bucket, not the sex bucket", () => {
    const state = seeded();
    // AD-SCGA-07 (`sex: "Male"`) is a plain occupied admission with no linked movement in the
    // seed — attach one here with a differing gender, exactly the trans-placement shape T10
    // exists for.
    const occupant = state.admissions.find((a) => a.id === "AD-SCGA-07" && a.state === "occupied");
    if (!occupant) throw new Error("fixture precondition: AD-SCGA-07 must be a seeded occupied admission");
    const template = movement(state, "WF-004");
    const linked: Movement = {
      ...template,
      id: "WF-TEST-DEPART-GENDER",
      admissionId: occupant.id,
      sex: "Male",
      gender: "Female",
      transportNeed: { needed: false, at: NOW - 10 },
    };
    // R7 split (2026-09-25): seeded admissions now carry their own gender copy, which wins. Clear it
    // on this one so the case still proves the fallback to the admitting movement's gender.
    const before = {
      ...state,
      movements: [...state.movements, linked],
      admissions: state.admissions.map((a) => (a.id === occupant.id ? { ...a, gender: undefined } : a)),
    };
    const beforeUnit = unit(before, occupant.unitId);

    const after = wardFlowReducer(before, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW,
      admissionId: occupant.id,
      actingUnitId: occupant.unitId,
      leavingDestination: "discharged-to-the-community",
    });

    expect(after.rejections).toHaveLength(0);
    const afterUnit = unit(after, occupant.unitId);
    expect(afterUnit.sexMix.Female).toBe((beforeUnit.sexMix.Female ?? 0) - 1);
    // The Male bucket must be untouched — `admission.sex` says Male, but gender says Female.
    expect(afterUnit.sexMix.Male).toBe(beforeUnit.sexMix.Male ?? 0);
  });

  it("RECORD_LEAVING falls back to sex when no movement is linked and no gender is recorded", () => {
    const state = seeded();
    const occupant = state.admissions.find((a) => a.state === "occupied" && a.sex === "Female");
    if (!occupant) throw new Error("fixture precondition: needs a seeded occupied Female admission");
    // No movement links to this admission by id in the seed, so `departAdmission`
    // must fall back to `admission.sex` rather than refusing or inventing a gender.
    const beforeUnit = unit(state, occupant.unitId);

    const after = wardFlowReducer(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW,
      admissionId: occupant.id,
      actingUnitId: occupant.unitId,
      leavingDestination: "discharged-to-the-community",
    });

    expect(after.rejections).toHaveLength(0);
    const afterUnit = unit(after, occupant.unitId);
    expect(afterUnit.sexMix.Female).toBe((beforeUnit.sexMix.Female ?? 0) - 1);
  });
});
