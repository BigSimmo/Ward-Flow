// M87 part b: one test for each defect that survived the first planted-defect sample
// (docs/ward-flow/evidence/2026-11-10-mutation-sample.md). Each pins what the code already does at a
// boundary no other direct test touched; none changes a rule. Ids match
// scripts/ward-flow/mutation-sample.mjs, which finds this file because it imports both files directly.
import { describe, expect, it } from "vitest";

import { scopeWorkspace } from "@/components/ward-management/ward-access-scope";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { completeSyntheticReferralIntake } from "@/components/ward-management/ward-referral-intake-seed";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const units = allUnits();
const [OWN, OTHER, THIRD] = units;
if (!OWN || !OTHER || !THIRD || !wardMovements[0]) throw new Error("the synthetic fixtures are empty");

const openMovement = { ...wardMovements[0], security: "Open", declines: [] } as Movement;

function unitWith(allocatable: Partial<Unit["allocatable"]>): Unit {
  const unit = structuredClone(OWN!);
  unit.allocatable = { ...unit.allocatable, ...allocatable };
  return unit;
}

const gate = (unit: Unit, name: string) => eligibility(openMovement, unit, NOW).gates.find((g) => g.gate === name)!;

describe("E2: a bed count confirmed exactly its stale limit ago is still fresh", () => {
  it("passes the freshness check on the boundary and fails one minute past it", () => {
    const limit = 120;
    expect(gate(unitWith({ confirmedAt: NOW - limit, staleAfterMinutes: limit }), "capacity_freshness")).toMatchObject({
      pass: true,
      detail: `Confirmed ${limit} min ago`,
    });
    expect(gate(unitWith({ confirmedAt: NOW - limit - 1, staleAfterMinutes: limit }), "capacity_freshness").pass).toBe(
      false,
    );
  });
});

describe("E3: a ward with 0 free beds says it has no free bed", () => {
  it("names no free bed at exactly 0, and does not claim locked beds are free", () => {
    const unit = unitWith({ value: 0 });
    expect(gate(unit, "security").detail).toBe(`${unit.name} has no free bed`);
    expect(gate(unit, "allocatable_bed").pass).toBe(false);
  });
});

function wardReferral(id: string, partial: Partial<Referral>): Referral {
  return completeSyntheticReferralIntake({
    id,
    ageBand: "Adult",
    destinations: [],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "unknown", reason: "not_known" },
    source: "psychiatric_ward",
    raisedAt: NOW - 60,
    urgency: 3,
    originSiteCode: OTHER!.siteCode,
    transportNeeded: false,
    history: "Synthetic example referral.",
    patientId: "PT-MUT-1",
    ...partial,
  } as Referral);
}

const line = (unitId: string, extra: Partial<Referral["destinations"][number]> = {}) =>
  ({
    destination: {
      kind: "psychiatric_ward",
      unitId,
      sex: "Female",
      gender: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      highAcuityNursingNeeded: false,
    },
    state: "queued",
    ...extra,
  }) as Referral["destinations"][number];

function wardView(referrals: Referral[]) {
  return scopeWorkspace(
    { movements: [], referrals, patients: [], admissions: [], notices: [], units },
    { role: "ward", scope: { kind: "ward", unitIds: [OWN!.id] } },
    { now: NOW, places: wardPlaceLookup(units) },
  ).referrals.map((referral) => referral.id);
}

describe("S2: only a referral this ward sent counts as its own", () => {
  it("does not show a ward another ward's open referral sent to a third ward", () => {
    const otherWardSent = wardReferral("RF-MUT-S2", { originUnitId: OTHER!.id, destinations: [line(THIRD!.id)] });
    const ownSent = wardReferral("RF-MUT-S2-OWN", { originUnitId: OWN!.id, destinations: [line(THIRD!.id)] });
    expect(wardView([otherWardSent, ownSent])).toEqual(["RF-MUT-S2-OWN"]);
  });
});

describe("S4: a decided referral stays with the ward up to and including the window edge", () => {
  it("keeps a line decided exactly one hand-off window ago and drops one decided a minute earlier", () => {
    const window = CLINICAL_VALUES.wardHandoffWindow.value * 24 * 60;
    const declinedAt = (decidedAt: number) =>
      line(OWN!.id, { state: "declined", declineReason: "no_suitable_bed", decidedAt, decidedBy: "Nurse in charge" });
    const edge = wardReferral("RF-MUT-S4-EDGE", {
      originUnitId: OTHER!.id,
      raisedAt: NOW - window - 30,
      destinations: [declinedAt(NOW - window)],
    });
    const past = wardReferral("RF-MUT-S4-PAST", {
      originUnitId: OTHER!.id,
      raisedAt: NOW - window - 30,
      destinations: [declinedAt(NOW - window - 1)],
    });
    expect(wardView([edge, past])).toEqual(["RF-MUT-S4-EDGE"]);
  });
});
