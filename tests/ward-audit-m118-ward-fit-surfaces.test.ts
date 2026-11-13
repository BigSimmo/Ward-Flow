import { describe, expect, it } from "vitest";

import {
  CLOSER_BED_NOTE,
  HOME_REGION_BEDS_NOTE,
  closerBedOptions,
} from "../src/components/ward-management/out-of-area/out-of-area-model";
import { wardAdmissions } from "../src/components/ward-management/ward-admissions-seed";
import { outOfAreaLedger } from "../src/components/ward-management/ward-referrals";
import { referralAgeBand } from "../src/components/ward-management/referrals/referral-age-band";
import {
  BED_FINDER_NOTE,
  findBeds,
  type BedFinderFilters,
} from "../src/components/ward-management/tools/ward-bed-finder";
import { eligibleCandidatesAmong } from "../src/components/ward-management/ward-derivations-shortlist";
import {
  eligibility,
  referralEligibility,
  requiresAuthorisedDestination,
  type EligibilityGate,
  type GateResult,
} from "../src/components/ward-management/ward-eligibility";
import type {
  Cohort,
  LegalStatus,
  Movement,
  Referral,
  Unit,
  WardReferralDestination,
} from "../src/components/ward-management/ward-model";
import { REFERRAL_GENDERS } from "../src/components/ward-management/ward-model-vocabulary";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import {
  OBSERVATION_LEVELS,
  observationAt,
  observationStaff,
} from "../src/components/ward-management/ward-observation";
import { patientCohort } from "../src/components/ward-management/ward-patients";
import { allUnits, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

// A16-04: the app shows only travel bands someone has checked (none yet). This file tests a
// mechanism that needs bands, so importing this swaps in the tests' own invented table.
import "./helpers/ward-test-travel-bands";

/**
 * M118 (master audit list, 10 Nov 2026): ward-fit rules agree on every surface.
 *
 * Synthetic people at the age edges (17 and 18, 64 and 65), every gender answer including gender
 * diverse and not recorded, every legal status (and not recorded) and every observation level are
 * put to every seeded ward on each surface that answers "can this person go to this ward?":
 *
 *   - the movement engine (`eligibility`), which the coordinator shortlist, Find a ward, the ward's
 *     phone accept, transfer (step-down) and the patient's transit options all call directly;
 *   - the referral engine (`referralEligibility`), behind the referral drawer and Ask more wards;
 *   - the shortlist filter (`eligibleCandidatesAmong`);
 *   - the Tools bed finder (`findBeds`), a quick filter on cohort, authorisation and sex only;
 *   - the out-of-area closer-bed list (`closerBedOptions`), a travel list on cohort only.
 *
 * `tests/ward-eligibility-paths-agree.test.ts` already compares the two engine paths for cohort,
 * binary sex, two legal statuses and acuity. This file widens the people and adds the other
 * surfaces. A surface that checks less must say so on screen. Fixed 10 Nov 2026 (D-125): the bed
 * finder drops forensic wards and names what it leaves out, and the out-of-area lists say they are
 * travel lists. One gap stays an `it.todo` for Josh: the finder's Ward for choice is Female or Male.
 */

const NOW = NOW_ANCHOR;
const DEMO_DAY = new Date(Date.UTC(2026, 10, 10, 2, 42)); // 10:42 AWST, 10 Nov 2026
const template = wardMovements[0];
if (!template) throw new Error("the movement fixture is empty");
const units: Unit[] = allUnits();

/** A date of birth that makes the person exactly `years` old on DEMO_DAY, or one day short of it. */
function dateOfBirth(years: number, dayShort: boolean): string {
  const date = new Date(Date.UTC(2026 - years, 10, dayShort ? 11 : 10));
  return date.toISOString().slice(0, 10);
}

const AGE_EDGES = [
  { label: "17 (day before 18)", dob: dateOfBirth(18, true), band: "Youth" },
  { label: "18 (on the birthday)", dob: dateOfBirth(18, false), band: "Adult" },
  { label: "64 (day before 65)", dob: dateOfBirth(65, true), band: "Adult" },
  { label: "65 (on the birthday)", dob: dateOfBirth(65, false), band: "Older adult" },
] as const;

const LEGAL_STATUSES: readonly (LegalStatus | undefined)[] = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
  undefined,
];
const GENDERS = [...REFERRAL_GENDERS, undefined] as const;
const SEXES = ["Female", "Male"] as const;

type Person = {
  cohort: Cohort;
  sex: (typeof SEXES)[number];
  gender: (typeof GENDERS)[number];
  legalStatus: LegalStatus | undefined;
  observation: (typeof OBSERVATION_LEVELS)[number];
};

const PEOPLE: Person[] = [];
for (const edge of AGE_EDGES)
  for (const sex of SEXES)
    for (const gender of GENDERS)
      for (const legalStatus of LEGAL_STATUSES)
        for (const observation of OBSERVATION_LEVELS)
          PEOPLE.push({ cohort: edge.band, sex, gender, legalStatus, observation });

function asMovement(person: Person): Movement {
  return {
    ...template,
    cohort: person.cohort,
    sex: person.sex,
    gender: person.gender,
    legalStatus: person.legalStatus,
    observation: observationAt(person.observation),
    highAcuity: false,
    security: "Open",
    declines: [],
    genderPlacements: undefined,
  } as unknown as Movement;
}

function asReferral(person: Person): { referral: Referral; ward: WardReferralDestination } {
  const ward: WardReferralDestination = {
    kind: "psychiatric_ward",
    sex: person.sex,
    gender: person.gender,
    secureBedNeeded: false,
    involuntaryBedNeeded: requiresAuthorisedDestination(person.legalStatus),
    highAcuityNursingNeeded: false,
  };
  const referral: Referral = {
    id: "RF-M118",
    ageBand: person.cohort,
    destinations: [{ destination: ward, state: "queued" }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    raisedAt: NOW - 30,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    intake: { legalStatus: person.legalStatus } as unknown as Referral["intake"],
    ...FIXTURE_HISTORY,
  };
  return { referral, ward };
}

function gate(gates: readonly GateResult[], name: EligibilityGate): GateResult {
  const found = gates.find((candidate) => candidate.gate === name);
  if (!found) throw new Error(`no ${name} gate`);
  return found;
}

const SHARED: ReadonlyArray<[EligibilityGate, EligibilityGate]> = [
  ["authorisation", "legal_status"],
  ["cohort", "age"],
  ["gender_designation", "gender_designation"],
  ["forensic", "forensic"],
  ["sex_mix", "sex_mix"],
];

describe("M118: age edges give one band everywhere", () => {
  for (const edge of AGE_EDGES) {
    it(`reads ${edge.label} as ${edge.band} on the patient record and the referral prefill`, () => {
      expect(patientCohort(edge.dob, DEMO_DAY)).toBe(edge.band);
      expect(referralAgeBand(edge.dob, DEMO_DAY)?.band).toBe(edge.band);
    });
  }
});

describe("M118: the movement and referral engines agree for every synthetic person and ward", () => {
  it("gives the same verdict on every shared rule", () => {
    expect(PEOPLE.length).toBe(4 * 2 * 5 * 5 * 5);
    let compared = 0;
    for (const unit of units) {
      for (const person of PEOPLE) {
        const movementGates = eligibility(asMovement(person), unit, NOW).gates;
        const { referral, ward } = asReferral(person);
        const referralGates = referralEligibility(referral, ward, unit, NOW).gates;
        for (const [onMovement, onReferral] of SHARED) {
          const where = `${unit.id} ${JSON.stringify(person)} ${onMovement}`;
          expect(gate(movementGates, onMovement).pass, where).toBe(gate(referralGates, onReferral).pass);
          compared += 1;
        }
      }
    }
    expect(compared).toBe(units.length * PEOPLE.length * SHARED.length);
  });

  it("counts observation staff as D-72 item 5 says: 1:1 counts one, 2:1 counts two", () => {
    expect(OBSERVATION_LEVELS.map((level) => [level, observationStaff(level)])).toEqual([
      ["general", 0],
      ["intermittent", 0],
      ["within_sight", 1],
      ["arms_length", 1],
      ["two_staff", 2],
    ]);
    const unit = units.find((candidate) => candidate.speciallingCapacity > 0) ?? units[0]!;
    for (const level of OBSERVATION_LEVELS) {
      const detail = gate(
        eligibility(asMovement({ ...PEOPLE[0]!, observation: level }), unit, NOW).gates,
        "specialling",
      ).detail;
      const staff = observationStaff(level);
      if (staff > 0)
        expect(detail, level).toMatch(new RegExp(`needs ${staff} specialling staff|not staffed for specialling`));
      else expect(detail, level).toMatch(/no specialling staff needed/);
    }
  });

  it("never lets observation level change a verdict (specialling is information on both paths)", () => {
    for (const unit of units) {
      const verdicts = OBSERVATION_LEVELS.map(
        (level) => eligibility(asMovement({ ...PEOPLE[0]!, observation: level }), unit, NOW).eligible,
      );
      expect(new Set(verdicts).size, unit.id).toBe(1);
    }
  });
});

describe("M118: the shortlist is the movement engine", () => {
  it("lists every same-cohort ward with the movement engine's own verdict", () => {
    for (const person of PEOPLE.filter((_, index) => index % 7 === 0)) {
      const movement = asMovement(person);
      const listed = eligibleCandidatesAmong(movement, units, NOW, units.length);
      expect(listed.map((candidate) => candidate.unit.id).sort(), JSON.stringify(person)).toEqual(
        units
          .filter((unit) => unit.cohort === person.cohort)
          .map((unit) => unit.id)
          .sort(),
      );
      for (const { unit, verdict } of listed)
        expect(verdict.eligible, `${unit.id} ${JSON.stringify(person)}`).toBe(
          !unit.isClosed && eligibility(movement, unit, NOW).eligible,
        );
    }
  });
});

describe("M118: the Tools bed finder is a narrower quick filter", () => {
  const filtersFor = (person: Person, sex: BedFinderFilters["sex"]): BedFinderFilters => ({
    cohort: person.cohort,
    bed: "any",
    sex,
    home: "any",
    legalStatus: requiresAuthorisedDestination(person.legalStatus) ? "involuntary" : "voluntary",
  });

  it("never lists a ward the engine refuses on the three rules it does check (cohort, authorisation, sex)", () => {
    for (const person of PEOPLE.filter((candidate) => candidate.gender === candidate.sex)) {
      const listed = findBeds(units, [], [], filtersFor(person, person.sex), []);
      for (const row of listed) {
        const gates = eligibility(asMovement(person), row.unit, NOW).gates;
        const where = `${row.unit.id} ${JSON.stringify(person)}`;
        expect(gate(gates, "cohort").pass, where).toBe(true);
        expect(gate(gates, "authorisation").pass, where).toBe(true);
        expect(gate(gates, "gender_designation").pass, where).toBe(true);
      }
    }
  });

  // Fixed 10 Nov 2026 (M118, D-125): the finder leaves forensic wards out, as every engine path does.
  it("never lists a forensic ward, which every engine path refuses (D7)", () => {
    const base = units.find((unit) => !unit.isClosed && unit.cohort === "Adult" && unit.authorised)!;
    const forensic: Unit = { ...base, id: `${base.id}-m118-forensic`, forensic: true };
    const plain: Unit = { ...base, id: `${base.id}-m118-plain`, forensic: false };
    const person = PEOPLE.find((candidate) => candidate.cohort === "Adult" && candidate.gender === candidate.sex)!;
    const listed = findBeds([forensic, plain], [], [], filtersFor(person, "any"), []).map((row) => row.unit.id);
    expect(listed).toEqual([plain.id]);
    expect(gate(eligibility(asMovement(person), forensic, NOW).gates, "forensic").pass).toBe(false);
    for (const person of PEOPLE.filter((candidate) => candidate.gender === candidate.sex))
      for (const row of findBeds(units, [], [], filtersFor(person, person.sex), []))
        expect(row.unit.forensic).toBe(false);
  });

  it("says on screen which fit rules the quick filter leaves out", () => {
    expect(BED_FINDER_NOTE).toMatch(/forensic wards are left out/i);
    expect(BED_FINDER_NOTE).toMatch(/quick filter/i);
    for (const rule of ["security", "bay mix", "gender-diverse designation"])
      expect(BED_FINDER_NOTE.toLowerCase()).toContain(rule);
  });
  it.todo(
    "M118 gap: the Tools bed finder's 'Ward for' choice offers Female and Male only, so a gender diverse or not-recorded person cannot be put to it the way the engines take them",
  );
});

describe("M118: the out-of-area closer-bed list", () => {
  it("is a travel list on cohort only, so it still lists a closer ward the engine refuses", () => {
    // Josh, 10 Nov 2026 (D-125): a travel list may skip the fit rules if its note says so.
    const { entries } = outOfAreaLedger(wardAdmissions, units, NOW);
    const found = entries
      .map((entry) => ({ entry, options: closerBedOptions(entry, units, NOW) }))
      .find(({ options }) => options.length > 0);
    expect(found, "the seed has no out-of-area person with a closer ward").toBeDefined();
    const target = found!.options[0]!.unit;
    const refused: Unit = { ...target, forensic: true, authorised: false };
    const swapped = units.map((unit) => (unit.id === target.id ? refused : unit));
    const listed = closerBedOptions(found!.entry, swapped, NOW).map((option) => option.unit.id);
    expect(listed).toContain(target.id);
  });

  it("labels the closer-bed and home-region lists as travel lists that check cohort only", () => {
    for (const note of [CLOSER_BED_NOTE, HOME_REGION_BEDS_NOTE]) {
      expect(note).toMatch(/^Travel list/);
      for (const rule of ["authorisation", "sex designation", "forensic"]) expect(note).toContain(rule);
    }
    expect(CLOSER_BED_NOTE).toMatch(/same cohort only/);
    expect(HOME_REGION_BEDS_NOTE).toMatch(/adult wards only/);
  });
});
