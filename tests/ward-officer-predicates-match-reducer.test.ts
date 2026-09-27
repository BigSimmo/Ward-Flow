import { describe, expect, it } from "vitest";

import {
  acceptedBlockedReason,
  arrivedBlockedReason,
  enRouteBlockedReason,
} from "../src/components/ward-management/officer/officer-screen";
import {
  seedWardFlowState,
  STAGE_TRANSITION_BLOCKERS,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Live walkthrough code-read, 25 September 2026. `ward-officer-blocked-reason-parity.test.ts` proves
 * one direction (a button the officer screen offers is never refused). These pin the OTHER
 * direction for the two gaps found: the officer screen must not refuse what the reducer accepts,
 * and must not offer what the reducer refuses.
 */
function withMovement(state: WardFlowState, id: string, patch: (movement: WardFlowState["movements"][number]) => void) {
  const next = structuredClone(state);
  patch(next.movements.find((movement) => movement.id === id)!);
  return next;
}

describe("officer transport predicates agree with the reducer", () => {
  it("lets a collected patient be delivered into a ward with no empty bed (reducer: bed turnaround)", () => {
    const seed = seedWardFlowState();
    const moving = seed.movements.find(
      (movement) => movement.stage === "moving" && movement.transport?.collectedAt !== undefined && !movement.closure,
    )!;
    expect(moving, "a seeded collected movement").toBeDefined();
    const state = structuredClone(seed);
    const unit = state.units.find((candidate) => candidate.id === moving.acceptedUnitId)!;
    unit.empty = { ...unit.empty, value: 0 };

    const movement = state.movements.find((candidate) => candidate.id === moving.id)!;
    expect(arrivedBlockedReason(movement, unit)).toBeUndefined();
    const after = wardFlowReducer(state, { type: "PATIENT_ARRIVED", role: "officer", now: NOW_ANCHOR, movementId: moving.id });
    expect(after.rejections).toHaveLength(state.rejections.length);
    expect(after.movements.find((candidate) => candidate.id === moving.id)!.stage).toBe("arrived");
  });

  it("does not offer Accepted or En route while the bed awaits release after a revoked examination", () => {
    const seed = seedWardFlowState();
    const ready = seed.movements.find(
      (movement) => movement.stage === "handover_ready" && movement.transport && !movement.closure,
    )!;
    expect(ready, "a seeded handover-ready movement with a transport job").toBeDefined();
    const blocker = STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;

    const notAccepted = withMovement(seed, ready.id, (movement) => {
      movement.blocker = blocker;
      movement.transport = { ...movement.transport!, acceptedAt: undefined };
    });
    const acceptMovement = notAccepted.movements.find((movement) => movement.id === ready.id)!;
    expect(acceptedBlockedReason(acceptMovement)).toBeDefined();
    const acceptAfter = wardFlowReducer(notAccepted, {
      type: "TRANSPORT_ACCEPTED",
      role: "officer",
      now: NOW_ANCHOR,
      movementId: ready.id,
    });
    expect(acceptAfter.rejections.length, "the reducer refuses it too").toBe(notAccepted.rejections.length + 1);

    const accepted = withMovement(seed, ready.id, (movement) => {
      movement.blocker = blocker;
      movement.transport = { ...movement.transport!, acceptedAt: NOW_ANCHOR - 5, enRouteAt: undefined };
    });
    const enRouteMovement = accepted.movements.find((movement) => movement.id === ready.id)!;
    expect(enRouteBlockedReason(enRouteMovement)).toBeDefined();
    const enRouteAfter = wardFlowReducer(accepted, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: NOW_ANCHOR,
      movementId: ready.id,
    });
    expect(enRouteAfter.rejections.length, "the reducer refuses it too").toBe(accepted.rejections.length + 1);
  });
});
