import { describe, expect, it } from "vitest";
import {
  STAGE_TRANSITION_BLOCKERS,
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import type { ExaminationOutcome } from "@/components/ward-management/ward-model";
import { isExaminationAwaitingReleaseBlocker } from "@/components/ward-management/ward-examination-hold-up";

/**
 * F-15, D-170 item 3 (Josh, 13 Nov 2026): the hold-up an examination writes while transport is
 * committed says the outcome in the ruled words and never "revoked". A community treatment order is
 * an order, so it is named. The bed stays held either way (WLQ-4). Synthetic sample journey WF-005,
 * seeded at handover_ready with transport accepted.
 */
const NOW = 642;

function examine(outcome: ExaminationOutcome): WardFlowState {
  const next = wardFlowReducer(seedWardFlowState(), {
    type: "RECORD_EXAMINATION",
    role: "ed",
    now: NOW,
    movementId: "WF-005",
    outcome,
  });
  expect(next.rejections).toEqual([]);
  return next;
}

const blockerOf = (state: WardFlowState) => state.movements.find((m) => m.id === "WF-005")!.blocker;

describe("F-15: the examination hold-up wording", () => {
  it("a no-order outcome reads 'made no order', never 'revoked'", () => {
    const blocker = blockerOf(examine("revoked"));
    expect(blocker).toBe("Awaiting a coordinator to release the bed, because the examination made no order");
    expect(blocker).not.toMatch(/revok/i);
  });

  it("a community treatment order is named, and transport still cannot move on", () => {
    const next = examine("community_order");
    expect(blockerOf(next)).toBe(
      "Awaiting a coordinator to release the bed, because the examination made a community treatment order",
    );
    const enRoute = wardFlowReducer(next, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: NOW + 5,
      movementId: "WF-005",
    });
    expect(enRoute.rejections.at(-1)?.attempted).toBe("TRANSPORT_EN_ROUTE");
    const cleared = wardFlowReducer(next, {
      type: "CLEAR_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: NOW + 5,
      movementId: "WF-005",
    });
    expect(cleared.rejections.at(-1)?.attempted).toBe("CLEAR_MOVEMENT_BLOCKER");
    expect(blockerOf(cleared)).toBe(blockerOf(next));
  });

  it("no hold-up the engine writes says 'revoked'", () => {
    for (const sentence of Object.values(STAGE_TRANSITION_BLOCKERS)) expect(sentence).not.toMatch(/revok/i);
  });

  it("a record saved with the old words is still the same hold-up, so its bed stays held", () => {
    expect(
      isExaminationAwaitingReleaseBlocker(
        "Awaiting a coordinator to release the bed, because the examination was revoked",
      ),
    ).toBe(true);
    expect(isExaminationAwaitingReleaseBlocker(STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease)).toBe(true);
    expect(
      isExaminationAwaitingReleaseBlocker(STAGE_TRANSITION_BLOCKERS.examinationCommunityOrderAwaitingRelease),
    ).toBe(true);
    expect(isExaminationAwaitingReleaseBlocker("Awaiting destination response")).toBe(false);
    expect(isExaminationAwaitingReleaseBlocker(undefined)).toBe(false);
  });
});
