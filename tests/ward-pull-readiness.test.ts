import { describe, expect, it } from "vitest";

import { bedsPendingPreparation, openBedsNow } from "../src/components/ward-management/ward-bed-availability";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { BedRelease, Unit } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/*
 * WHY THIS FILE EXISTS. Owner ruling, 2026-09-01: "A pull cannot occur unless the bed is actually
 * available and open, not pending (i.e. being cleaned)." Josh replaced it on 13 Nov 2026 (D-181
 * item 5, with D-179 item 8): a bed being made ready is no longer counted as Ready, is shown on its
 * own, and MAY STILL BE PULLED. Every assertion below is about the state transition, not a label.
 */

function seeded() {
  return seedWardFlowState();
}

function unitOf(state: WardFlowState, id: string): Unit {
  const found = state.units.find((candidate: Unit) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

/** A movement accepted at a unit and standing at the exact stage a pull acts on. */
function acceptedAt(unitId: string, movementId: string): WardFlowState {
  let state = seeded();
  state = wardFlowReducer(state, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now: NOW,
    movementId,
    unitIds: [unitId],
  });
  state = wardFlowReducer(state, {
    type: "ACCEPT_IN_PRINCIPLE",
    role: "ward",
    now: NOW,
    movementId,
    unitId,
    actingUnitId: unitId,
  });
  return state;
}

/** Every free bed at this unit recorded as discharged and still being made ready. */
function allFreeBedsBeingPrepared(state: WardFlowState, unitId: string): WardFlowState {
  const unit = unitOf(state, unitId);
  const free = Math.min(unit.allocatable.value, unit.empty.value);
  const prepared: BedRelease[] = Array.from({ length: free }, (_unused, index) => ({
    id: `BR-PREP-${index}`,
    unitId,
    admissionId: `AD-TEST-PREP-${index}`,
    state: "discharged",
    expectedAt: NOW,
    waitingOn: null,
    blocker: null,
    // Required alongside `blocker`. Vitest never noticed it missing - it runs no typecheck, so this
    // file was green and uncompilable at the same time.
    blockedBy: null,
    preparing: true,
    preparationNote: "Being cleaned",
    confirmedAt: NOW,
    confirmedBy: "Ward",
  }));
  return { ...state, bedReleases: [...state.bedReleases, ...prepared] };
}

describe("a bed being made ready may still be pulled (D-181 item 5)", () => {
  const UNIT = "rph-adult-secure";
  const MOVEMENT = "WF-009";

  it("pulls normally when the free bed is open", () => {
    const state = acceptedAt(UNIT, MOVEMENT);
    // Non-vacuity: the case below must fail for READINESS, not because there was never a bed.
    expect(openBedsNow(unitOf(state, UNIT), state.bedReleases)).toBeGreaterThan(0);

    const next = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId: MOVEMENT,
      unitId: UNIT,
      actingUnitId: UNIT,
    });

    expect(next.rejections).toHaveLength(0);
    expect(next.movements.find((m) => m.id === MOVEMENT)?.stage).toBe("pulled");
  });

  it("PULLS when every free bed is still being made ready (D-181 item 5)", () => {
    const state = allFreeBedsBeingPrepared(acceptedAt(UNIT, MOVEMENT), UNIT);
    const unit = unitOf(state, UNIT);
    // Non-vacuity: every free bed is being made ready, so none is Ready.
    expect(bedsPendingPreparation(UNIT, state.bedReleases)).toBeGreaterThan(0);
    expect(openBedsNow(unit, state.bedReleases)).toBe(0);

    const next = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId: MOVEMENT,
      unitId: UNIT,
      actingUnitId: UNIT,
    });

    expect(next.rejections).toHaveLength(0);
    expect(next.movements.find((m) => m.id === MOVEMENT)?.stage).toBe("pulled");
  });

  it("lets a coordinator pull into a bed being made ready too", () => {
    const state = allFreeBedsBeingPrepared(acceptedAt(UNIT, MOVEMENT), UNIT);

    const next = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "coordinator",
      now: NOW,
      movementId: MOVEMENT,
      unitId: UNIT,
    });

    expect(next.rejections).toHaveLength(0);
    expect(next.movements.find((m) => m.id === MOVEMENT)?.stage).toBe("pulled");
  });

  it("lets a coordinator pull when the bed IS open, so the widened role actually works", () => {
    const state = acceptedAt(UNIT, MOVEMENT);

    const next = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "coordinator",
      now: NOW,
      movementId: MOVEMENT,
      unitId: UNIT,
    });

    expect(next.rejections).toHaveLength(0);
    expect(next.movements.find((m) => m.id === MOVEMENT)?.stage).toBe("pulled");
  });
});
