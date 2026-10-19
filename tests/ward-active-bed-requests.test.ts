import { describe, expect, it } from "vitest";

import type { Referral } from "../src/components/ward-management/ward-model";
import { referrals } from "../src/components/ward-management/ward-movements";
import { activeBedRequestsFor, isAwaitingAnswer } from "../src/components/ward-management/ward-referrals";

/**
 * Audit F-19 (19 Oct 2026): success measure 2 counts "the same patient with two active bed
 * requests at once". `activeBedRequestsFor` finds a person's referrals with a bed arm still
 * awaiting an answer, so a second request can be pointed out (never refused).
 */
const open = referrals.find(
  (referral) =>
    referral.patientId !== undefined &&
    referral.destinations.some(
      (addressing) => addressing.destination.kind !== "community_team" && isAwaitingAnswer(addressing),
    ),
);
if (!open?.patientId) throw new Error("the seed has no named referral awaiting a bed answer");

describe("a person's active bed requests", () => {
  it("finds a named referral whose bed arm still awaits an answer", () => {
    expect(activeBedRequestsFor(referrals, open.patientId).map((r) => r.id)).toContain(open.id);
  });

  it("finds nothing for an unnamed person", () => {
    expect(activeBedRequestsFor(referrals, undefined)).toEqual([]);
  });

  it("leaves out a referral once every bed arm is answered or withdrawn", () => {
    const answered: Referral = {
      ...open,
      destinations: open.destinations.map((addressing) => ({ ...addressing, state: "declined" as const })),
    };
    expect(activeBedRequestsFor([answered], open.patientId)).toEqual([]);
  });
});
