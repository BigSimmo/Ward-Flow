// Make room plans (`make-room-chains`, mockup stage): a waiting referral whose ward is full is
// offered a chain of step downs, at most three moves, inside one health service, using only stays
// already marked for step down, each move checked by the main eligibility gates.

import { describe, expect, it } from "vitest";

import { makeRoomPreview } from "../src/components/ward-management/capacity/make-room-preview";
import { eligibility } from "../src/components/ward-management/ward-eligibility";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { deriveMakeRoomChains, MAKE_ROOM_MAX_MOVES } from "../src/components/ward-management/ward-make-room";
import { boundedBedAvailability } from "../src/components/ward-management/ward-ready-beds";
import { NOW_ANCHOR, siteByCode } from "../src/components/ward-management/ward-sites";

function chainsFor(admissions = seedWardFlowState().admissions, units = seedWardFlowState().units) {
  const state = seedWardFlowState();
  return deriveMakeRoomChains({
    admissions,
    units,
    movements: state.movements,
    patients: state.patients,
    referrals: state.referrals,
    now: NOW_ANCHOR,
  });
}

describe("make room plans", () => {
  it("offers nothing when no patient is marked for step down", () => {
    expect(chainsFor()).toEqual([]);
  });

  it("finds a two move and a three move plan in the preview data", () => {
    const preview = makeRoomPreview(seedWardFlowState());
    const chains = chainsFor(preview.admissions, preview.units);
    const lengths = chains.map((chain) => chain.stepDowns.length + 1).sort();
    expect(lengths).toEqual([2, 3]);
  });

  it("keeps every move checked, ordered and inside one health service", () => {
    const preview = makeRoomPreview(seedWardFlowState());
    const chains = chainsFor(preview.admissions, preview.units);
    const used = new Set<string>();
    for (const chain of chains) {
      expect(chain.stepDowns.length + 1).toBeLessThanOrEqual(MAKE_ROOM_MAX_MOVES);
      const service = siteByCode(chain.targetUnit.siteCode)?.service;
      // The first move goes into a Ready bed that passes every gate.
      const first = chain.stepDowns[0]!;
      expect(boundedBedAvailability(first.toUnit).available).toBeGreaterThan(0);
      // Each later move goes into the ward the move before it left.
      chain.stepDowns.forEach((step, index) => {
        expect(step.admission.stepDownCandidate).toBe(true);
        expect(used.has(step.admission.id)).toBe(false);
        used.add(step.admission.id);
        expect(siteByCode(step.toUnit.siteCode)?.service).toBe(service);
        if (index > 0) expect(step.toUnit.id).toBe(chain.stepDowns[index - 1]!.fromUnit.id);
      });
      expect(chain.stepDowns.at(-1)!.fromUnit.id).toBe(chain.targetUnit.id);
      // The waiting referral fits its ward on every check except a free bed.
      const failing = eligibility(chain.movement, chain.targetUnit, NOW_ANCHOR)
        .gates.filter((gate) => !gate.pass)
        .map((gate) => gate.gate);
      expect(failing.every((gate) => gate === "allocatable_bed" || gate === "sex_mix")).toBe(true);
    }
  });
});
