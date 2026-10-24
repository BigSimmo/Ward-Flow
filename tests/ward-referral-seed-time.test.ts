import { describe, expect, it } from "vitest";
import { referralIntakeError } from "@/components/ward-management/referrals/referral-submission";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import {
  formatReferralIntakeTime,
  isSyntheticReferralTimelineBase,
  seededReferralTimelineBase,
} from "@/components/ward-management/ward-referral-seed-time";

const dayZero = new Date("2026-10-24T00:00:00+08:00");
const target = () => ({ syntheticTimelineBase: seededReferralTimelineBase() });
const seededTime = (minutes: number) =>
  new Date(Date.parse(seededReferralTimelineBase()) + minutes * 60_000).toISOString();

describe("explicit seed intake time provenance", () => {
  it("uses the canonical scenario day as an explicit Perth midnight", () => {
    const base = seededReferralTimelineBase();
    expect(base).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\+08:00$/);
    expect(isSyntheticReferralTimelineBase(base)).toBe(true);
    expect(isSyntheticReferralTimelineBase(new Date(base).toISOString())).toBe(true);
  });

  it("projects a marked seed target onto the current demonstration day and prints AWST", () => {
    expect(formatReferralIntakeTime(seededTime(12 * 60 + 42), target(), dayZero)).toBe("24 Oct 2026, 12:42 AWST");
    // The UTC string's clock face is 04:42, but the represented Perth time is 12:42.
    expect(seededTime(12 * 60 + 42)).toContain("T04:42:00.000Z");
  });

  it("preserves tomorrow and negative day offsets rather than truncating to a clock face", () => {
    expect(formatReferralIntakeTime(seededTime(1440 + 65), target(), dayZero)).toBe("25 Oct 2026, 01:05 AWST");
    expect(formatReferralIntakeTime(seededTime(-30), target(), dayZero)).toBe("23 Oct 2026, 23:30 AWST");
    expect(formatReferralIntakeTime(seededTime(0), target(), dayZero)).toBe("24 Oct 2026, 00:00 AWST");
  });

  it("offers a compact clock while retaining another-day wording", () => {
    expect(formatReferralIntakeTime(seededTime(742), target(), dayZero, 642)).toBe("12:22 AWST");
    expect(formatReferralIntakeTime(seededTime(1440 + 65), target(), dayZero, 642)).toBe("01:05 tomorrow AWST");
    expect(formatReferralIntakeTime(seededTime(-30), target(), dayZero, 642)).toBe("23:30 yesterday AWST");
  });

  it("keeps unmarked user dates absolute and accepts minute precision from the drawer", () => {
    expect(formatReferralIntakeTime("2026-08-15T12:42+08:00", {}, dayZero)).toBe("15 Aug 2026, 12:42 AWST");
    expect(formatReferralIntakeTime("2026-10-25T04:42:00.000Z", {}, dayZero)).toBe("25 Oct 2026, 12:42 AWST");
  });

  it("rejects malformed provenance and impossible dates rather than guessing a date or time zone", () => {
    const malformed = [
      "2026-02-30T00:00:00+08:00",
      "2026-10-24",
      "2026-10-24T00:00:00",
      "2026-10-24T12:00:00+08:00",
      "not-a-time",
    ];
    for (const base of malformed) {
      expect(isSyntheticReferralTimelineBase(base), base).toBe(false);
      expect(formatReferralIntakeTime(seededTime(65), { syntheticTimelineBase: base }, dayZero)).toBe(
        "Time not recorded",
      );
    }
    for (const raw of [undefined, "", "invalid", "2026-02-30T12:00:00+08:00", "2026-10-24T12:00"])
      expect(formatReferralIntakeTime(raw, {}, dayZero)).toBe("Time not recorded");
    expect(formatReferralIntakeTime(seededTime(65), target(), new Date("invalid"))).toBe("Time not recorded");
  });

  it("validates each target marker and preserves both through actual JSON restore validation", () => {
    const state = seedWardFlowState();
    const referral = state.referrals[0]!;
    const intake = {
      ...referral.intake!,
      medicalClearance: { ...referral.intake!.medicalClearance, ...target() },
      arrival: {
        transport: "Synthetic transport",
        reference: "Demo plan",
        estimatedAt: seededTime(1440 + 65),
        ...target(),
      },
    };
    referral.intake = intake;
    expect(referralIntakeError(intake)).toBeNull();
    const restored = JSON.parse(JSON.stringify(state));
    expect(isValidStoredWardFlowState(restored)).toBe(true);
    expect(restored.referrals[0].intake.medicalClearance.syntheticTimelineBase).toBe(seededReferralTimelineBase());
    expect(restored.referrals[0].intake.arrival.syntheticTimelineBase).toBe(seededReferralTimelineBase());
    expect(
      formatReferralIntakeTime(
        restored.referrals[0].intake.arrival.estimatedAt,
        restored.referrals[0].intake.arrival,
        dayZero,
      ),
    ).toBe("25 Oct 2026, 01:05 AWST");
    expect(
      referralIntakeError({
        ...intake,
        medicalClearance: { ...intake.medicalClearance, syntheticTimelineBase: "2026-10-24T01:00:00+08:00" },
      }),
    ).toBe("Check the synthetic medical review timeline.");
    expect(referralIntakeError({ ...intake, arrival: { ...intake.arrival, syntheticTimelineBase: "bad" } })).toBe(
      "Check the synthetic arrival timeline.",
    );
    restored.referrals[0].intake.medicalClearance.syntheticTimelineBase = "bad";
    expect(isValidStoredWardFlowState(restored)).toBe(false);
  });
});
