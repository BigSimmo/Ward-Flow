// F-101 / K37 (13 Nov 2026): the patient page's Change beside "Not needed" records that transport
// is needed and offers Undo (UNDO_ED_STEP). A ward desk records it as the sending ward
// (actingUnitId), so the step's undo record is filed against that ward. The Undo must name the same
// ward, as the ward's other undo events do (UNDO_TRANSPORT_STEP), or the role check refuses it.
// No role gains a permission: a different ward is still refused. Synthetic records only.
import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/** An open seeded journey without a transport job, made to leave an occupied ward stay (a ward-to-ward move). */
function wardSentJourney(seed: WardFlowState): { state: WardFlowState; movementId: string; unitId: string } {
  const movement = seed.movements.find((candidate) => !candidate.closure && !candidate.transport);
  const stay = seed.admissions.find((admission) => admission.state === "occupied");
  if (!movement || !stay) throw new Error("the seed holds no open journey or no occupied stay");
  const sent = { ...movement, sourceAdmissionId: stay.id };
  return {
    state: { ...seed, movements: seed.movements.map((candidate) => (candidate.id === movement.id ? sent : candidate)) },
    movementId: movement.id,
    unitId: stay.unitId,
  };
}

function apply(state: WardFlowState, event: Record<string, unknown>): { next: WardFlowState; refused: boolean } {
  const next = wardFlowReducer(state, event as unknown as WardFlowEvent);
  return { next, refused: next.rejections.length > state.rejections.length };
}

describe("a ward desk's Undo of its own transport-need Change", () => {
  const { state: seed, movementId, unitId } = wardSentJourney(seedWardFlowState());
  const notNeeded = apply(seed, {
    type: "RECORD_TRANSPORT_NEED",
    role: "ward",
    now: NOW,
    movementId,
    actingUnitId: unitId,
    needed: false,
  });
  const changed = apply(notNeeded.next, {
    type: "RECORD_TRANSPORT_NEED",
    role: "ward",
    now: NOW + 1,
    movementId,
    actingUnitId: unitId,
    needed: true,
  });

  it("records the Change as the sending ward", () => {
    expect(notNeeded.refused).toBe(false);
    expect(changed.refused).toBe(false);
    expect(changed.next.movements.find((movement) => movement.id === movementId)?.transportNeed?.needed).toBe(true);
  });

  it("takes the Change back when the Undo names the same ward", () => {
    const undone = apply(changed.next, {
      type: "UNDO_ED_STEP",
      role: "ward",
      now: NOW + 2,
      movementId,
      actingUnitId: unitId,
    });
    expect(undone.refused).toBe(false);
    expect(undone.next.movements.find((movement) => movement.id === movementId)?.transportNeed?.needed).toBe(false);
  });

  it("still refuses an Undo that names no ward or another ward", () => {
    const unnamed = apply(changed.next, { type: "UNDO_ED_STEP", role: "ward", now: NOW + 2, movementId });
    expect(unnamed.refused).toBe(true);
    const other = seed.units.find((unit) => unit.id !== unitId)!.id;
    const otherWard = apply(changed.next, {
      type: "UNDO_ED_STEP",
      role: "ward",
      now: NOW + 2,
      movementId,
      actingUnitId: other,
    });
    expect(otherWard.refused).toBe(true);
    expect(otherWard.next.rejections.at(-1)?.reason ?? "").toMatch(/Only the ward that made this decision/u);
  });

  it("the coordinator may still take it back", () => {
    const undone = apply(changed.next, { type: "UNDO_ED_STEP", role: "coordinator", now: NOW + 2, movementId });
    expect(undone.refused).toBe(false);
  });
});
