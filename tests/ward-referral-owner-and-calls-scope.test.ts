import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { commandScopeRefusal, scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import { seedWardFlowState, type WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import type { Referral, ReferralAddressing } from "../src/components/ward-management/ward-model";
import { STATEWIDE_COORDINATOR, type WardAccess } from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Fix plan item 4 on the shared workspace. A call names the ward or team rung, so a ward that sees
 * only its own copy of a parallel referral must not learn from the call log which other wards were
 * asked (FD-23). The owner is a desk and stays.
 */

const NOW = NOW_ANCHOR;
const seeded = seedWardFlowState();
const places = wardPlaceLookup(seeded.units);
const options = { now: NOW, places };
const [unitA, unitB] = seeded.units;

const wardLine = (unitId: string): ReferralAddressing => ({
  destination: {
    kind: "psychiatric_ward",
    unitId,
    sex: "Female",
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    highAcuityNursingNeeded: false,
  },
  state: "queued",
  referredAt: NOW - 60,
});

const referral: Referral = {
  ...seeded.referrals[0]!,
  id: "owner-calls-scope",
  source: "community",
  destinations: [wardLine(unitA!.id), wardLine(unitB!.id)],
  ownerHistory: [{ owner: "coordinator", at: NOW - 30, by: "Flow coordinator" }],
  contactLog: [
    {
      contact: { kind: "psychiatric_ward", unitId: unitA!.id },
      outcome: "call_back",
      at: NOW - 20,
      by: "Flow coordinator",
    },
    {
      contact: { kind: "psychiatric_ward", unitId: unitB!.id },
      outcome: "said_no",
      at: NOW - 10,
      by: "Flow coordinator",
    },
    { contact: { kind: "referrer" }, outcome: "no_answer", at: NOW - 5, by: "Flow coordinator" },
  ],
};
const state: WardFlowState = { ...seeded, referrals: [...seeded.referrals, referral] };
const scopedCopy = (access: WardAccess) =>
  scopeWardFlowState(state, access, options).state.referrals.find((candidate) => candidate.id === referral.id);

describe("a referral's call log on a desk's copy", () => {
  it("keeps only calls to the ward's own place and to the referrer when the copy is trimmed", () => {
    const wardA: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [unitA!.id] } };
    const copy = scopedCopy(wardA);
    expect(copy?.destinations).toHaveLength(1);
    expect(copy?.contactLog?.map((call) => call.contact)).toEqual([
      { kind: "psychiatric_ward", unitId: unitA!.id },
      { kind: "referrer" },
    ]);
    expect(JSON.stringify(copy)).not.toContain(unitB!.id);
    expect(copy?.ownerHistory).toEqual(referral.ownerHistory);
  });

  it("keeps every call for the statewide coordinator", () => {
    expect(scopedCopy(STATEWIDE_COORDINATOR)?.contactLog).toEqual(referral.contactLog);
  });
});

describe("a call or an assignment sent by a desk", () => {
  it("may name a ward outside the desk's place as the place rung", () => {
    const serviceCoordinator: WardAccess = {
      role: "coordinator",
      scope: { kind: "ward", unitIds: [unitA!.id] },
    };
    expect(
      commandScopeRefusal(
        state,
        serviceCoordinator,
        {
          type: "LOG_REFERRAL_CONTACT",
          role: "coordinator",
          referralId: referral.id,
          contact: { kind: "psychiatric_ward", unitId: unitB!.id },
          outcome: "no_answer",
        },
        options,
      ),
    ).toBeNull();
  });

  it("is refused for a referral the desk does not see", () => {
    const wardElsewhere = seeded.units.find(
      (unit) =>
        !referral.destinations.some((line) => "unitId" in line.destination && line.destination.unitId === unit.id),
    )!;
    const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [wardElsewhere.id] } };
    expect(
      commandScopeRefusal(
        state,
        ward,
        { type: "ASSIGN_REFERRAL", role: "ward", referralId: referral.id, owner: "coordinator" },
        options,
      ),
    ).toMatch(/outside your role's place/);
  });
});
