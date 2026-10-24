import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import {
  acceptedReferralIdsAt,
  readyBedsAllPromised,
  readyBedsPromised,
  readyBedsPromisedSentence,
} from "../src/components/ward-management/ward-ready-bed-promises";
import { boundedBedAvailability } from "../src/components/ward-management/ward-ready-beds";

// Audit 2 E-07: a ward's yes uses up one of its Ready beds. Warn only; nothing is refused.
describe("Ready beds already promised to earlier yeses", () => {
  const state = seedWardFlowState();
  const sources = (unitId: string) => ({
    movements: state.movements,
    acceptedReferralIds: acceptedReferralIdsAt(state.referrals, unitId),
  });

  it("finds seed wards whose Ready beds are all promised, and never warns at Ready 0", () => {
    const warned = state.units.filter((unit) => readyBedsAllPromised(sources(unit.id), unit, {}) !== undefined);
    expect(warned.length).toBeGreaterThan(0);
    for (const unit of warned) {
      const figures = readyBedsAllPromised(sources(unit.id), unit, {})!;
      expect(figures.ready).toBe(boundedBedAvailability(unit).available);
      expect(figures.ready).toBeGreaterThan(0);
      expect(figures.promised).toBeGreaterThanOrEqual(figures.ready);
    }
    for (const unit of state.units.filter((u) => boundedBedAvailability(u).available === 0)) {
      expect(readyBedsAllPromised(sources(unit.id), unit, {})).toBeUndefined();
    }
  });

  it("does not count the acceptance being made against itself", () => {
    const unit = state.units.find((u) =>
      acceptedReferralIdsAt(state.referrals, u.id).some(
        (id) => !state.movements.some((movement) => movement.referralId === id),
      ),
    );
    expect(unit).toBeDefined();
    const own = acceptedReferralIdsAt(state.referrals, unit!.id).find(
      (id) => !state.movements.some((movement) => movement.referralId === id),
    )!;
    expect(readyBedsPromised(sources(unit!.id), unit!.id, { referralId: own })).toBe(
      readyBedsPromised(sources(unit!.id), unit!.id, {}) - 1,
    );
  });

  it("words the warning plainly", () => {
    expect(readyBedsPromisedSentence("Test Ward", { ready: 1, promised: 1 })).toBe(
      "Test Ward has 1 Ready bed and has already said yes to 1 patient waiting for one.",
    );
    expect(readyBedsPromisedSentence("Test Ward", { ready: 2, promised: 3 })).toBe(
      "Test Ward has 2 Ready beds and has already said yes to 3 patients waiting for one.",
    );
  });
});
