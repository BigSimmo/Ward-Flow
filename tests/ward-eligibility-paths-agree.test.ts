import { describe, expect, it } from "vitest";

import {
  checkedGates,
  eligibility,
  gateMark,
  referralEligibility,
  type EligibilityGate,
  type GateResult,
} from "../src/components/ward-management/ward-eligibility";
import type { Movement, Referral, Unit, WardReferralDestination } from "../src/components/ward-management/ward-model";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Review 18 Oct 2026, item 2: the movement path (`eligibility`) and the referral path
 * (`referralEligibility`) must give the same answer on every rule they share, for the same person
 * and the same ward. Only the two capacity gates differ on purpose (accept in principle versus place
 * now), so only they are left out here.
 */
const NOW = NOW_ANCHOR;
const template = wardMovements[0];
if (!template) throw new Error("the movement fixture is empty");

/** Movement gate name, and the referral gate that asks the same question. */
const SHARED: ReadonlyArray<[EligibilityGate, EligibilityGate]> = [
  ["authorisation", "legal_status"],
  ["cohort", "age"],
  ["gender_designation", "gender_designation"],
  ["forensic", "forensic"],
  ["sex_mix", "sex_mix"],
  ["acuity", "acuity"],
  ["capacity_freshness", "capacity_freshness"],
];

/** Gates whose wording names the path ("movement" or "referral"), so only the verdict is compared. */
const WORDING_NAMES_THE_PATH = new Set<EligibilityGate>(["cohort", "acuity"]);

type Person = {
  cohort: Movement["cohort"];
  sex: Movement["sex"];
  gender: Movement["gender"];
  involuntary: boolean;
  highAcuity: boolean;
};

const PEOPLE: Person[] = [];
for (const cohort of ["Adult", "Older adult", "Youth"] as const) {
  for (const sex of ["Female", "Male"] as const) {
    for (const gender of [sex, "Non-binary", undefined] as const) {
      for (const involuntary of [false, true]) {
        for (const highAcuity of [false, true]) PEOPLE.push({ cohort, sex, gender, involuntary, highAcuity });
      }
    }
  }
}

function asMovement(person: Person): Movement {
  return {
    ...template,
    cohort: person.cohort,
    sex: person.sex,
    gender: person.gender,
    legalStatus: person.involuntary ? "Detained awaiting examination" : "Voluntary",
    highAcuity: person.highAcuity,
    security: "Open",
    declines: [],
    genderPlacements: undefined,
  } as Movement;
}

function asReferral(person: Person): { referral: Referral; ward: WardReferralDestination } {
  const ward: WardReferralDestination = {
    kind: "psychiatric_ward",
    sex: person.sex,
    gender: person.gender,
    secureBedNeeded: false,
    involuntaryBedNeeded: person.involuntary,
    highAcuityNursingNeeded: person.highAcuity,
  };
  const referral: Referral = {
    id: "RF-AGREE",
    ageBand: person.cohort,
    destinations: [{ destination: ward, state: "queued" }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    raisedAt: NOW - 30,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    // Audit 2 E-04: a referral with no recorded legal status needs an authorised bed, so the
    // referral records the same status the movement path carries.
    intake: { legalStatus: asMovement(person).legalStatus } as unknown as Referral["intake"],
    ...FIXTURE_HISTORY,
  };
  return { referral, ward };
}

function gateNamed(gates: GateResult[], name: EligibilityGate): GateResult {
  const found = gates.find((gate) => gate.gate === name);
  if (!found) throw new Error(`no ${name} gate was emitted`);
  return found;
}

const units: Unit[] = allUnits();

describe("the movement and referral paths agree on every shared rule", () => {
  it("gives the same verdict, and the same wording where it does not name the path, for every seeded ward", () => {
    expect(units.length).toBeGreaterThan(5);
    let compared = 0;
    for (const unit of units) {
      for (const person of PEOPLE) {
        const movementGates = eligibility(asMovement(person), unit, NOW).gates;
        const { referral, ward } = asReferral(person);
        const referralGates = referralEligibility(referral, ward, unit, NOW).gates;
        for (const [movementName, referralName] of SHARED) {
          const onMovement = gateNamed(movementGates, movementName);
          const onReferral = gateNamed(referralGates, referralName);
          const where = `${unit.id} ${JSON.stringify(person)} ${movementName}`;
          expect(onMovement.pass, where).toBe(onReferral.pass);
          expect(gateMark(onMovement), where).toBe(gateMark(onReferral));
          if (!WORDING_NAMES_THE_PATH.has(movementName)) expect(onMovement.detail, where).toBe(onReferral.detail);
          compared += 1;
        }
      }
    }
    expect(compared).toBe(units.length * PEOPLE.length * SHARED.length);
  });

  it("treats a ward with only one ready bed the same way on both paths for the bay-mix rule", () => {
    const unit = units.find((candidate) => !candidate.forensic);
    if (!unit) throw new Error("no non-forensic ward in the seed");
    const lone: Unit = {
      ...unit,
      sexMix: { Female: 0, Male: 0 },
      allocatable: { ...unit.allocatable, value: 3 },
      empty: { ...unit.empty, value: 1 },
    };
    const person = PEOPLE[0]!;
    const { referral, ward } = asReferral(person);
    expect(gateNamed(eligibility(asMovement(person), lone, NOW).gates, "sex_mix").pass).toBe(false);
    expect(gateNamed(referralEligibility(referral, ward, lone, NOW).gates, "sex_mix").pass).toBe(false);
  });
});

describe("acuity and specialling are information, never a check that was met", () => {
  const unit = units.find((candidate) => !candidate.forensic)!;
  const unstaffed: Unit = { ...unit, highAcuityCapacity: 0, speciallingCapacity: 0 };

  it("marks both gates as information on the movement path and leaves them out of the count", () => {
    const verdict = eligibility({ ...asMovement(PEOPLE[1]!), specialling: true }, unstaffed, NOW);
    for (const name of ["acuity", "specialling"] as const) {
      const gate = gateNamed(verdict.gates, name);
      expect(gateMark(gate), name).toBe("info");
      expect(gate.detail, name).not.toMatch(/capacity currently reached/);
      expect(gate.detail, name).toMatch(/not staffed/);
    }
    expect(checkedGates(verdict.gates).map((gate) => gate.gate)).not.toContain("acuity");
    expect(checkedGates(verdict.gates).map((gate) => gate.gate)).not.toContain("specialling");
  });

  it("marks both gates as information on the referral path", () => {
    const { referral, ward } = asReferral(PEOPLE[1]!);
    const verdict = referralEligibility(referral, ward, unstaffed, NOW);
    expect(gateMark(gateNamed(verdict.gates, "acuity"))).toBe("info");
    expect(gateMark(gateNamed(verdict.gates, "specialling"))).toBe("info");
  });

  it("still never stops a placement on its own", () => {
    const verdict = eligibility({ ...asMovement(PEOPLE[1]!), specialling: true }, unstaffed, NOW);
    expect(gateNamed(verdict.gates, "acuity").pass).toBe(true);
    expect(gateNamed(verdict.gates, "specialling").pass).toBe(true);
  });
});
