// tests/ward-declined-by-all-precedence.test.ts
//
// WF-23: an accepted movement carrying an earlier decline read as "declined by all".
//
// `handoverSnapshot`'s `declinedByAll` filter (ward-derivations.ts) used to class a movement as
// declined by all whenever it was open, not escalated, had no live referrals, and carried at
// least one decline. `ACCEPT_IN_PRINCIPLE` (ward-flow-reducer.ts) also empties `referredUnitIds`
// the instant a unit says yes — that is the whole of what "no live referrals" ever meant on the
// happy path too — so a movement referred to two wards, declined by the first and accepted by
// the second, satisfied the same two conditions and was reported as refused by the entire
// network on the handover page and in the statistics figure it feeds
// (statistics-derivations.ts's `refusedAndNothingPending`).
import { describe, expect, it } from "vitest";

import { handoverSnapshot, isOpen } from "../src/components/ward-management/ward-derivations";
import {
  seedWardFlowState,
  STAGE_TRANSITION_BLOCKERS,
  wardFlowReducer,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { refusedAndNothingPending } from "../src/components/ward-management/statistics/statistics-derivations";

const NOW = NOW_ANCHOR;

// Cohort/security/sex profile copied from the seeded movement WF-009, which this suite's sibling
// (tests/ward-flow-reducer.test.ts) already proves is referable to, and acceptable at, both
// rph-adult-secure and fsh-adult-secure with zero rejections — so this is a known-eligible
// combination for these two units, not a guess.
const DRAFT = {
  cohort: "Adult",
  security: "Secure",
  sex: "Male",
  // T11 (item 8, owner answer 17 September 2026): gender must be recorded at intake before a
  // referral can reach a single-gender ward — fsh-adult-secure is male-only. Matches `sex` above,
  // the same known-eligible combination this fixture already relies on.
  gender: "Male",
  specialling: false,
  highAcuity: false,
  legalStatus: "Voluntary",
  urgency: 2,
  legalFormCode: null,
} as const;

function raiseJourney(state: ReturnType<typeof seedWardFlowState>) {
  return wardFlowReducer(state, {
    type: "RAISE_REFERRAL",
    role: "ed",
    now: NOW,
    edId: "jhc-ed",
    draft: DRAFT,
  });
}

function findMovement(state: ReturnType<typeof seedWardFlowState>, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing ${id}`);
  return found;
}

describe("WF-23: declined-by-all precedence against acceptance", () => {
  it("A declines, B accepts in principle: no rejections, one decline kept, the movement is not declined-by-all, and the statistics count is unchanged", () => {
    const seeded = seedWardFlowState();
    const before = refusedAndNothingPending(seeded.movements, seeded.units, NOW);

    const raised = raiseJourney(seeded);
    expect(raised.rejections).toHaveLength(0);
    const movementId = raised.movements[raised.movements.length - 1].id;

    let state = wardFlowReducer(raised, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId,
      unitIds: ["rph-adult-secure", "fsh-adult-secure"],
    });
    expect(state.rejections).toHaveLength(0);
    expect(findMovement(state, movementId).referredUnitIds.sort()).toEqual(
      ["fsh-adult-secure", "rph-adult-secure"].sort(),
    );

    // Ward A has no bed: that waitlists, it does not end the referral.
    state = wardFlowReducer(state, {
      type: "DECLINE",
      role: "ward",
      now: NOW,
      movementId,
      unitId: "rph-adult-secure",
      reason: "no_bed",
    });
    expect(state.rejections).toHaveLength(0);
    expect(findMovement(state, movementId).referredUnitIds.sort()).toEqual(
      ["fsh-adult-secure", "rph-adult-secure"].sort(),
    );
    expect(findMovement(state, movementId).waitlistedUnitIds).toEqual(["rph-adult-secure"]);

    // Ward B accepts in principle — the earlier waitlist/decline from A stays on the record.
    state = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId,
      unitId: "fsh-adult-secure",
    });
    expect(state.rejections).toHaveLength(0);

    const movement = findMovement(state, movementId);
    expect(movement.declines).toHaveLength(1);
    expect(movement.declines[0].unitId).toBe("rph-adult-secure");
    expect(movement.acceptedUnitId).toBe("fsh-adult-secure");
    expect(movement.referredUnitIds).toHaveLength(0);
    expect(isOpen(movement)).toBe(true);

    const snapshot = handoverSnapshot(state.movements, state.units, NOW);
    expect(snapshot.placementGoneWrong.map((entry) => entry.movement.id)).not.toContain(movementId);

    const after = refusedAndNothingPending(state.movements, state.units, NOW);
    expect(after.count).toBe(before.count);
  });

  // Item 20 / owner decision 2026-09-17 (WF-R2): a referral or movement whose only acceptance was
  // later withdrawn is not "declined by all". `WITHDRAW_ACCEPTANCE` clears `acceptedUnitId`
  // without reviving `referredUnitIds` (owner ruling 3 of 2026-09-04), which is exactly the same
  // shape the earlier `ACCEPT_IN_PRINCIPLE` bug (WF-23, the test above) left behind — so the same
  // three-clause reading misclassified a withdrawal as a network-wide refusal.
  it("A declines, B accepts, the acceptance is withdrawn: reads acceptance_withdrawn, not counted, until a fresh decline lands", () => {
    const seeded = seedWardFlowState();
    const before = refusedAndNothingPending(seeded.movements, seeded.units, NOW);

    const raised = raiseJourney(seeded);
    expect(raised.rejections).toHaveLength(0);
    const movementId = raised.movements[raised.movements.length - 1].id;

    let state = wardFlowReducer(raised, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId,
      unitIds: ["rph-adult-secure", "fsh-adult-secure"],
    });
    expect(state.rejections).toHaveLength(0);

    // Ward A declines.
    state = wardFlowReducer(state, {
      type: "DECLINE",
      role: "ward",
      now: NOW,
      movementId,
      unitId: "rph-adult-secure",
      reason: "no_bed",
    });
    expect(state.rejections).toHaveLength(0);

    // Ward B accepts in principle.
    state = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId,
      unitId: "fsh-adult-secure",
    });
    expect(state.rejections).toHaveLength(0);
    expect(findMovement(state, movementId).stage).toBe("accepted_awaiting_bed");

    // The coordinator withdraws B's acceptance. This is a record correction, not the network
    // refusing the movement, and the target behaviour is that it must not read as one.
    state = wardFlowReducer(state, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      now: NOW + 1,
      movementId,
      reason: "the_decision_changed",
    });
    expect(state.rejections).toHaveLength(0);

    const withdrawnMovement = findMovement(state, movementId);
    expect(withdrawnMovement.acceptedUnitId).toBeUndefined();
    expect(withdrawnMovement.referredUnitIds).toHaveLength(0);
    expect(withdrawnMovement.declines).toHaveLength(1);

    const withdrawnSnapshot = handoverSnapshot(state.movements, state.units, NOW + 1);
    const withdrawnEntry = withdrawnSnapshot.placementGoneWrong.find(
      (candidate) => candidate.movement.id === movementId,
    );
    expect(withdrawnEntry?.kind).toBe("acceptance_withdrawn");

    // Not counted as declined-by-all in the statistics figure it feeds.
    const afterWithdrawal = refusedAndNothingPending(state.movements, state.units, NOW + 1);
    expect(afterWithdrawal.count).toBe(before.count);

    // A fresh referral to C (reusing an eligible unit id — the point under test is the timing of
    // ITS decline against the withdrawal, not which unit), who also declines: the network has
    // been refused again since the withdrawal, so this reads declined-by-all once more.
    state = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW + 2,
      movementId,
      unitIds: ["rph-adult-secure"],
    });
    expect(state.rejections).toHaveLength(0);

    state = wardFlowReducer(state, {
      type: "DECLINE",
      role: "ward",
      now: NOW + 3,
      movementId,
      unitId: "rph-adult-secure",
      reason: "out_of_catchment",
    });
    expect(state.rejections).toHaveLength(0);

    const redeclinedMovement = findMovement(state, movementId);
    expect(redeclinedMovement.acceptedUnitId).toBeUndefined();
    expect(redeclinedMovement.referredUnitIds).toHaveLength(0);
    expect(redeclinedMovement.declines).toHaveLength(2);

    const finalSnapshot = handoverSnapshot(state.movements, state.units, NOW + 3);
    const finalEntry = finalSnapshot.placementGoneWrong.find((candidate) => candidate.movement.id === movementId);
    expect(finalEntry?.kind).toBe("declined_by_all");

    const afterRedecline = refusedAndNothingPending(state.movements, state.units, NOW + 3);
    expect(afterRedecline.count).toBe(before.count + 1);
  });

  it("positive control: A and B both decline — the movement IS declined-by-all", () => {
    const seeded = seedWardFlowState();
    const raised = raiseJourney(seeded);
    expect(raised.rejections).toHaveLength(0);
    const movementId = raised.movements[raised.movements.length - 1].id;

    let state = wardFlowReducer(raised, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId,
      unitIds: ["rph-adult-secure", "fsh-adult-secure"],
    });
    expect(state.rejections).toHaveLength(0);

    state = wardFlowReducer(state, {
      type: "DECLINE",
      role: "ward",
      now: NOW,
      movementId,
      unitId: "rph-adult-secure",
      reason: "out_of_catchment",
    });
    expect(state.rejections).toHaveLength(0);

    state = wardFlowReducer(state, {
      type: "DECLINE",
      role: "ward",
      now: NOW,
      movementId,
      unitId: "fsh-adult-secure",
      reason: "out_of_catchment",
    });
    expect(state.rejections).toHaveLength(0);

    const movement = findMovement(state, movementId);
    expect(movement.acceptedUnitId).toBeUndefined();
    expect(movement.referredUnitIds).toHaveLength(0);
    expect(movement.declines).toHaveLength(2);

    const snapshot = handoverSnapshot(state.movements, state.units, NOW);
    const entry = snapshot.placementGoneWrong.find((candidate) => candidate.movement.id === movementId);
    expect(entry?.kind).toBe("declined_by_all");
    // Finding 2 (2026-09-17 review): the LAST decline emptied `referredUnitIds` with nothing
    // accepted, so the blocker must stop claiming a destination is still being asked
    // (`STAGE_TRANSITION_BLOCKERS.referred`, "Awaiting destination response") and instead read the
    // same "nothing is currently asking" sentence `WITHDRAW_WARD_REQUEST` already writes for the
    // identical shape (no live request, nothing accepted, still open).
    expect(movement.blocker).toBe(STAGE_TRANSITION_BLOCKERS.wardRequestWithdrawn);
  });

  it("finding 2: a decline that is NOT the last live request leaves the blocker unchanged", () => {
    const seeded = seedWardFlowState();
    const raised = raiseJourney(seeded);
    expect(raised.rejections).toHaveLength(0);
    const movementId = raised.movements[raised.movements.length - 1].id;

    let state = wardFlowReducer(raised, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId,
      unitIds: ["rph-adult-secure", "fsh-adult-secure"],
    });
    expect(state.rejections).toHaveLength(0);
    expect(findMovement(state, movementId).blocker).toBe(STAGE_TRANSITION_BLOCKERS.referred);

    // Ward A declines; ward B's referral is still live, so the blocker must still say a
    // destination response is outstanding — this is not the last live request.
    state = wardFlowReducer(state, {
      type: "DECLINE",
      role: "ward",
      now: NOW,
      movementId,
      unitId: "rph-adult-secure",
      reason: "out_of_catchment",
    });
    expect(state.rejections).toHaveLength(0);
    const movement = findMovement(state, movementId);
    expect(movement.referredUnitIds).toEqual(["fsh-adult-secure"]);
    expect(movement.blocker).toBe(STAGE_TRANSITION_BLOCKERS.referred);
  });

  it("no_bed and bed_pulled_for_earlier_referral waitlist; they do not empty the referral", () => {
    const seeded = seedWardFlowState();
    const raised = raiseJourney(seeded);
    expect(raised.rejections).toHaveLength(0);
    const movementId = raised.movements[raised.movements.length - 1].id;

    let state = wardFlowReducer(raised, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId,
      unitIds: ["rph-adult-secure", "fsh-adult-secure"],
    });
    expect(state.rejections).toHaveLength(0);

    state = wardFlowReducer(state, {
      type: "DECLINE",
      role: "ward",
      now: NOW,
      movementId,
      unitId: "rph-adult-secure",
      reason: "no_bed",
    });
    expect(state.rejections).toHaveLength(0);
    expect(findMovement(state, movementId).referredUnitIds).toContain("rph-adult-secure");
    expect(findMovement(state, movementId).waitlistedUnitIds).toEqual(["rph-adult-secure"]);

    state = wardFlowReducer(state, {
      type: "DECLINE",
      role: "ward",
      now: NOW,
      movementId,
      unitId: "fsh-adult-secure",
      reason: "bed_pulled_for_earlier_referral",
    });
    expect(state.rejections).toHaveLength(0);
    const movement = findMovement(state, movementId);
    expect(movement.referredUnitIds.sort()).toEqual(["fsh-adult-secure", "rph-adult-secure"].sort());
    expect(movement.waitlistedUnitIds?.sort()).toEqual(["fsh-adult-secure", "rph-adult-secure"].sort());
    expect(movement.closure).toBeUndefined();

    const snapshot = handoverSnapshot(state.movements, state.units, NOW);
    expect(snapshot.placementGoneWrong.find((entry) => entry.movement.id === movementId)?.kind).not.toBe(
      "declined_by_all",
    );
  });
});
