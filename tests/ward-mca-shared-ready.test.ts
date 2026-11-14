/**
 * H7 (mechanics and clock audit, 14 Nov 2026; D-210 (Josh, 14 Nov 2026)): the fit check's Ready is
 * the shared Ready Capacity prints and the pull gate refuses on. Pulls since the count, named holds
 * and beds being made ready are off it on every fit list and in the engine's own acceptance check.
 * Built from the audit's reviewer script `zz-audit-figures-b.test.ts`. Synthetic data only.
 */
import { describe, expect, it } from "vitest";

import "@/components/ward-management/ward-scenario-networks";
import { bedStates, networkNamedHolds, sharedReadyLookup } from "@/components/ward-management/ward-bed-states";
import { readyBedsFor, referralEligibility } from "@/components/ward-management/ward-eligibility";
import { deriveNextWardsAfterRefusal, shortlistCandidates } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { activateScenarioNetwork, WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR, STANDARD_WARD_SITES, activateWardNetwork } from "@/components/ward-management/ward-sites";
import type { Referral, WardReferralDestination } from "@/components/ward-management/ward-model";
import { nextEvent, nowFor, seededRandom } from "./helpers/ward-engine-fuzz";

function wardProbe(state: WardFlowState): { referral: Referral; ward: WardReferralDestination } | undefined {
  const referral = state.referrals.find((r) => r.destinations.some((d) => d.destination.kind === "psychiatric_ward"));
  const arm = referral?.destinations.find((d) => d.destination.kind === "psychiatric_ward");
  return referral && arm ? { referral, ward: arm.destination as WardReferralDestination } : undefined;
}

function capacityReady(state: WardFlowState, unitId: string): number {
  const unit = state.units.find((u) => u.id === unitId)!;
  return bedStates(
    unit,
    state.admissions,
    state.bedReleases,
    state.leaveBeds,
    networkNamedHolds(state.movements, state.referrals),
  ).ready;
}

describe("H7: one shared Ready for the fit checks", () => {
  it("a bed still being made ready is not Ready to the fit check (scarce seed)", () => {
    activateScenarioNetwork("scarce");
    const state = seedWardFlowState("scarce");
    const unit = state.units.find((u) => u.id === "arm-adult-open")!;
    const probe = wardProbe(state)!;
    expect(capacityReady(state, unit.id)).toBe(0);
    const verdict = referralEligibility(
      probe.referral,
      { ...probe.ward, unitId: unit.id },
      unit,
      NOW_ANCHOR,
      sharedReadyLookup(state),
    );
    const gate = verdict.gates.find((g) => g.gate === "allocatable_bed")!;
    expect(gate.pass, "Capacity shows 0 Ready, so the fit check must not say a bed is ready").toBe(false);
    expect(gate.detail.startsWith("0 ready")).toBe(true);
    activateWardNetwork(STANDARD_WARD_SITES);
  });

  it("the lookup gives exactly Capacity's Ready on every ward of every scenario", () => {
    for (const scenario of WARD_SCENARIOS) {
      activateScenarioNetwork(scenario);
      const state = seedWardFlowState(scenario);
      const ready = sharedReadyLookup(state);
      for (const unit of state.units) {
        expect(readyBedsFor(unit, ready), `${scenario} ${unit.id}`).toBe(capacityReady(state, unit.id));
      }
    }
    activateWardNetwork(STANDARD_WARD_SITES);
  });

  it("after random engine steps, the referral bed check passes only where Capacity shows a Ready bed", () => {
    let checked = 0;
    for (let seed = 0; seed < 4; seed += 1) {
      const scenario = WARD_SCENARIOS[seed % WARD_SCENARIOS.length]!;
      activateScenarioNetwork(scenario);
      const random = seededRandom(7700 + seed);
      let state: WardFlowState = seedWardFlowState(scenario);
      for (let step = 0; step < 80; step += 1) {
        state = wardFlowReducer(state, nextEvent(state, random, step));
        if (step % 10 !== 9) continue;
        const now = nowFor(state, step);
        const probe = wardProbe(state);
        if (!probe) continue;
        const ready = sharedReadyLookup(state);
        for (const unit of state.units) {
          const gate = referralEligibility(
            probe.referral,
            { ...probe.ward, unitId: unit.id },
            unit,
            now,
            ready,
          ).gates.find((g) => g.gate === "allocatable_bed")!;
          expect(gate.pass, `${scenario} seed ${seed} step ${step} ${unit.id}`).toBe(capacityReady(state, unit.id) > 0);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
    activateWardNetwork(STANDARD_WARD_SITES);
  });

  it("movement-path lists print and test the shared Ready", () => {
    activateWardNetwork(STANDARD_WARD_SITES);
    const state = seedWardFlowState("standard");
    const ready = sharedReadyLookup(state);
    const movement = state.movements.find((m) => !m.closure && m.acceptedUnitId === undefined)!;
    for (const candidate of shortlistCandidates(movement, state.units, NOW_ANCHOR, ready)) {
      expect(candidate.readyNow).toBe(capacityReady(state, candidate.unit.id));
      const gate = candidate.verdict.gates.find((g) => g.gate === "allocatable_bed")!;
      if (!candidate.unit.isClosed) expect(gate.pass).toBe(capacityReady(state, candidate.unit.id) > 0);
    }
    const declined = {
      ...movement,
      declines: [...movement.declines, { unitId: state.units[0]!.id, at: NOW_ANCHOR - 5, reason: undefined }],
    } as typeof movement;
    for (const candidate of deriveNextWardsAfterRefusal(declined, state.units, NOW_ANCHOR, ready)?.candidates ?? []) {
      expect(candidate.availableNow).toBe(capacityReady(state, candidate.unit.id));
    }
  });
});
