// Time audit T-9 and mechanics and clock audit (14 Nov 2026), D-210 (Josh, 14 Nov 2026): the ward's
// "Leave bed open" notice names the day of the expected return, which is often days away, instead of
// a bare clock face that reads as today. Synthetic data only.
import { describe, expect, it } from "vitest";

import { wardLiveFormAlerts } from "@/components/ward-management/ward/ward-screen-derivations";
import {
  DEFAULT_DUE_SOON_THRESHOLDS,
  formatInstantWithDay,
  MINUTES_PER_DAY,
} from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { LeaveBed } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seed = seedWardFlowState();
const unit = seed.units[0]!;
const NOW = NOW_ANCHOR;

const leaveBed = (expectedReturn: number) =>
  ({
    id: "LB-SYNTH-1",
    unitId: unit.id,
    admissionId: "ADM-SYNTH-1",
    confirmedAt: NOW - 2 * MINUTES_PER_DAY,
    expectedReturn,
  }) as unknown as LeaveBed;

const noticeText = (expectedReturn: number) =>
  wardLiveFormAlerts({
    resolvePatientIdentity: () => ({ formalName: "SYNTHETIC, Person" }) as never,
    accepted: [],
    now: NOW,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    overdueLeaveBeds: [leaveBed(expectedReturn)],
    unit,
  }).liveFormAlerts.find((alert) => alert.key === "leave-LB-SYNTH-1")!.text; // gitleaks:allow

describe("the leave bed notice names the day of the expected return", () => {
  it("says the day for a return two days away, never a bare clock face", () => {
    const returnAt = NOW + 2 * MINUTES_PER_DAY;
    const withDay = formatInstantWithDay(returnAt, NOW);
    expect(withDay).not.toMatch(/^\d\d:\d\d$/);
    expect(noticeText(returnAt)).toContain(`Expected return ${withDay}.`);
  });

  it("uses the same words as every other day-named time for a return later today", () => {
    const returnAt = NOW + 60;
    expect(noticeText(returnAt)).toContain(`Expected return ${formatInstantWithDay(returnAt, NOW)}.`);
  });
});
