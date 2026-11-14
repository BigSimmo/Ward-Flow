/**
 * H8 and H9 (mechanics and clock audit, 14 Nov 2026; D-210 (Josh, 14 Nov 2026)): one shared fit
 * classifier. A ward whose only failing check is an old bed count is its own state ("Bed count N min
 * old, check with the ward"), stays askable and never reads "Does not fit" or "never confirmed". A
 * Secure referral to a ward whose locked beds are all taken reads "no locked bed now", not "not
 * suitable". Synthetic data only.
 */
import { describe, expect, it } from "vitest";

import { fitKind } from "@/components/ward-management/coordinator/home-fit";
import { sharedReadyLookup } from "@/components/ward-management/ward-bed-states";
import { shortlistCandidates, deriveNextWardsAfterRefusal } from "@/components/ward-management/ward-derivations";
import {
  placementFit,
  referralEligibility,
  staleCountWords,
  type EligibilityVerdict,
  type GateResult,
} from "@/components/ward-management/ward-eligibility";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral, ReferralAddressing, Unit } from "@/components/ward-management/ward-model";
import { aFreeBedCouldChangeThis, matchReason, noBedBreakdown } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR, STANDARD_WARD_SITES, activateWardNetwork } from "@/components/ward-management/ward-sites";

activateWardNetwork(STANDARD_WARD_SITES);

function gate(name: GateResult["gate"], pass: boolean): GateResult {
  return { gate: name, pass, detail: `${name} ${pass ? "met" : "not met"}` };
}

function verdict(...failing: GateResult["gate"][]): EligibilityVerdict {
  const all: GateResult["gate"][] = ["age", "security", "capacity_freshness", "allocatable_bed", "sex_mix"];
  const gates = [...new Set([...all, ...failing])].map((name) => gate(name, !failing.includes(name)));
  return { eligible: failing.length === 0, gates };
}

/** The same unit with its bed count last confirmed `minutes` past its stale limit. */
function staleBy(unit: Unit, now: number, minutes: number): Unit {
  return {
    ...unit,
    allocatable: { ...unit.allocatable, confirmedAt: now - unit.allocatable.staleAfterMinutes - minutes },
  };
}

function wardDestination(unitId: string, secureBedNeeded = false) {
  return {
    kind: "psychiatric_ward" as const,
    unitId,
    sex: "Female" as const,
    gender: "Female" as const,
    secureBedNeeded,
    involuntaryBedNeeded: false,
    highAcuityNursingNeeded: false,
  };
}

describe("H8: the shared fit classifier", () => {
  it("classifies an old count alone as its own state, and a bed-count failure as no bed", () => {
    expect(placementFit(verdict()).kind).toBe("fits");
    expect(placementFit(verdict("capacity_freshness"))).toMatchObject({ kind: "stale_count", overridable: true });
    expect(placementFit(verdict("allocatable_bed")).kind).toBe("no_bed");
    expect(placementFit(verdict("allocatable_bed", "capacity_freshness")).gate?.gate).toBe("allocatable_bed");
    // H9: a bay-mix check that only lacks Ready beds is "no bed now".
    expect(placementFit(verdict("sex_mix")).kind).toBe("no_bed");
    expect(placementFit(verdict("locked_bed_free")).kind).toBe("no_bed");
    expect(placementFit(verdict("age", "capacity_freshness")).kind).toBe("needs_review");
    expect(placementFit(verdict("capacity_freshness", "prior_decline")).kind).toBe("stale_count");
    // A check no recorded reason can answer.
    expect(placementFit(verdict("allocatable_bed")).overridable).toBe(false);
    expect(placementFit(verdict("gender_designation")).kind).toBe("not_suitable");
  });

  it("words an old count by its age, and says never confirmed only when that is the fact", () => {
    const unit = seedWardFlowState().units[0]!;
    const now = unit.allocatable.confirmedAt + 75;
    expect(staleCountWords(unit, now)).toBe("Bed count 75 min old, check with the ward");
    expect(staleCountWords(unit, unit.allocatable.confirmedAt + 180)).toBe("Bed count 3 h old, check with the ward");
    const never = { ...unit, allocatable: { ...unit.allocatable, confirmedAt: Number.NaN } };
    expect(staleCountWords(never, now)).toBe("Bed count never confirmed, check with the ward");
  });

  it("the Place tab's reason for an old count gives its age, not 'never confirmed'", () => {
    const state = seedWardFlowState();
    const referral = state.referrals.find((r) =>
      r.destinations.some((d) => d.destination.kind === "psychiatric_ward"),
    )!;
    const now = NOW_ANCHOR + 90;
    const fitting = state.units.find(
      (unit) =>
        !unit.isClosed &&
        referralEligibility(referral, wardDestination(unit.id), unit, NOW_ANCHOR, sharedReadyLookup(state)).eligible,
    );
    expect(fitting, "the standard seed has a ward that fits this referral").toBeDefined();
    const stale = staleBy(fitting!, now, 30);
    const candidate = {
      unit: stale,
      verdict: referralEligibility(referral, wardDestination(stale.id), stale, now, sharedReadyLookup(state)),
    };
    expect(placementFit(candidate.verdict).kind).toBe("stale_count");
    const reason = matchReason(candidate, now);
    expect(reason).toMatch(/^Bed count \d+ (min|h) old, check with the ward$/u);
    expect(reason).not.toMatch(/never confirmed/u);
    const breakdown = noBedBreakdown([candidate], now)!;
    expect(breakdown.capacityUnknown).toBe(1);
    expect(breakdown.staleSinceMinutes).toBe(now - stale.allocatable.confirmedAt);
  });

  it("the next-ward list keeps a fitting ward whose count went old, flagged as old", () => {
    const state = seedWardFlowState("standard");
    const ready = sharedReadyLookup(state);
    const movement = state.movements.find((m) => !m.closure && m.acceptedUnitId === undefined)!;
    const declined = {
      ...movement,
      declines: [...movement.declines, { unitId: "no-such-ward", at: NOW_ANCHOR - 5, reason: undefined }],
    } as typeof movement;
    const fresh = deriveNextWardsAfterRefusal(declined, state.units, NOW_ANCHOR, ready)!.candidates;
    expect(fresh.length, "the standard seed has fitting wards not yet asked").toBeGreaterThan(0);
    // Every count past its limit: before H8 this emptied the list ("every ward has been asked").
    const later = Math.max(...state.units.map((u) => u.allocatable.confirmedAt + u.allocatable.staleAfterMinutes)) + 1;
    const old = deriveNextWardsAfterRefusal(declined, state.units, later, ready)!.candidates;
    expect(old.map((c) => c.unit.id)).toEqual(expect.arrayContaining(fresh.map((c) => c.unit.id)));
    expect(old.every((c) => c.bedCountStale)).toBe(true);
  });

  it("the coordinator shortlist reads an old count as 'stale', never 'no'", () => {
    const state = seedWardFlowState("standard");
    const ready = sharedReadyLookup(state);
    const movement = state.movements.find((m) => !m.closure && m.acceptedUnitId === undefined)!;
    const fits = shortlistCandidates(movement, state.units, NOW_ANCHOR, ready).filter(
      (c) => fitKind(c, movement) === "bed",
    );
    expect(fits.length).toBeGreaterThan(0);
    const later = Math.max(...state.units.map((u) => u.allocatable.confirmedAt + u.allocatable.staleAfterMinutes)) + 1;
    const again = shortlistCandidates(movement, state.units, later, ready);
    for (const fit of fits) {
      const now = again.find((c) => c.unit.id === fit.unit.id)!;
      expect(fitKind(now, movement), fit.unit.id).toBe("stale");
    }
  });

  it("Ask more wards accepts a ward whose only failing check is an old count", () => {
    const base = seedWardFlowState();
    const probe: Referral = {
      ...base.referrals[0]!,
      id: "RF-MCA-ASK",
      source: "community",
      ageBand: "Adult",
      destinations: [],
    };
    const ready = sharedReadyLookup(base);
    const fitting = base.units.filter(
      (unit) =>
        !unit.isClosed && referralEligibility(probe, wardDestination(unit.id), unit, NOW_ANCHOR, ready).eligible,
    );
    expect(fitting.length, "the standard seed has a ward that fits this referral").toBeGreaterThan(0);
    const second = fitting[0]!;
    const first = base.units.find((unit) => unit.id !== second.id)!;
    const arm: ReferralAddressing = {
      destination: wardDestination(first.id),
      state: "declined",
      decidedAt: NOW_ANCHOR - 30,
      declineReason: "no_suitable_bed",
    };
    const state: WardFlowState = {
      ...base,
      units: base.units.map((unit) => (unit.id === second.id ? staleBy(unit, NOW_ANCHOR, 20) : unit)),
      referrals: [...base.referrals, { ...probe, destinations: [arm] }],
    };
    const staleWard = state.units.find((unit) => unit.id === second.id)!;
    expect(
      placementFit(referralEligibility(probe, wardDestination(second.id), staleWard, NOW_ANCHOR, ready)).kind,
    ).toBe("stale_count");
    const next = wardFlowReducer(state, {
      type: "ASK_MORE_WARDS",
      role: "coordinator",
      now: NOW_ANCHOR,
      referralId: "RF-MCA-ASK",
      unitIds: [second.id],
    });
    expect(next.rejections).toEqual(state.rejections);
    expect(next.referrals.find((r) => r.id === "RF-MCA-ASK")!.destinations).toHaveLength(2);
  });
});

describe("H9: the locked side's capacity is its own check", () => {
  it("a Secure referral to a ward whose locked beds are all taken reads no locked bed now", () => {
    const state = seedWardFlowState();
    const referral = state.referrals[0]!;
    const lockedWard = state.units.find((unit) => !unit.isClosed && unit.lockedBeds > 0 && unit.allocatable.value > 0);
    expect(lockedWard, "the standard seed has a ward with locked beds").toBeDefined();
    const full: Unit = { ...lockedWard!, allocatableLocked: 0 };
    const v = referralEligibility(referral, wardDestination(full.id, true), full, NOW_ANCHOR, () => 3);
    expect(v.gates.find((g) => g.gate === "security")!.pass, "the ward is the right kind").toBe(true);
    const lockedFree = v.gates.find((g) => g.gate === "locked_bed_free")!;
    expect(lockedFree.pass).toBe(false);
    expect(lockedFree.detail).toMatch(/no locked bed is free now/u);

    // The same check on a ward that has no locked beds at all is `security`, a kind check.
    const openWard = state.units.find((unit) => !unit.isClosed && unit.lockedBeds === 0);
    if (openWard) {
      const o = referralEligibility(referral, wardDestination(openWard.id, true), openWard, NOW_ANCHOR, () => 3);
      expect(o.gates.find((g) => g.gate === "security")!.pass).toBe(false);
      expect(o.gates.find((g) => g.gate === "locked_bed_free")!.pass).toBe(true);
    }

    // Counted as "turns on a bed", so the banner says a freed bed could change the answer.
    const onlyLocked: EligibilityVerdict = {
      eligible: false,
      gates: v.gates.map((g) => (g.gate === "locked_bed_free" ? g : { ...g, pass: true })),
    };
    const breakdown = noBedBreakdown([{ unit: full, verdict: onlyLocked }], NOW_ANCHOR)!;
    expect(breakdown.noBedFree).toBe(1);
    expect(aFreeBedCouldChangeThis(breakdown)).toBe(true);
  });
});
