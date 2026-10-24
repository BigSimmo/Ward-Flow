import { describe, expect, it } from "vitest";
import { deriveBedCapacityTone } from "@/components/ward-management/capacity/service-capacity-tracker";
import { declinesByReason } from "@/components/ward-management/statistics/statistics-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

function movement(overrides: Partial<Movement>): Movement {
  return { ...seedWardFlowState().movements[0], declines: [], referralAnswerHistory: [], ...overrides };
}

describe("audit metrics boundary regressions", () => {
  it.each([
    [10000, 1004, "green", 90],
    [10000, 504, "yellow", 95],
    [10000, 204, "red", 98],
    [10000, 1000, "yellow", 90],
    [10000, 500, "red", 95],
    [10000, 200, "black", 98],
    [10, 1, "black", 90],
  ] as const)("R04 classifies %i beds with %i free before rounding", (beds, free, code, displayed) => {
    expect(deriveBedCapacityTone(beds, free)).toMatchObject({ code, occupancyPercent: displayed });
  });

  it.each(["no_suitable_bed", "bed_pulled_for_earlier_referral"] as const)(
    "R09 excludes the %s waitlist alias from decline totals and movement counts",
    (reason) => {
      const waitlisted = movement({
        declines: [{ unitId: "ward-a", at: 10, reason }],
        referralAnswerHistory: [{ unitId: "ward-a", at: 10, answer: "waitlisted" }],
      });
      const result = declinesByReason([waitlisted]);
      expect(result.totalCount).toBe(0);
      expect(result.movementsWithDeclinesCount).toBe(0);
      expect(result.tallies.find((row) => row.reason === reason)?.count).toBe(0);
      expect(result.movementCount).toBe(1);
    },
  );

  it("R09 retains real declines, including earlier answers after a later waitlist", () => {
    const result = declinesByReason([
      movement({
        declines: [
          { unitId: "ward-a", at: 1, reason: "no_suitable_bed" },
          { unitId: "ward-a", at: 2, reason: "no_suitable_bed" },
        ],
        referralAnswerHistory: [
          { unitId: "ward-a", at: 1, answer: "declined" },
          { unitId: "ward-a", at: 2, answer: "waitlisted" },
        ],
      }),
    ]);
    expect(result.totalCount).toBe(1);
    expect(result.movementsWithDeclinesCount).toBe(1);
  });
});

it("R09 preserves ambiguous legacy no-bed records and genuine refusals", () => {
  const result = declinesByReason([
    movement({ declines: [{ unitId: "ward-a", at: 1, reason: "no_suitable_bed" }], referralAnswerHistory: undefined }),
    movement({
      declines: [{ unitId: "ward-b", at: 2, reason: "capability_mismatch" }],
      referralAnswerHistory: [{ unitId: "ward-b", at: 2, answer: "declined" }],
    }),
  ]);
  expect(result.totalCount).toBe(2);
  expect(result.movementsWithDeclinesCount).toBe(2);
});
