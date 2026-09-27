// tests/ward-bed-matching-recorded-sex.test.ts
import { describe, expect, it } from "vitest";

import {
  GENDER_PLACEMENT_REASONS,
  GENDER_PLACEMENT_REFUSAL,
} from "../src/components/ward-management/ward-change-reasons";
import {
  eligibility,
  referralEligibility,
  type EligibilityVerdict,
  type GateResult,
} from "../src/components/ward-management/ward-eligibility";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type {
  GenderPlacement,
  Movement,
  RecordedSex,
  Referral,
  ReferralGender,
  Unit,
  WardReferralDestination,
} from "../src/components/ward-management/ward-model";
import { referralState } from "../src/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Owner ruling R7, 25 September 2026 (`docs/ward-flow/decisions.md`): gender identity is Female,
 * Male, Non-binary, Different term or not recorded; recorded sex is Female, Male, Another term
 * (which covers intersex people) or Not recorded. If EITHER is anything other than female or male,
 * a coordinator must record a reviewed reason before allocation, on every ward. Beds still follow a
 * female or male gender identity; the ward's sex-mix count falls back to recorded sex, and a person
 * with neither in female or male counts in no bucket.
 *
 * Scenarios BM-29 to BM-31 of the coordinator's list v1, which the two-value model could not hold,
 * plus the review rule itself. Companion files: `ward-bed-matching-scenarios.test.ts` (verdicts)
 * and `ward-bed-matching-reducer.test.ts` (placements).
 */

const NOW = NOW_ANCHOR;
const FLAG = "coordinator to review";
const NO_COUNT = "no female or male count applies";

type Person = { label: string; sex: RecordedSex; gender?: ReferralGender };

const CW: Person = { label: "cis woman", sex: "Female", gender: "Female" };
const CM: Person = { label: "cis man", sex: "Male", gender: "Male" };
const NB_NOT_RECORDED: Person = { label: "non-binary, sex not recorded", sex: "Not recorded", gender: "Non-binary" };
const NB_ANOTHER: Person = { label: "non-binary, sex another term", sex: "Another term", gender: "Non-binary" };
const DIFFERENT_F: Person = {
  label: "gender a different term, recorded sex female",
  sex: "Female",
  gender: "Different term",
};
const WOMAN_ANOTHER: Person = { label: "woman, sex another term", sex: "Another term", gender: "Female" };
const UNRECORDED_F: Person = { label: "gender not recorded, recorded sex female", sex: "Female" };
const NEITHER: Person = { label: "gender not recorded, sex not recorded", sex: "Not recorded" };

function ward(name: string, free: number, sexMix: Unit["sexMix"], overrides: Partial<Unit> = {}): Unit {
  return {
    id: `u-${name.toLowerCase()}`,
    siteCode: "SCGH",
    name,
    cohort: "Adult",
    lockedBeds: 0,
    authorised: true,
    beds: 20,
    empty: { value: free, source: "feed", confirmedAt: NOW - 2, staleAfterMinutes: 15 },
    allocatable: { value: free, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 60 },
    allocatableLocked: 0,
    held: 0,
    blocked: 0,
    sexMix,
    speciallingCapacity: 1,
    highAcuityCapacity: 1,
    sexDesignation: "Undesignated",
    forensic: false,
    ...overrides,
  };
}

const MX_OPEN = ward("MX-OPEN", 5, { Female: 8, Male: 0 });
const MX_F = ward("MX-F", 1, { Female: 9, Male: 0 });
const MX_BAL = ward("MX-BAL", 1, { Female: 5, Male: 4 });
const FEM = ward("FEM", 3, { Female: 7, Male: 0 }, { sexDesignation: "Female only" });

function placementFor(unitId: string): GenderPlacement {
  return { at: NOW - 5, by: "coordinator", unitIds: [unitId], reason: GENDER_PLACEMENT_REASONS[0], wardChecked: true };
}

function movement(person: Person, genderPlacements?: GenderPlacement[], overrides: Partial<Movement> = {}): Movement {
  return {
    id: "WF-BM-RS",
    originEdId: "scgh-ed",
    openedAt: NOW - 300,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: person.sex,
    gender: person.gender,
    genderPlacements,
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

function destinationFor(person: Person): WardReferralDestination {
  return {
    kind: "psychiatric_ward",
    sex: person.sex,
    gender: person.gender,
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    highAcuityNursingNeeded: false,
  };
}

function referral(person: Person, genderPlacements?: GenderPlacement[]): Referral {
  return {
    id: "RF-BM-RS",
    ageBand: "Adult",
    destinations: [{ destination: destinationFor(person), state: "queued" }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    raisedAt: NOW - 30,
    urgency: 2,
    originSiteCode: "SCGH",
    transportNeeded: false,
    genderPlacements,
    ...FIXTURE_HISTORY,
  };
}

const PATHS = [
  {
    path: "movement path",
    verdict: (person: Person, unit: Unit, placements?: GenderPlacement[]) =>
      eligibility(movement(person, placements), unit, NOW),
  },
  {
    path: "referral path",
    verdict: (person: Person, unit: Unit, placements?: GenderPlacement[]) =>
      referralEligibility(referral(person, placements), destinationFor(person), unit, NOW),
  },
];

function gate(verdict: EligibilityVerdict, name: GateResult["gate"]): GateResult {
  const found = verdict.gates.find((candidate) => candidate.gate === name);
  if (!found) throw new Error(`verdict has no ${name} gate`);
  return found;
}

function failing(verdict: EligibilityVerdict) {
  return verdict.gates.filter((candidate) => !candidate.pass).map((candidate) => candidate.gate);
}

describe.each(PATHS)("recorded sex and gender identity beyond female and male, $path", ({ verdict }) => {
  describe("BM-29 and BM-30: non-binary with no female or male recorded sex counts in neither bucket", () => {
    it.each([NB_NOT_RECORDED, NB_ANOTHER])(
      "$label on MX-F, one free bed: refused on sex mix, never thrown",
      (person) => {
        const result = verdict(person, MX_F);
        expect(failing(result)).toEqual(["sex_mix"]);
        expect(gate(result, "sex_mix").detail).toContain(NO_COUNT);
        expect(gate(result, "sex_mix").detail).toContain(FLAG);
      },
    );

    it.each([NB_NOT_RECORDED, NB_ANOTHER])(
      "$label on MX-BAL: both counts present, still no bucket, so refused",
      (person) => {
        expect(failing(verdict(person, MX_BAL))).toEqual(["sex_mix"]);
      },
    );

    it.each([NB_NOT_RECORDED, NB_ANOTHER])("$label on MX-OPEN, five free beds: eligible, flagged", (person) => {
      const result = verdict(person, MX_OPEN);
      expect(result.eligible).toBe(true);
      expect(gate(result, "sex_mix").detail).toContain(NO_COUNT);
    });

    it("names the recorded sex it could not count", () => {
      expect(gate(verdict(NB_ANOTHER, MX_F), "sex_mix").detail).toContain("sex another term");
      expect(gate(verdict(NB_NOT_RECORDED, MX_F), "sex_mix").detail).toContain("sex not recorded");
    });
  });

  describe("BM-31: gender recorded as a different term", () => {
    it("with recorded sex female: the cis woman's result on MX-F, flagged", () => {
      const result = verdict(DIFFERENT_F, MX_F);
      expect(result.eligible).toBe(verdict(CW, MX_F).eligible);
      expect(gate(result, "sex_mix").detail).toContain(
        "gender recorded as a different term: checked against recorded sex, female",
      );
    });

    it("at a women-only ward: refused until a coordinator records a review for that ward, then eligible", () => {
      const without = verdict(DIFFERENT_F, FEM);
      expect(failing(without)).toEqual(["gender_designation"]);
      expect(gate(without, "gender_designation").detail).toBe(
        "Gender is not recorded as female or male, so FEM (female only) needs a coordinator's recorded review before it can be offered.",
      );
      expect(verdict(DIFFERENT_F, FEM, [placementFor(FEM.id)]).eligible).toBe(true);
    });
  });

  describe("a woman whose recorded sex is another term", () => {
    it("is counted and matched as a woman: the cis woman's result on MX-F and FEM, no sex-mix flag", () => {
      for (const unit of [MX_F, FEM]) {
        const result = verdict(WOMAN_ANOTHER, unit);
        expect(failing(result), unit.name).toEqual(failing(verdict(CW, unit)));
        expect(gate(result, "sex_mix").detail).not.toContain(FLAG);
      }
    });
  });

  describe("gender identity not recorded at a single-gender ward (R7 replaces 'record gender first')", () => {
    it("is refused until a coordinator records a review, then eligible", () => {
      expect(failing(verdict(UNRECORDED_F, FEM))).toEqual(["gender_designation"]);
      expect(gate(verdict(UNRECORDED_F, FEM), "gender_designation").detail).not.toContain("Record gender first");
      expect(verdict(UNRECORDED_F, FEM, [placementFor(FEM.id)]).eligible).toBe(true);
    });

    it("a cis man is still refused at a women-only ward, whatever review is recorded", () => {
      expect(failing(verdict(CM, FEM, [placementFor(FEM.id)]))).toEqual(["gender_designation"]);
    });
  });
});

// ---- Placement: the coordinator's recorded review, on every ward ----

/** A mixed ward with five free beds, so the sex-mix check never decides; only the review does. */
const R7_WARD_ID = "bm-rs-open";

function bench(movements: Movement[] = []): WardFlowState {
  const seeded = seedWardFlowState();
  return {
    ...seeded,
    units: [...seeded.units, { ...MX_OPEN, id: R7_WARD_ID, name: "Bed-matching R7 ward" }],
    movements: [...seeded.movements, ...movements],
    rejections: [],
  };
}

function received(person: Person): { state: WardFlowState; referralId: string } {
  const state = wardFlowReducer(bench(), {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    ageBand: "Adult",
    destinations: [destinationFor(person)],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "SCGH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
  expect(state.rejections, `receiving the ${person.label}'s referral`).toEqual([]);
  return { state, referralId: state.referrals.at(-1)!.id };
}

function accept(state: WardFlowState, referralId: string, withReview: boolean) {
  return wardFlowReducer(state, {
    type: "ACCEPT_REFERRAL",
    destinationKind: "psychiatric_ward",
    role: "coordinator",
    now: NOW,
    referralId,
    unitId: R7_WARD_ID,
    ...(withReview ? { genderPlacementReason: GENDER_PLACEMENT_REASONS[0], genderPlacementChecked: true } : {}),
  });
}

const NEEDS_REVIEW = [NB_NOT_RECORDED, NB_ANOTHER, DIFFERENT_F, WOMAN_ANOTHER, UNRECORDED_F, NEITHER];

describe("R7: referral acceptance on a mixed ward with beds to spare", () => {
  it("twin: a cis woman is accepted with no review", () => {
    const { state, referralId } = received(CW);
    expect(accept(state, referralId, false).rejections).toEqual([]);
  });

  it.each(NEEDS_REVIEW)("$label is refused without the coordinator's review, even here", (person) => {
    const { state, referralId } = received(person);
    const after = accept(state, referralId, false);
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toBe(GENDER_PLACEMENT_REFUSAL);
  });

  it.each(NEEDS_REVIEW)("$label is accepted once the review is recorded, and the record names this ward", (person) => {
    const { state, referralId } = received(person);
    const after = accept(state, referralId, true);
    expect(after.rejections).toEqual([]);
    const accepted = after.referrals.find((candidate) => candidate.id === referralId)!;
    expect(referralState(accepted)).toBe("accepted");
    expect(accepted.genderPlacements?.some((record) => record.unitIds.includes(R7_WARD_ID))).toBe(true);
  });

  it("the refusal wording is Josh's rule, for any gender or sex outside female and male", () => {
    expect(GENDER_PLACEMENT_REFUSAL).toBe(
      "This patient's gender or sex is not recorded as female or male. A coordinator must record a reason after checking with the ward before this placement.",
    );
  });
});

describe("R7: a held bed is re-checked when it is pulled", () => {
  function pulled(person: Person, reviewed: boolean) {
    const held = movement(person, reviewed ? [placementFor(R7_WARD_ID)] : undefined, {
      stage: "accepted_awaiting_bed",
      acceptedUnitId: R7_WARD_ID,
    });
    return wardFlowReducer(bench([held]), {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId: held.id,
      unitId: R7_WARD_ID,
    });
  }

  it("a woman whose sex is another term cannot be pulled without a review, and can with one", () => {
    expect(pulled(WOMAN_ANOTHER, false).rejections).toHaveLength(1);
    expect(pulled(WOMAN_ANOTHER, true).rejections).toEqual([]);
  });

  it("twin: a cis woman is pulled with no review", () => {
    expect(pulled(CW, false).rejections).toEqual([]);
  });
});

describe("R7: a person with no female or male count leaves the ward's counts untouched on arrival", () => {
  it.each([NB_NOT_RECORDED, NB_ANOTHER, NEITHER])("$label arriving changes neither count", (person) => {
    const arriving = movement(person, [placementFor(R7_WARD_ID)], {
      stage: "pulled",
      acceptedUnitId: R7_WARD_ID,
      transportNeed: { needed: false, at: NOW - 10 },
    });
    const after = wardFlowReducer(bench([arriving]), {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW,
      movementId: arriving.id,
      actingUnitId: R7_WARD_ID,
    });
    expect(after.rejections).toEqual([]);
    expect(after.units.find((candidate) => candidate.id === R7_WARD_ID)?.sexMix).toEqual(MX_OPEN.sexMix);
  });
});
