// tests/ward-bed-matching-scenarios.test.ts
import { describe, expect, it } from "vitest";

import { GENDER_PLACEMENT_REASONS } from "../src/components/ward-management/ward-change-reasons";
import { eligibilityWarning } from "../src/components/ward-management/ward-derivations";
import {
  eligibility,
  referralEligibility,
  type EligibilityVerdict,
  type GateResult,
} from "../src/components/ward-management/ward-eligibility";
import { SUITABILITY_GATES } from "../src/components/ward-management/ward-flow-reducer";
import type {
  GenderPlacement,
  Movement,
  Referral,
  ReferralGender,
  Sex,
  Unit,
  WardReferralDestination,
} from "../src/components/ward-management/ward-model";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Bed-matching scenarios for the owner's ruling of 25 September 2026 (Josh): beds are allocated
 * by GENDER IDENTITY; a NON-BINARY patient is checked against their RECORDED SEX for the ward's
 * sex-mix check, and flagged "coordinator to review" in the gate's own detail.
 *
 * Scenario ids (BM-nn) are the coordinator's scenario list v1 of 25 September 2026. Every test
 * uses the TWIN METHOD from that list: first pin what a cisgender woman and man get on the ward,
 * then require a trans patient to get the result of the cisgender patient of their gender, and a
 * non-binary patient the result of the cisgender patient of their recorded sex, plus the flag.
 *
 * Every scenario runs on BOTH paths, `eligibility()` (movements) and `referralEligibility()`
 * (referrals), because the two are separate implementations kept in step by hand. The fixtures
 * hold `allocatable` equal to `empty`, so the two paths' different free-bed figures agree.
 *
 * Not here, because the model cannot hold them (checked 25 September 2026 against `ward-model.ts`):
 * pods and HDU beds (BM-22 to BM-27; `Unit` has no bed-level groups and no referral can ask for
 * one), a blank or third recorded sex (BM-29, BM-30; `Sex` is required and two-valued), and any
 * other gender term (BM-31; `ReferralGender` is three-valued). Runtime ward counts after arrivals
 * and discharges are in `ward-bed-matching-reducer.test.ts`.
 */

const NOW = 10 * 60 + 42;
const FLAG = "coordinator to review";

type Person = { label: string; sex: Sex; gender?: ReferralGender };

const CW: Person = { label: "cis woman", sex: "Female", gender: "Female" };
const CM: Person = { label: "cis man", sex: "Male", gender: "Male" };
const TW: Person = { label: "trans woman (recorded sex male)", sex: "Male", gender: "Female" };
const TM: Person = { label: "trans man (recorded sex female)", sex: "Female", gender: "Male" };
const NBF: Person = { label: "non-binary, recorded sex female", sex: "Female", gender: "Non-binary" };
const NBM: Person = { label: "non-binary, recorded sex male", sex: "Male", gender: "Non-binary" };
const NSF: Person = { label: "gender identity not recorded, recorded sex female", sex: "Female" };
const NSM: Person = { label: "gender identity not recorded, recorded sex male", sex: "Male" };
const BINARY = [CW, CM, TW, TM];

/** The cisgender patient whose result this person must get: gender identity for a binary gender,
 *  recorded sex for a non-binary patient or one with no gender identity recorded. */
function twinOf(person: Person): Person {
  const basis = person.gender === "Female" || person.gender === "Male" ? person.gender : person.sex;
  return basis === "Female" ? CW : CM;
}

function ward(name: string, free: number, sexMix: Unit["sexMix"], overrides: Partial<Unit> = {}): Unit {
  return {
    id: `u-${name.toLowerCase()}`,
    siteCode: "RPH",
    name,
    cohort: "Adult",
    lockedBeds: 0,
    authorised: true,
    beds: 20,
    empty: { value: free, source: "feed", confirmedAt: NOW - 2, staleAfterMinutes: 15 },
    allocatable: { value: free, source: "ward", confirmedAt: NOW - 10, staleAfterMinutes: 120 },
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
const MX_M = ward("MX-M", 1, { Female: 0, Male: 9 });
const MX_BAL = ward("MX-BAL", 1, { Female: 5, Male: 4 });
const MX_FULL = ward("MX-FULL", 0, { Female: 10, Male: 0 });
const FEM = ward("FEM", 3, { Female: 7, Male: 0 }, { sexDesignation: "Female only" });
const MALE = ward("MALE", 3, { Female: 0, Male: 7 }, { sexDesignation: "Male only" });
const MIXED_WARDS = [MX_OPEN, MX_F, MX_M, MX_BAL, MX_FULL];

/** A coordinator's recorded, ward-checked placement reason for one ward (owner reversal R2-2). */
function placementFor(unitId: string): GenderPlacement {
  return { at: NOW - 5, by: "coordinator", unitIds: [unitId], reason: GENDER_PLACEMENT_REASONS[0], wardChecked: true };
}

function movement(person: Person, genderPlacements?: GenderPlacement[]): Movement {
  return {
    id: "WF-BM",
    originEdId: "rph-ed",
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
  };
}

function referral(person: Person, genderPlacements?: GenderPlacement[]): [Referral, WardReferralDestination] {
  const destination: WardReferralDestination = {
    kind: "psychiatric_ward",
    sex: person.sex,
    gender: person.gender,
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    highAcuityNursingNeeded: false,
  };
  return [
    {
      id: "RF-BM",
      ageBand: "Adult",
      destinations: [{ destination, state: "queued" }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      raisedAt: NOW - 30,
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      genderPlacements,
      ...FIXTURE_HISTORY,
    },
    destination,
  ];
}

const PATHS = [
  {
    path: "movement path",
    verdict: (person: Person, unit: Unit, placements?: GenderPlacement[]) =>
      eligibility(movement(person, placements), unit, NOW),
  },
  {
    path: "referral path",
    verdict: (person: Person, unit: Unit, placements?: GenderPlacement[]) => {
      const [subject, destination] = referral(person, placements);
      return referralEligibility(subject, destination, unit, NOW);
    },
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

describe.each(PATHS)("bed matching by gender identity, $path", ({ verdict }) => {
  /** The twin's precondition, then the twin's result, then the flag. */
  function expectTwin(person: Person, unit: Unit) {
    const mine = verdict(person, unit);
    const twin = verdict(twinOf(person), unit);
    expect(mine.eligible, `${person.label} must get the ${twinOf(person).label}'s result on ${unit.name}`).toBe(
      twin.eligible,
    );
    expect(failing(mine)).toEqual(failing(twin));
    const flagged = gate(mine, "sex_mix").detail.includes(FLAG);
    expect(flagged, `flag on ${person.label} at ${unit.name}`).toBe(person.gender !== "Female" && person.gender !== "Male");
    return mine;
  }

  describe("ward fixtures: what the current sex-mix rule gives a cis woman and a cis man", () => {
    it.each([
      { unit: MX_OPEN, woman: true, man: true },
      { unit: MX_F, woman: true, man: false },
      { unit: MX_M, woman: false, man: true },
      { unit: MX_BAL, woman: true, man: true },
      { unit: MX_FULL, woman: true, man: false },
      { unit: FEM, woman: true, man: true },
      { unit: MALE, woman: true, man: true },
    ])("$unit.name: cis woman sex-mix $woman, cis man sex-mix $man", ({ unit, woman, man }) => {
      expect(gate(verdict(CW, unit), "sex_mix").pass).toBe(woman);
      expect(gate(verdict(CM, unit), "sex_mix").pass).toBe(man);
    });
  });

  describe("regression: a non-binary patient is no longer refused for matching nobody", () => {
    it("BM-08 MX-F, one free bed with women on it: non-binary recorded female is eligible, flagged", () => {
      const result = expectTwin(NBF, MX_F);
      expect(result.eligible).toBe(true);
      expect(gate(result, "sex_mix").detail).toContain("9 female occupants already");
    });

    it("BM-12 MX-BAL, one free bed, both sexes present: non-binary recorded female is eligible, flagged", () => {
      expect(expectTwin(NBF, MX_BAL).eligible).toBe(true);
    });

    it("BM-13 MX-FULL, no free bed: same failing gates as the cis woman, and no 'no same-sex occupants' reason", () => {
      // The referral path also fails `security` with no bed free; the twin comparison covers both.
      const result = expectTwin(NBF, MX_FULL);
      expect(failing(result)).toContain("allocatable_bed");
      expect(failing(result)).not.toContain("sex_mix");
      expect(gate(result, "sex_mix").detail).not.toContain("No same-sex occupants");
    });
  });

  describe("A. mixed ward, several free beds", () => {
    it("BM-01 MX-OPEN, cis woman: eligible, no flag", () => {
      expect(expectTwin(CW, MX_OPEN).eligible).toBe(true);
    });

    it("BM-02 MX-OPEN, trans woman: eligible, no flag", () => {
      expect(expectTwin(TW, MX_OPEN).eligible).toBe(true);
    });

    it("BM-03 MX-OPEN, non-binary recorded male: eligible, and flagged even with beds to spare", () => {
      expect(expectTwin(NBM, MX_OPEN).eligible).toBe(true);
    });
  });

  describe("B. mixed ward, one free bed", () => {
    it("BM-04 MX-F, cis woman: eligible", () => {
      expect(expectTwin(CW, MX_F).eligible).toBe(true);
    });

    it("BM-05 MX-F, cis man: refused on sex mix", () => {
      const result = expectTwin(CM, MX_F);
      expect(failing(result)).toEqual(["sex_mix"]);
    });

    it("BM-06 MX-F, trans woman: eligible, as the cis woman", () => {
      expect(expectTwin(TW, MX_F).eligible).toBe(true);
    });

    it("BM-07 MX-F, trans man: refused on sex mix, as the cis man", () => {
      expect(failing(expectTwin(TM, MX_F))).toEqual(["sex_mix"]);
    });

    it("BM-09 MX-F, non-binary recorded male: refused on sex mix, flagged", () => {
      expect(failing(expectTwin(NBM, MX_F))).toEqual(["sex_mix"]);
    });

    it("BM-10 MX-M, non-binary recorded male: eligible, flagged", () => {
      expect(expectTwin(NBM, MX_M).eligible).toBe(true);
    });

    it("BM-11 MX-M, non-binary recorded female: refused on sex mix, flagged", () => {
      expect(failing(expectTwin(NBF, MX_M))).toEqual(["sex_mix"]);
    });

    it("BM-36 non-binary recorded female newly referred to MX-M: refused on sex mix, flag on the new verdict", () => {
      const result = expectTwin(NBF, MX_M);
      expect(gate(result, "sex_mix").pass).toBe(false);
      expect(gate(result, "sex_mix").detail).toContain(FLAG);
    });
  });

  describe("C. mixed ward, no free bed", () => {
    it("BM-14 MX-FULL, trans man: the cis man's result, no flag", () => {
      const result = expectTwin(TM, MX_FULL);
      expect(failing(result)).toContain("sex_mix");
      expect(failing(result)).toContain("allocatable_bed");
    });
  });

  describe("D. single-gender wards", () => {
    it("BM-15 FEM, cis woman: eligible", () => {
      expect(expectTwin(CW, FEM).eligible).toBe(true);
    });

    it("BM-16 FEM, cis man: refused on the ward's designation", () => {
      expect(failing(expectTwin(CM, FEM))).toEqual(["gender_designation"]);
    });

    it("BM-17 FEM, trans woman: eligible, no designation mismatch", () => {
      const result = expectTwin(TW, FEM);
      expect(result.eligible).toBe(true);
      expect(gate(result, "gender_designation").pass).toBe(true);
    });

    it("BM-18 FEM, trans man: refused on the ward's designation", () => {
      expect(failing(expectTwin(TM, FEM))).toEqual(["gender_designation"]);
    });

    it("BM-19 MALE, trans man: eligible", () => {
      expect(expectTwin(TM, MALE).eligible).toBe(true);
    });

    // Owner reversal R2-2, 17 September 2026: a non-binary patient CAN be placed on a single-gender
    // ward once a coordinator records a reason and the ward check for that ward. The 25 September
    // ruling changed the sex-mix check only, so the designation still needs that record.
    it.each([NBF, NBM])(
      "BM-20/21 FEM, $label: refused on designation without a recorded placement, eligible with one, flagged either way",
      (person) => {
        const without = verdict(person, FEM);
        expect(failing(without)).toEqual(["gender_designation"]);
        expect(gate(without, "sex_mix").detail).toContain(FLAG);

        const withRecord = verdict(person, FEM, [placementFor(FEM.id)]);
        expect(withRecord.eligible).toBe(true);
        expect(gate(withRecord, "sex_mix").detail).toContain(FLAG);
      },
    );

    it("a recorded placement for ANOTHER ward does not open this one", () => {
      expect(failing(verdict(NBF, FEM, [placementFor("u-other")]))).toEqual(["gender_designation"]);
    });
  });

  // Josh, 25 September 2026 ("yes to all", point 4): no gender identity recorded is matched like a
  // non-binary patient, on recorded sex with the flag. Single-gender wards are left out: the older
  // "record gender first" rule there is an open question to him.
  describe("G. gender identity not recorded", () => {
    it("BM-28 MX-F, recorded female: eligible, flagged as not recorded", () => {
      const result = expectTwin(NSF, MX_F);
      expect(result.eligible).toBe(true);
      expect(gate(result, "sex_mix").detail).toContain("gender identity not recorded");
    });

    it("BM-28 MX-F, recorded male: refused on sex mix, flagged", () => {
      expect(failing(expectTwin(NSM, MX_F))).toEqual(["sex_mix"]);
    });
  });

  describe("H. the same patient after beds free up or fill", () => {
    it("BM-32 MX-F after a discharge leaves two free beds: non-binary recorded male becomes eligible, still flagged", () => {
      const afterDischarge = ward("MX-F", 2, { Female: 8, Male: 0 });
      expect(gate(verdict(CM, afterDischarge), "sex_mix").pass).toBe(true);
      expect(expectTwin(NBM, afterDischarge).eligible).toBe(true);
    });

    it("BM-33 MX-OPEN filled to one free bed by a woman's arrival: non-binary recorded male is refused, flagged", () => {
      const afterArrival = ward("MX-OPEN", 1, { Female: 9, Male: 0 });
      expect(gate(verdict(CM, afterArrival), "sex_mix").pass).toBe(false);
      expect(failing(expectTwin(NBM, afterArrival))).toEqual(["sex_mix"]);
    });
  });

  describe("I. the flag", () => {
    it("BM-38 never appears for a cis or trans patient on any ward", () => {
      for (const person of BINARY) {
        for (const unit of [...MIXED_WARDS, FEM, MALE]) {
          expect(gate(verdict(person, unit), "sex_mix").detail, `${person.label} at ${unit.name}`).not.toContain(FLAG);
        }
      }
    });

    it("BM-39 one non-binary patient against two wards: each ward judged alone, and the flag alone never blocks", () => {
      const toFemaleWard = verdict(NBF, MX_F);
      const toMaleWard = verdict(NBF, MX_M);
      expect(toFemaleWard.eligible).toBe(true);
      expect(gate(toFemaleWard, "sex_mix").detail).toContain(FLAG);
      expect(toMaleWard.eligible).toBe(false);
      expect(gate(toMaleWard, "sex_mix").detail).toContain(FLAG);
    });

    it("BM-39 recording a binary gender removes the flag at the next evaluation", () => {
      expect(gate(verdict(NBF, MX_F), "sex_mix").detail).toContain(FLAG);
      expect(gate(verdict({ ...NBF, gender: "Female" }, MX_F), "sex_mix").detail).not.toContain(FLAG);
    });

    it("names the recorded sex the check used", () => {
      expect(gate(verdict(NBF, MX_F), "sex_mix").detail).toContain("non-binary: checked against recorded sex, female");
      expect(gate(verdict(NBM, MX_F), "sex_mix").detail).toContain("non-binary: checked against recorded sex, male");
    });
  });

  describe("override rules", () => {
    it("a sex-mix refusal is overridable with a recorded reason; a designation refusal never is", () => {
      expect(SUITABILITY_GATES).toContain("sex_mix");
      expect(SUITABILITY_GATES).not.toContain("gender_designation");
    });
  });
});

describe("the flag inside the existing eligibility warning (movement screens)", () => {
  it("BM-37 a refused non-binary patient: the warning carries the flag, through the sex-mix reason", () => {
    const warning = eligibilityWarning(movement(NBM), MX_F, NOW);
    expect(warning?.failedGates.map((failed) => failed.gate)).toEqual(["sex_mix"]);
    expect(warning?.text).toContain(FLAG);
  });

  it("BM-37 a cis patient refused on the same ward: the warning carries no flag", () => {
    expect(eligibilityWarning(movement(CM), MX_F, NOW)?.text).not.toContain(FLAG);
  });
});
