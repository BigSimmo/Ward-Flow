import { describe, expect, it } from "vitest";

import { eligibility, referralEligibility } from "../src/components/ward-management/ward-eligibility";
import type { Movement, Referral, Unit, WardReferralDestination } from "../src/components/ward-management/ward-model";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Fix 2 (26 September 2026): the movement path's `sex_mix` gate asks how many beds are FREE, the
 * same `availableNow = min(allocatable, empty)` the referral path already reads. It read
 * `unit.allocatable.value` alone, so a ward that confirmed 3 allocatable beds and then took two
 * arrivals (`allocatable: 3, empty: 1`) passed with one free bed: the lone-patient case the gate
 * exists to prevent. Only `sex_mix` changed; `allocatable_bed` on the movement path still passes on
 * raw `allocatable`, deliberately, and the last test here holds that line.
 */
const NOW = 10 * 60 + 42;

function unit(allocatable: number, empty: number, sexMix: Unit["sexMix"] = { Female: 0, Male: 8 }): Unit {
  return {
    id: "u-test",
    siteCode: "RPH",
    name: "Test Unit",
    cohort: "Adult",
    lockedBeds: 0,
    authorised: true,
    beds: 20,
    empty: { value: empty, source: "feed", confirmedAt: NOW - 2, staleAfterMinutes: 15 },
    allocatable: { value: allocatable, source: "ward", confirmedAt: NOW - 10, staleAfterMinutes: 120 },
    allocatableLocked: 0,
    held: 0,
    blocked: 0,
    sexMix,
    speciallingCapacity: 1,
    highAcuityCapacity: 1,
    sexDesignation: "Undesignated",
    forensic: false,
  };
}

const female: Movement = {
  id: "WF-001",
  originEdId: "ed-rph",
  openedAt: NOW - 300,
  flaggedUrgent: false,
  urgency: 2,
  cohort: "Adult",
  security: "Open",
  sex: "Female",
  gender: "Female",
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

const femaleWard: WardReferralDestination = {
  kind: "psychiatric_ward",
  sex: "Female",
  gender: "Female",
  secureBedNeeded: false,
  involuntaryBedNeeded: false,
  highAcuityNursingNeeded: false,
};

const femaleReferral: Referral = {
  id: "RF-TEST",
  ageBand: "Adult",
  destinations: [{ destination: femaleWard, state: "queued" }],
  homeRegion: "Perth Metropolitan",
  suburb: { kind: "named", name: "Armadale" },
  source: "community",
  raisedAt: NOW - 30,
  urgency: 2,
  originSiteCode: "RPH",
  transportNeeded: false,
  ...FIXTURE_HISTORY,
};

function movementGate(u: Unit, gate: string) {
  return eligibility(female, u, NOW).gates.find((result) => result.gate === gate);
}

function referralGate(u: Unit, gate: string) {
  return referralEligibility(femaleReferral, femaleWard, u, NOW).gates.find((result) => result.gate === gate);
}

describe("movement-path sex_mix counts free beds, as the referral path does (Fix 2)", () => {
  it("refuses a lone woman on a ward with 3 allocatable beds but only 1 empty", () => {
    const gate = movementGate(unit(3, 1), "sex_mix");
    expect(gate?.pass, "allocatable 3 / empty 1 is one free bed, and the lone-patient mix was accepted").toBe(false);
    expect(gate?.detail).toMatch(/No same-sex occupants; needs more than one free bed/u);
  });

  it("accepts the same ward once two beds are actually free (the control)", () => {
    expect(movementGate(unit(3, 2), "sex_mix")?.pass).toBe(true);
  });

  it("still accepts on same-sex occupants alone, whatever the free-bed count", () => {
    const gate = movementGate(unit(3, 1, { Female: 4, Male: 8 }), "sex_mix");
    expect(gate?.pass).toBe(true);
    expect(gate?.detail).toMatch(/4 female occupants/u);
  });

  it("gives the same sex_mix verdict as the referral path for every small allocatable/empty pair", () => {
    const disagreements: string[] = [];
    for (let allocatable = 0; allocatable <= 3; allocatable += 1) {
      for (let empty = 0; empty <= 3; empty += 1) {
        const u = unit(allocatable, empty);
        const byMovement = movementGate(u, "sex_mix")?.pass;
        const byReferral = referralGate(u, "sex_mix")?.pass;
        if (byMovement === undefined || byReferral === undefined) {
          disagreements.push(`allocatable ${allocatable} / empty ${empty}: a path has no sex_mix gate`);
        } else if (byMovement !== byReferral) {
          disagreements.push(
            `allocatable ${allocatable} / empty ${empty}: movement ${byMovement}, referral ${byReferral}`,
          );
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  it("leaves the movement path's allocatable_bed gate on raw allocatable, as before", () => {
    expect(movementGate(unit(3, 1), "allocatable_bed")?.pass).toBe(true);
    expect(movementGate(unit(0, 3), "allocatable_bed")?.pass).toBe(false);
  });
});
