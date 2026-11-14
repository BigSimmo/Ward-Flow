import { describe, expect, it } from "vitest";

import { acceptedWardOf } from "@/components/ward-management/referrals/accepted-awaiting-pull";
import { referralEligibility } from "@/components/ward-management/ward-eligibility";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardReferralDestination } from "@/components/ward-management/ward-model";
import { STEP_BACK_REASONS } from "@/components/ward-management/ward-model-vocabulary";
import { acceptedReferralIdsAt } from "@/components/ward-management/ward-ready-bed-promises";
import { acceptedAddressing, referralState } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * H3 (mechanics and clock audit, 14 Nov 2026): withdrawing a ward's acceptance moved the journey
 * back to destination review but left the referral saying "Accepted at <ward>". If another ward then
 * accepted, the journey named the new ward and the referral the old one, and every ward answering
 * the referral was refused as "already accepted elsewhere". Now the referral's answer at the
 * withdrawn ward moves out of "accepted" in the same step. Synthetic seed data only; the setup is
 * the reviewer's (`placement/zz-audit-placement-withdraw.test.ts`, RF-005).
 */
const refusals = (before: WardFlowState, after: WardFlowState) =>
  after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);

const seed = seedWardFlowState("standard");
let referral = seed.referrals[0]!;
let wardArm: WardReferralDestination | undefined;
let wards: typeof seed.units = [];
for (const candidate of seed.referrals) {
  const arm = candidate.destinations.find(
    (each) =>
      each.destination.kind === "psychiatric_ward" &&
      each.state === "queued" &&
      each.withdrawnAt === undefined &&
      each.destination.unitId === undefined,
  );
  if (!arm || arm.destination.kind !== "psychiatric_ward") continue;
  const destination = arm.destination;
  const fits = seed.units.filter((unit) => referralEligibility(candidate, destination, unit, NOW_ANCHOR).eligible);
  const template = seed.movements.find(
    (movement) =>
      !movement.closure &&
      movement.stage === "placement_requested" &&
      !movement.acceptedUnitId &&
      movement.cohort === candidate.ageBand,
  );
  if (fits.length >= 2 && template) {
    referral = candidate;
    wardArm = destination;
    wards = fits;
    break;
  }
}
const [first, second] = wards;

// Ward A accepts the referral, and the bed request is raised from it (as RAISE_REFERRAL builds one).
const accepted = wardFlowReducer(seed, {
  type: "ACCEPT_REFERRAL",
  role: "coordinator",
  now: NOW_ANCHOR,
  referralId: referral.id,
  destinationKind: "psychiatric_ward",
  unitId: first?.id,
} as Parameters<typeof wardFlowReducer>[1]);
const template = accepted.movements.find(
  (movement) =>
    !movement.closure &&
    movement.stage === "placement_requested" &&
    !movement.acceptedUnitId &&
    movement.cohort === referral.ageBand,
)!;
const journey = {
  ...template,
  id: "WF-MCA-H3",
  referralId: referral.id,
  stage: "accepted_awaiting_bed" as const,
  acceptedUnitId: first?.id,
  acceptedAt: NOW_ANCHOR,
  referredUnitIds: [],
  declines: [],
  admissionId: undefined,
};
const raised: WardFlowState = { ...accepted, movements: [...accepted.movements, journey] };
const WITHDRAWN_AT = NOW_ANCHOR + 2;
const withdrawn = wardFlowReducer(raised, {
  type: "WITHDRAW_ACCEPTANCE",
  role: "coordinator",
  now: WITHDRAWN_AT,
  movementId: journey.id,
  reason: STEP_BACK_REASONS[0],
});
const after = withdrawn.referrals.find((each) => each.id === referral.id)!;

describe("H3: withdrawing a ward's acceptance moves the referral's answer too", () => {
  it("reaches the case: a ward referral accepted at ward A with a journey raised from it", () => {
    expect(wardArm, "a queued 'any ward' referral with two fitting wards").toBeDefined();
    expect(refusals(seed, accepted)).toEqual([]);
    expect(
      acceptedWardOf(
        accepted.referrals.find((each) => each.id === referral.id)!,
        accepted.units,
      )?.unitId,
    ).toBe(first?.id);
  });

  it("the referral no longer says ward A accepted", () => {
    expect(refusals(raised, withdrawn)).toEqual([]);
    expect(withdrawn.movements.find((each) => each.id === journey.id)?.stage).toBe("destination_review");
    expect(referralState(after)).not.toBe("accepted");
    expect(acceptedAddressing(after)).toBeUndefined();
    expect(acceptedWardOf(after, withdrawn.units)).toBeUndefined();
    expect(acceptedReferralIdsAt(withdrawn.referrals, first!.id)).not.toContain(referral.id);
  });

  it("stamps the reopened answer with the withdrawal time and drops the old answer's fields", () => {
    const arm = after.destinations.find((each) => each.destination.kind === "psychiatric_ward")!;
    expect(arm.state).toBe("queued");
    expect(arm.referredAt).toBe(WITHDRAWN_AT);
    expect(arm.acceptedUnitId).toBeUndefined();
    expect(arm.decidedAt).toBeUndefined();
    expect(arm.decidedBy).toBeUndefined();
    expect(arm.heldBedNumber).toBeUndefined();
  });

  it("another ward accepting the journey leaves the referral naming no other ward", () => {
    const asked = wardFlowReducer(withdrawn, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR + 3,
      movementId: journey.id,
      unitIds: [second!.id],
    } as Parameters<typeof wardFlowReducer>[1]);
    const acceptedAgain = wardFlowReducer(asked, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "coordinator",
      now: NOW_ANCHOR + 4,
      movementId: journey.id,
      unitId: second!.id,
    } as Parameters<typeof wardFlowReducer>[1]);
    expect(refusals(withdrawn, acceptedAgain)).toEqual([]);
    expect(acceptedAgain.movements.find((each) => each.id === journey.id)?.acceptedUnitId).toBe(second!.id);
    expect(
      acceptedWardOf(
        acceptedAgain.referrals.find((each) => each.id === referral.id)!,
        acceptedAgain.units,
      ),
    ).toBe(undefined);
  });

  it("a ward answering the referral is no longer refused as 'already accepted elsewhere'", () => {
    const answered = wardFlowReducer(withdrawn, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW_ANCHOR + 4,
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      unitId: second!.id,
    } as Parameters<typeof wardFlowReducer>[1]);
    const reasons = refusals(withdrawn, answered);
    expect(reasons.some((reason) => reason.includes("already been accepted elsewhere"))).toBe(false);
    // While the journey is open it is the live record, so the ward answers there instead.
    expect(reasons.some((reason) => reason.includes("already has an open movement"))).toBe(true);
  });
});
