import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import {
  readyBedsAllPromised,
  readyBedsPromised,
  readyBedsPromisedSentence,
} from "../src/components/ward-management/ward-ready-bed-promises";
import { boundedBedAvailability } from "../src/components/ward-management/ward-ready-beds";

// Audit 2 E-07: a ward's yes uses up one of its Ready beds. Warn only; nothing is refused.
describe("Ready beds already promised to earlier yeses", () => {
  const state = seedWardFlowState();

  it("finds seed wards whose Ready beds are all promised, and never warns at Ready 0", () => {
    const warned = state.units.filter((unit) => readyBedsAllPromised(state, unit, {}) !== undefined);
    expect(warned.length).toBeGreaterThan(0);
    for (const unit of warned) {
      const figures = readyBedsAllPromised(state, unit, {})!;
      expect(figures.ready).toBe(boundedBedAvailability(unit).available);
      expect(figures.ready).toBeGreaterThan(0);
      expect(figures.promised).toBeGreaterThanOrEqual(figures.ready);
    }
    for (const unit of state.units.filter((u) => boundedBedAvailability(u).available === 0)) {
      expect(readyBedsAllPromised(state, unit, {})).toBeUndefined();
    }
  });

  it("does not count the acceptance being made against itself", () => {
    const unit = state.units.find((u) => readyBedsPromised(state, u.id, {}) > 0)!;
    const own = state.referrals.find(
      (referral) =>
        !state.movements.some((movement) => movement.referralId === referral.id) &&
        referral.destinations.some(
          (arm) => arm.state === "accepted" && arm.withdrawnAt === undefined && arm.acceptedUnitId === unit.id,
        ),
    );
    if (own) {
      expect(readyBedsPromised(state, unit.id, { referralId: own.id })).toBe(readyBedsPromised(state, unit.id, {}) - 1);
    }
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
