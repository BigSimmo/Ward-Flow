import { expect, it } from "vitest";
import { shiftInstants } from "@/components/ward-management/ward-reanchor";

it("moves ISO review and arrival targets with referral instants, preserving intervals and non-time prose", () => {
  const original = {
    raisedAt: 120,
    history: "2026-08-15T02:00:00.000Z is written history, never rewritten",
    intake: {
      medicalClearance: {
        cleared: false,
        expectedAt: "2026-08-15T02:00:00.000Z",
        syntheticTimelineBase: "2026-08-15T00:00:00+08:00",
      },
      arrival: { estimatedAt: "2026-08-15T03:00:00.000Z", syntheticTimelineBase: "2026-08-15T00:00:00+08:00" },
    },
  };
  const before = structuredClone(original);
  for (const offset of [-180, 0, 300]) {
    const shifted = shiftInstants(original, offset);
    expect(shifted.raisedAt).toBe(original.raisedAt + offset);
    expect(Date.parse(shifted.intake.medicalClearance.expectedAt)).toBe(
      Date.parse(original.intake.medicalClearance.expectedAt) + offset * 60_000,
    );
    expect(Date.parse(shifted.intake.arrival.estimatedAt)).toBe(
      Date.parse(original.intake.arrival.estimatedAt) + offset * 60_000,
    );
    expect(shifted.history).toBe(original.history);
  }
  expect(original).toEqual(before);
});

it("does not shift absolute targets entered during a session", () => {
  const original = { intake: { medicalClearance: { expectedAt: "2026-10-24T12:00:00+08:00" } } };
  expect(shiftInstants(original, 300)).toEqual(original);
});
