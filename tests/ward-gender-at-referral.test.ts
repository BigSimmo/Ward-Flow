// tests/ward-gender-at-referral.test.ts
import { describe, expect, it } from "vitest";

import { eligibility } from "../src/components/ward-management/ward-eligibility";
import {
  OVERRIDE_REASONS,
  GENDER_NO_LONGER_SUITS_REFUSAL,
} from "../src/components/ward-management/ward-change-reasons";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, Unit } from "../src/components/ward-management/ward-model";

/**
 * T10 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`, item 8, owner answer
 * 8, 17 September 2026): *"gender at referral decides the incoming bed check."* The
 * `gender_designation` gate (renamed from `sex_designation`, `ward-eligibility.ts`) now reads
 * the gender RECORDED AT REFERRAL (`Movement.gender` / `WardReferralDestination.gender`) —
 * never `sex`, never `Patient.gender` — and has no override path at all.
 *
 * Three properties, each pinned below and each a named refusal in the build plan's own failing
 * tests list:
 *
 *  1. A pair differing only in GENDER flips the verdict; a pair differing only in SEX does not.
 *     A mutant that reads `movement.sex` instead of `movement.gender` passes the second half of
 *     this and fails the first, so both halves must be exercised together.
 *  2. Unrecorded gender passes at an undesignated ward and is refused at a single-gender ward —
 *     EVEN WITH A VALID OVERRIDE REASON. A mutant that moves the gender check to AFTER
 *     `eligibilityRefusal`'s override early return passes every other test in this suite and
 *     fails only this one.
 *  3. `sex_mix` is untouched and still reads `sex` — stated, not hidden (build plan §1, item 8's
 *     target).
 */

const NOW = 10 * 60 + 42;

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "u-test",
    siteCode: "RPH",
    name: "Test Unit",
    cohort: "Adult",
    lockedBeds: 0,
    authorised: true,
    beds: 20,
    empty: { value: 3, source: "feed", confirmedAt: NOW - 2, staleAfterMinutes: 15 },
    allocatable: { value: 2, source: "ward", confirmedAt: NOW - 10, staleAfterMinutes: 120 },
    allocatableLocked: 0,
    held: 0,
    blocked: 0,
    sexMix: { Female: 10, Male: 8 },
    speciallingCapacity: 1,
    highAcuityCapacity: 1,
    sexDesignation: "Undesignated",
    forensic: false,
    ...overrides,
  };
}

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: "WF-001",
    originEdId: "ed-rph",
    openedAt: NOW - 300,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Flow coordinator",
    referredUnitIds: [],
    declines: [],
    blocker: "No blocker",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    ...overrides,
  };
}

describe("engine: gender decides the incoming bed check, never sex (property 1)", () => {
  it("a pair differing only in GENDER flips the verdict at a Male-only ward", () => {
    const maleOnly = unit({ sexDesignation: "Male only" });
    const genderFemale = eligibility(movement({ sex: "Male", gender: "Female" }), maleOnly, NOW);
    const genderMale = eligibility(movement({ sex: "Male", gender: "Male" }), maleOnly, NOW);

    expect(genderFemale.gates.find((g) => g.gate === "gender_designation")?.pass).toBe(false);
    expect(genderMale.gates.find((g) => g.gate === "gender_designation")?.pass).toBe(true);
  });

  it("a pair differing only in SEX does NOT flip the verdict — a mutant reading `sex` goes red here", () => {
    const maleOnly = unit({ sexDesignation: "Male only" });
    // Both movements carry gender: "Male" (so the gate must pass both) and disagree on `sex`
    // alone. A version of `genderDesignationResult` that reads `movement.sex` instead of
    // `movement.gender` refuses the first of these two and passes every OTHER assertion in this
    // file, including the one directly above.
    const sexFemale = eligibility(movement({ sex: "Female", gender: "Male" }), maleOnly, NOW);
    const sexMale = eligibility(movement({ sex: "Male", gender: "Male" }), maleOnly, NOW);

    expect(sexFemale.gates.find((g) => g.gate === "gender_designation")?.pass).toBe(true);
    expect(sexMale.gates.find((g) => g.gate === "gender_designation")?.pass).toBe(true);
  });
});

const UNIT_ID = "ger-adult-open"; // the network's one live Female-only ward
const PULL_NOW = 10 * 60 + 42;
const REASON = OVERRIDE_REASONS[0];

function widenedUnit(base: Unit): Unit {
  return {
    ...base,
    empty: { ...base.empty, value: 4, confirmedAt: PULL_NOW },
    allocatable: { ...base.allocatable, value: 4, confirmedAt: PULL_NOW },
  };
}

function stagedForPull(source: Movement, id: Movement["id"], overrides: Partial<Movement> = {}): Movement {
  return {
    ...source,
    id,
    highAcuity: false,
    specialling: false,
    stage: "accepted_awaiting_bed",
    acceptedUnitId: UNIT_ID,
    referredUnitIds: [],
    declines: [],
    closure: undefined,
    transport: undefined,
    pullExpiresAt: undefined,
    admissionId: undefined,
    overrides: [],
    ...overrides,
  };
}

function bench(): WardFlowState {
  const seeded = seedWardFlowState();
  const base = seeded.units.find((candidate) => candidate.id === UNIT_ID);
  if (!base) throw new Error(`the seed no longer contains unit ${UNIT_ID}`);
  if (base.sexDesignation !== "Female only") {
    throw new Error(`${UNIT_ID} is no longer the network's Female-only ward — this file must name a real one`);
  }
  const unitFixture = widenedUnit(base);
  const source = seeded.movements.find(
    (candidate) => candidate.cohort === unitFixture.cohort && candidate.security === "Open",
  );
  if (!source) {
    throw new Error(`the seed no longer holds an Open ${unitFixture.cohort} movement to rewrite`);
  }

  return {
    ...seeded,
    units: seeded.units.map((candidate) => (candidate.id === UNIT_ID ? unitFixture : candidate)),
    // Opus review round 2, 17 September 2026 (P2), item 5(d): "WF-GAR-UNDESIGNATED-BENCH" used to
    // sit here too, staged identically to "WF-GAR-UNRECORDED" immediately below, but no test in
    // this file ever looked it up — `movementIn`/`pull` are both called by id, and neither name
    // appears anywhere else in this file. Removed as unused rather than kept "in case".
    movements: [stagedForPull(source, "WF-GAR-UNRECORDED", { gender: undefined })],
    admissions: seeded.admissions.filter((admission) => admission.unitId !== UNIT_ID),
    bedReleases: seeded.bedReleases.filter((release) => release.unitId !== UNIT_ID),
    rejections: [],
  };
}

function movementIn(state: WardFlowState, id: string): Movement {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

function pull(
  state: WardFlowState,
  movementId: string,
  overrideReason?: (typeof OVERRIDE_REASONS)[number],
): WardFlowState {
  return wardFlowReducer(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now: PULL_NOW,
    movementId,
    unitId: UNIT_ID,
    overrideReason,
  });
}

describe("engine: unrecorded gender is refused at a single-gender ward with NO override path (property 2)", () => {
  it("passes at an Undesignated ward — the movement path's own gate agrees with the property test", () => {
    const undesignated = unit({ sexDesignation: "Undesignated" });
    const verdict = eligibility(movement({ gender: undefined }), undesignated, NOW);
    expect(verdict.gates.find((g) => g.gate === "gender_designation")?.pass).toBe(true);
  });

  it("is refused at the real Female-only ward EVEN WITH A VALID OVERRIDE REASON — the reducer-level property", () => {
    // ⚠️ THE DECISIVE ASSERTION, updated pin (P1-3, Ward Lead ruling, 17 September 2026). This was
    // "checks `gender_designation` BEFORE it reads `event.overrideReason`", pinned by matching
    // `eligibilityRefusal`'s own wording. `PULL_PATIENT` only ever reaches this movement's
    // `acceptedUnitId` AFTER an acceptance already exists (`ACCEPT_IN_PRINCIPLE` sets it), so
    // `heldUnitGenderRefusal` now runs FIRST and refuses before `eligibilityRefusal` — and,
    // structurally more strongly, `heldUnitGenderRefusal` takes no `overrideReason` parameter at
    // all, so there is no branch order left for a mutant to move. The property this test protects
    // ("a recorded reason must not buy past the gender gate") still holds; only the wording changed,
    // to the actionable sentence `heldUnitGenderRefusal`'s own doc comment explains.
    const withReason = pull(bench(), "WF-GAR-UNRECORDED", REASON);
    expect(withReason.rejections, "a recorded reason must not buy past the gender gate").toHaveLength(1);
    expect(withReason.rejections[0].reason).toBe(GENDER_NO_LONGER_SUITS_REFUSAL);
    expect(movementIn(withReason, "WF-GAR-UNRECORDED").stage).toBe("accepted_awaiting_bed");
    expect(movementIn(withReason, "WF-GAR-UNRECORDED").admissionId).toBeUndefined();
  });

  it("is refused at the real Female-only ward with NO reason at all, for the same underlying refusal", () => {
    const withoutReason = pull(bench(), "WF-GAR-UNRECORDED");
    expect(withoutReason.rejections).toHaveLength(1);
    // ⚠️ CHANGED PIN, P1-3 — see the comment on the test immediately above.
    expect(withoutReason.rejections[0].reason).toBe(GENDER_NO_LONGER_SUITS_REFUSAL);
  });
});

// 🔴 OWNER RULING 2026-09-25 (Josh) supersedes the T10 "sex_mix still reads sex" pin: the bay-mix
// count follows GENDER; a non-binary patient is checked against recorded sex and flagged for the
// coordinator.
describe("engine: sex_mix follows gender; non-binary falls back to recorded sex, flagged (owner ruling 2026-09-25)", () => {
  it("sex_mix still exists as its own gate, independent of gender_designation", () => {
    // A ward with occupants but only ONE free bed, undesignated so gender_designation trivially
    // passes — isolating sex_mix's own verdict from the designation gate's.
    const oneBedFree = unit({
      sexDesignation: "Undesignated",
      sexMix: { Female: 0, Male: 5 },
      allocatable: { value: 1, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 60 },
    });
    const verdict = eligibility(movement({ sex: "Female", gender: "Female" }), oneBedFree, NOW);
    const designation = verdict.gates.find((g) => g.gate === "gender_designation");
    const mix = verdict.gates.find((g) => g.gate === "sex_mix");
    expect(designation?.pass, "the designation gate must pass — Undesignated accepts any gender").toBe(true);
    expect(mix?.pass, "sex_mix must independently refuse: no same-sex occupants and only one free bed").toBe(false);
  });

  it("sex_mix reads `movement.gender`, not `movement.sex` — a Male-gender movement counts against Male occupants whatever its recorded sex", () => {
    const ward = unit({ sexDesignation: "Undesignated", sexMix: { Female: 4, Male: 2 } });
    const verdict = eligibility(movement({ sex: "Female", gender: "Male" }), ward, NOW);
    const mix = verdict.gates.find((g) => g.gate === "sex_mix");
    expect(mix?.detail).toContain("2 male occupants already");
    expect(mix?.detail).not.toContain("female");
    expect(mix?.detail).not.toContain("coordinator to review");
  });

  it("a non-binary movement is checked against its recorded sex and flagged for the coordinator", () => {
    const ward = unit({ sexDesignation: "Undesignated", sexMix: { Female: 3, Male: 0 } });
    const verdict = eligibility(movement({ sex: "Female", gender: "Non-binary" }), ward, NOW);
    const mix = verdict.gates.find((g) => g.gate === "sex_mix");
    expect(mix?.pass, "three female occupants satisfy the bay-mix check for a recorded-female patient").toBe(true);
    expect(mix?.detail).toContain("3 female occupants already");
    expect(mix?.detail).toContain("non-binary: checked against recorded sex, female; coordinator to review");
  });

  it("a movement with no gender identity recorded is checked against recorded sex and flagged", () => {
    const ward = unit({ sexDesignation: "Undesignated", sexMix: { Female: 0, Male: 2 } });
    const verdict = eligibility(movement({ sex: "Male", gender: undefined }), ward, NOW);
    const mix = verdict.gates.find((g) => g.gate === "sex_mix");
    expect(mix?.detail).toContain("2 male occupants already");
    expect(mix?.detail).toContain(
      "gender identity not recorded: checked against recorded sex, male; coordinator to review",
    );
  });

  it("a non-binary movement with no same-sex occupants still needs more than one free bed, and is flagged", () => {
    const oneBedFree = unit({
      sexDesignation: "Undesignated",
      sexMix: { Female: 0, Male: 5 },
      allocatable: { value: 1, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 60 },
    });
    const verdict = eligibility(movement({ sex: "Female", gender: "Non-binary" }), oneBedFree, NOW);
    const mix = verdict.gates.find((g) => g.gate === "sex_mix");
    expect(mix?.pass).toBe(false);
    expect(mix?.detail).toContain("coordinator to review");
  });
});
