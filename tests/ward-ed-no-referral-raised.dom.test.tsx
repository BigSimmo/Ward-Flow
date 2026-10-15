import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { movementReferralLink } from "@/components/ward-management/ward-derivations";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { edScreenSource } from "./helpers/ed-screen-source";

const NOW = NOW_ANCHOR;

function findUnlinkedOpenMovement() {
  const state = seedWardFlowState();
  const movement = state.movements.find(
    (candidate) =>
      candidate.referralId === undefined && candidate.referralAbsence === undefined && candidate.closure === undefined,
  );
  if (!movement) {
    throw new Error("seed has no open movement without a referralId to exercise RECORD_NO_REFERRAL");
  }
  return { state, movementId: movement.id };
}

describe("recording that nobody raised a referral", () => {
  it("starts unrecorded, which is not the same as none_raised", () => {
    const { state, movementId } = findUnlinkedOpenMovement();
    const movement = state.movements.find((candidate) => candidate.id === movementId)!;
    expect(movementReferralLink(movement, state.referrals).kind).toBe("not_recorded");
  });

  it("records none_raised that the screen can read back", () => {
    const { state, movementId } = findUnlinkedOpenMovement();
    const after = wardFlowReducer(state, {
      type: "RECORD_NO_REFERRAL",
      role: "ed",
      now: NOW,
      movementId,
    });
    const movement = after.movements.find((candidate) => candidate.id === movementId)!;
    expect(movementReferralLink(movement, after.referrals).kind).toBe("none_raised");
    expect(after.rejections).toHaveLength(0);
  });

  it("the ED board carries the control that dispatches it", () => {
    // The screen is split across `ed-screen.tsx` and its sibling files (fix list 2.5 and 9.6,
    // 15 Oct 2026); `edScreenSource()` reads all of them, so this still pins the control to the
    // ED screen as a whole.
    const source = edScreenSource();
    expect(source).toContain("ward-ed-no-referral-raised-");
    expect(source).toContain('raise("RECORD_NO_REFERRAL"');
    expect(source).toContain("No referral raised");
  });
});
