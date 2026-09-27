import { describe, expect, it } from "vitest";

import {
  defaultWardConfiguration,
  validateConfiguration,
  type WardConfiguration,
} from "../src/components/ward-management/ward-configuration";
import {
  ED_ACCESS_TARGET_MINUTES,
  ED_ACCESS_TARGET_RANGE_MINUTES,
  MORNING_ROLLUP_TIME_MINUTES,
  MORNING_ROLLUP_TIME_RANGE_MINUTES,
  PARALLEL_REFERRAL_CAP,
  PARALLEL_REFERRAL_CAP_RANGE,
  PULL_HOLD_MINUTES,
  PULL_HOLD_RANGE_MINUTES,
} from "../src/components/ward-management/ward-model";
import {
  DUE_SOON_MINUTES,
  DUE_SOON_RANGE_MINUTES,
  DUE_SOON_URGENT_MINUTES,
  DUE_SOON_URGENT_RANGE_MINUTES,
} from "../src/components/ward-management/ward-operational-defaults";

describe("defaultWardConfiguration", () => {
  it("equals the named model constants", () => {
    expect(defaultWardConfiguration()).toEqual({
      edAccessTargetMinutes: ED_ACCESS_TARGET_MINUTES,
      parallelReferralCap: PARALLEL_REFERRAL_CAP,
      pullHoldMinutes: PULL_HOLD_MINUTES,
      morningRollupDeadlineMinutes: MORNING_ROLLUP_TIME_MINUTES,
      dueSoonUrgentMinutes: DUE_SOON_URGENT_MINUTES,
      dueSoonMinutes: DUE_SOON_MINUTES,
    });
  });

  it("is in range and on step for every field", () => {
    const defaults = defaultWardConfiguration();
    expect(defaults.edAccessTargetMinutes).toBeGreaterThanOrEqual(ED_ACCESS_TARGET_RANGE_MINUTES.min);
    expect(defaults.edAccessTargetMinutes).toBeLessThanOrEqual(ED_ACCESS_TARGET_RANGE_MINUTES.max);
    expect(
      (defaults.edAccessTargetMinutes - ED_ACCESS_TARGET_RANGE_MINUTES.min) % ED_ACCESS_TARGET_RANGE_MINUTES.step,
    ).toBe(0);

    expect(defaults.parallelReferralCap).toBeGreaterThanOrEqual(PARALLEL_REFERRAL_CAP_RANGE.min);
    expect(defaults.parallelReferralCap).toBeLessThanOrEqual(PARALLEL_REFERRAL_CAP_RANGE.max);
    expect((defaults.parallelReferralCap - PARALLEL_REFERRAL_CAP_RANGE.min) % PARALLEL_REFERRAL_CAP_RANGE.step).toBe(0);

    expect(defaults.pullHoldMinutes).toBeGreaterThanOrEqual(PULL_HOLD_RANGE_MINUTES.min);
    expect(defaults.pullHoldMinutes).toBeLessThanOrEqual(PULL_HOLD_RANGE_MINUTES.max);
    expect((defaults.pullHoldMinutes - PULL_HOLD_RANGE_MINUTES.min) % PULL_HOLD_RANGE_MINUTES.step).toBe(0);

    expect(defaults.morningRollupDeadlineMinutes).toBeGreaterThanOrEqual(MORNING_ROLLUP_TIME_RANGE_MINUTES.min);
    expect(defaults.morningRollupDeadlineMinutes).toBeLessThanOrEqual(MORNING_ROLLUP_TIME_RANGE_MINUTES.max);
    expect(
      (defaults.morningRollupDeadlineMinutes - MORNING_ROLLUP_TIME_RANGE_MINUTES.min) %
        MORNING_ROLLUP_TIME_RANGE_MINUTES.step,
    ).toBe(0);
  });

  it("round-trips through validateConfiguration", () => {
    expect(validateConfiguration(defaultWardConfiguration())).toEqual(defaultWardConfiguration());
  });
});

describe("validateConfiguration", () => {
  const valid: WardConfiguration = {
    edAccessTargetMinutes: 1200,
    parallelReferralCap: 2,
    pullHoldMinutes: 90,
    morningRollupDeadlineMinutes: 570,
    dueSoonUrgentMinutes: 30,
    dueSoonMinutes: 240,
  };

  it("accepts a valid in-range, on-step payload", () => {
    expect(validateConfiguration(valid)).toEqual(valid);
  });

  it("rejects a non-integer value", () => {
    expect(validateConfiguration({ ...valid, pullHoldMinutes: 90.5 })).toBeNull();
  });

  it("rejects an out-of-range value (too low)", () => {
    expect(
      validateConfiguration({ ...valid, edAccessTargetMinutes: ED_ACCESS_TARGET_RANGE_MINUTES.min - 120 }),
    ).toBeNull();
  });

  it("rejects an out-of-range value (too high)", () => {
    expect(validateConfiguration({ ...valid, parallelReferralCap: PARALLEL_REFERRAL_CAP_RANGE.max + 1 })).toBeNull();
  });

  it("rejects an off-step value", () => {
    expect(validateConfiguration({ ...valid, pullHoldMinutes: valid.pullHoldMinutes + 1 })).toBeNull();
  });

  it("rejects a payload with an extra key", () => {
    expect(validateConfiguration({ ...valid, extraKey: 1 })).toBeNull();
  });

  it("rejects a payload missing a key", () => {
    const { pullHoldMinutes: _pullHoldMinutes, ...missing } = valid;
    void _pullHoldMinutes;
    expect(validateConfiguration(missing)).toBeNull();
  });

  it("rejects non-object payloads", () => {
    expect(validateConfiguration(null)).toBeNull();
    expect(validateConfiguration(undefined)).toBeNull();
    expect(validateConfiguration("not an object")).toBeNull();
    expect(validateConfiguration(42)).toBeNull();
    expect(validateConfiguration([valid])).toBeNull();
  });

  it("rejects a string masquerading as a number", () => {
    expect(validateConfiguration({ ...valid, parallelReferralCap: "2" })).toBeNull();
  });

  it("accepts a legacy 3-key payload and defaults morningRollupDeadlineMinutes to 570", () => {
    const legacy = {
      edAccessTargetMinutes: 1200,
      parallelReferralCap: 2,
      pullHoldMinutes: 90,
    };
    expect(validateConfiguration(legacy)).toEqual({
      ...legacy,
      morningRollupDeadlineMinutes: MORNING_ROLLUP_TIME_MINUTES,
      dueSoonUrgentMinutes: DUE_SOON_URGENT_MINUTES,
      dueSoonMinutes: DUE_SOON_MINUTES,
    });
  });

  // Josh, 26 Sept 2026 ("All yes", question 3): the 1-hour and 3-hour warnings are changeable in
  // Settings. A configuration saved before the two keys existed still loads, with the defaults.
  it("accepts a stored 4-key payload and defaults the two due-time warnings", () => {
    const stored = { edAccessTargetMinutes: 1200, parallelReferralCap: 2, pullHoldMinutes: 90, morningRollupDeadlineMinutes: 570 };
    expect(validateConfiguration(stored)).toEqual({
      ...stored,
      dueSoonUrgentMinutes: DUE_SOON_URGENT_MINUTES,
      dueSoonMinutes: DUE_SOON_MINUTES,
    });
  });

  it("rejects due-time warnings out of range, off step, or with the first not before the second", () => {
    expect(validateConfiguration({ ...valid, dueSoonUrgentMinutes: DUE_SOON_URGENT_RANGE_MINUTES.min - 15 })).toBeNull();
    expect(validateConfiguration({ ...valid, dueSoonMinutes: DUE_SOON_RANGE_MINUTES.max + 30 })).toBeNull();
    expect(validateConfiguration({ ...valid, dueSoonUrgentMinutes: 20 })).toBeNull();
    expect(validateConfiguration({ ...valid, dueSoonUrgentMinutes: 120, dueSoonMinutes: 120 })).toBeNull();
    expect(validateConfiguration({ ...valid, dueSoonUrgentMinutes: 180, dueSoonMinutes: 120 })).toBeNull();
  });

  it("rejects morningRollupDeadlineMinutes out of range or off-step", () => {
    expect(
      validateConfiguration({
        ...valid,
        morningRollupDeadlineMinutes: MORNING_ROLLUP_TIME_RANGE_MINUTES.min - 15,
      }),
    ).toBeNull();
    expect(
      validateConfiguration({
        ...valid,
        morningRollupDeadlineMinutes: MORNING_ROLLUP_TIME_RANGE_MINUTES.max + 15,
      }),
    ).toBeNull();
    expect(
      validateConfiguration({
        ...valid,
        morningRollupDeadlineMinutes: MORNING_ROLLUP_TIME_RANGE_MINUTES.min + 7,
      }),
    ).toBeNull();
  });
});
