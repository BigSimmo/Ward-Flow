import { describe, expect, it } from "vitest";

import { edWaitingSeries } from "@/components/ward-management/ed/ed-home-derivations";
import { edJourneyStages } from "@/components/ward-management/ed/ed-journey";
import type { Movement } from "@/components/ward-management/ward-model";

/*
 * v10 pass 3 (All EDs RowSpark, ED page JourneyRibbon): both read only times the record holds.
 */
const base = { id: "WF-T", openedAt: 0 } as const;

describe("edJourneyStages", () => {
  it("stops recorded department time at collection, without a live tail", () => {
    const stages = edJourneyStages(
      {
        ...base,
        transport: { id: "TR-test", provider: "Patient transport service", escortRequired: false, collectedAt: 100 },
      },
      undefined,
      "In transit",
      500,
    );
    expect(stages.reduce((sum, item) => sum + item.minutes, 0)).toBe(100);
    expect(stages.some((item) => item.now)).toBe(false);
  });
  it("is one stage, 'In the department' up to now, when nothing else is recorded", () => {
    expect(edJourneyStages(base, undefined, "No bed yet", 95)).toEqual([
      { id: "WF-T-now", label: "In the department", minutes: 95, now: true },
    ]);
  });

  it("closes a stage at each recorded milestone, in time order, and names the last by where they are up to", () => {
    const stages = edJourneyStages(
      { ...base, examination: { at: 120, outcome: "inpatient_order" }, referredAt: 200 },
      { cleared: true, at: 60 },
      "Finding a ward",
      500,
    );
    expect(stages.map((stage) => [stage.label, stage.minutes])).toEqual([
      ["To clearance", 60],
      ["To review", 60],
      ["To referral", 80],
      ["Finding a ward", 300],
    ]);
    expect(stages.at(-1)?.now).toBe(true);
  });

  it("ignores a milestone timed before arrival or after now, and an uncleared clearance", () => {
    const stages = edJourneyStages(
      { ...base, openedAt: 100, referredAt: 50, acceptedAt: 900 },
      { cleared: false, at: 150 },
      "No bed yet",
      400,
    );
    expect(stages).toHaveLength(1);
    expect(stages[0].minutes).toBe(300);
  });
});

describe("edWaitingSeries", () => {
  const movement = (id: string, openedAt: number, extra: Partial<Movement> = {}) =>
    ({ id, originEdId: "arm-ed", openedAt, stage: "placement_requested", ...extra }) as Movement;

  it("leaves ward-origin journeys out and stops at collection before arrival", () => {
    expect(
      edWaitingSeries(
        [
          movement("ward", 0, { sourceAdmissionId: "AD-source" }),
          movement("collected", 0, {
            stage: "moving",
            transport: {
              id: "TR-test",
              provider: "Patient transport service",
              escortRequired: false,
              collectedAt: 150,
            },
          }),
        ],
        "arm-ed",
        300,
        300,
        100,
      ),
    ).toEqual([1, 1, 0, 0]);
  });

  it("counts who had opened and not yet closed at each 2 hour point over 12 hours", () => {
    const now = 1000;
    const series = edWaitingSeries(
      [
        movement("a", now - 700),
        movement("b", now - 300),
        movement("c", now - 650, { closure: { at: now - 100, outcome: "did_not_proceed", reason: "x" } }),
        movement("d", now - 500, { originEdId: "rph-ed" }),
        movement("e", now - 600, { stage: "arrived" }),
      ],
      "arm-ed",
      now,
    );
    // Points at now-720, -600, -480, -360, -240, -120, 0.
    expect(series).toEqual([0, 2, 2, 2, 3, 3, 2]);
  });
});
