import { describe, expect, it } from "vitest";
import {
  NOT_RECORDED,
  involuntaryBedNeededForLegalStatus,
  wardReferralDestinations,
} from "@/components/ward-management/referrals/ward-referral-drawer-model";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { referralEligibility, wardRequestNeedsInvoluntaryBed } from "@/components/ward-management/ward-eligibility";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Owner ruling D-69 (Josh, 20 Oct 2026, 2:02 PM AWST): "Needs an involuntary-capable bed until
// status is set." A referral destination with no legal status must never default to Voluntary.
describe("referral destination: involuntary-capable bed until legal status is set (D-69)", () => {
  it("needs an involuntary-capable bed with no status, then not once Voluntary is set, then again for Involuntary", () => {
    let legalStatus = "";
    expect(involuntaryBedNeededForLegalStatus(legalStatus)).toBe(true);

    legalStatus = "Voluntary";
    expect(involuntaryBedNeededForLegalStatus(legalStatus)).toBe(false);

    legalStatus = "Involuntary";
    expect(involuntaryBedNeededForLegalStatus(legalStatus)).toBe(true);
  });

  it.each([undefined, null, "", "   ", NOT_RECORDED])("treats %j as no status recorded", (status) => {
    expect(involuntaryBedNeededForLegalStatus(status)).toBe(true);
  });
});

describe("ward destinations the referral drawer sends (D-69)", () => {
  const needs = { sex: "Female", gender: "", security: "Open", highAcuity: false } as const;
  it("marks each destination involuntary-capable until Voluntary is set, then again for Involuntary", () => {
    const send = (legalStatus: string) =>
      wardReferralDestinations(["unit-a", "unit-b"], { ...needs, legalStatus }).map((d) => d.involuntaryBedNeeded);
    expect(send("")).toEqual([true, true]);
    expect(send(NOT_RECORDED)).toEqual([true, true]);
    expect(send("Voluntary")).toEqual([false, false]);
    expect(send("Involuntary")).toEqual([true, true]);
  });
});

/**
 * Audit F-03 follow-up (after PR #475): acceptance re-derives the need from the referral's current
 * recorded legal status through the one shared rule, instead of trusting a stored
 * `involuntaryBedNeeded: false`.
 */
describe("acceptance re-checks the legal status (D-69, audit F-03)", () => {
  const STATUSES: [string | undefined, boolean][] = [
    ["Voluntary", false],
    [" Voluntary ", false],
    ["Referred for psychiatric examination", true],
    ["Detained awaiting examination", true],
    ["Involuntary inpatient", true],
    ["Involuntary", true],
    ["Form 1A", true],
    ["Form 6A", true],
    ["Community treatment order, Form 5A", true],
    [NOT_RECORDED, true],
    ["", true],
    ["   ", true],
    [undefined, true],
  ];

  const state = seedWardFlowState();
  // A seeded queued ward request and a ward that is NOT authorised for involuntary admissions, which
  // passes every gate for a Voluntary person. Found, not hard-coded, so seed edits do not break it.
  const withStatus = (referral: Referral, legalStatus: string | undefined): Referral =>
    ({ ...referral, intake: { legalStatus } as unknown as Referral["intake"] }) as Referral;
  const pair = (() => {
    for (const referral of state.referrals) {
      const arm = referral.destinations.find(
        (d) => d.destination.kind === "psychiatric_ward" && d.state === "queued" && d.withdrawnAt === undefined,
      );
      if (!arm || arm.destination.kind !== "psychiatric_ward" || arm.destination.involuntaryBedNeeded) continue;
      const ward = arm.destination;
      for (const unit of state.units.filter((u) => !u.authorised)) {
        if (referralEligibility(withStatus(referral, "Voluntary"), ward, unit, NOW_ANCHOR).eligible) {
          return { referral, ward, unit };
        }
      }
    }
    throw new Error("seed has no queued ward request eligible for an unauthorised ward");
  })();

  it.each(STATUSES)("legal status %j needs an involuntary-capable bed: %s", (legalStatus, needed) => {
    expect(involuntaryBedNeededForLegalStatus(legalStatus)).toBe(needed);
    const referral = withStatus(pair.referral, legalStatus);
    expect(wardRequestNeedsInvoluntaryBed(referral, pair.ward)).toBe(needed);
    const gate = referralEligibility(referral, pair.ward, pair.unit, NOW_ANCHOR).gates.find(
      (g) => g.gate === "legal_status",
    );
    expect(gate?.pass).toBe(!needed);
  });

  it("never lets a stored need be cleared by the legal status, and keeps the stored answer with no intake", () => {
    const voluntary = withStatus(pair.referral, "Voluntary");
    expect(wardRequestNeedsInvoluntaryBed(voluntary, { involuntaryBedNeeded: true })).toBe(true);
    expect(wardRequestNeedsInvoluntaryBed({ intake: undefined }, { involuntaryBedNeeded: false })).toBe(false);
    expect(wardRequestNeedsInvoluntaryBed({ intake: undefined }, { involuntaryBedNeeded: true })).toBe(true);
  });

  it("refuses an acceptance into an unauthorised ward while the legal status is not recorded", () => {
    const unrecorded = withStatus(pair.referral, NOT_RECORDED);
    const before: WardFlowState = {
      ...state,
      referrals: state.referrals.map((r) => (r.id === unrecorded.id ? unrecorded : r)),
    };
    const after = wardFlowReducer(before, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW_ANCHOR,
      referralId: unrecorded.id,
      unitId: pair.unit.id,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0]!.reason).toContain("legal_status");

    const voluntary = withStatus(pair.referral, "Voluntary");
    const accepted = wardFlowReducer(
      { ...state, referrals: state.referrals.map((r) => (r.id === voluntary.id ? voluntary : r)) },
      {
        type: "ACCEPT_REFERRAL",
        destinationKind: "psychiatric_ward",
        role: "coordinator",
        now: NOW_ANCHOR,
        referralId: voluntary.id,
        unitId: pair.unit.id,
      },
    );
    expect(accepted.rejections).toEqual([]);
  });
});
