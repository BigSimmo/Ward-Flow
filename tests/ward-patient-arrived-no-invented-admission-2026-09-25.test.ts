import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Audit 2026-09-25 §3 items 2, 5, 6: `PATIENT_ARRIVED` used to invent an "AD-ARR-" admission for a
 * movement that had no `admissionId` — directly contradicting its own neighbouring comment ("an
 * absent admission is left exactly alone... fabricating one here would invent an occupant this
 * reducer never created"). The fabricated admission was locked (`bedKind: "locked"`) without ever
 * taking a locked bed through `PULL_PATIENT`, so `unit.allocatableLocked` was never decremented for
 * it — and when that phantom admission later departed, the discharge path DID increment
 * `allocatableLocked` (because `bedKind === "locked"`), so the free-locked count crept up by one
 * across an arrival-then-leaving pair that never should have touched it at all. It was also
 * back-dated (`pulledAt: movement.openedAt`) and started at discharge revision 1 despite never being
 * pulled.
 *
 * `WF-006` (RGH Adult Secure, `security: "Secure"`) is hand-authored at `stage: "moving"` with
 * transport already collected and no `admissionId` — exactly the specimen this branch used to
 * fabricate onto.
 */

const NOW = NOW_ANCHOR;
const TARGET = "WF-006";
const UNIT = "rgh-adult-secure";

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

function unit(state: WardFlowState, id: string) {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

describe("PATIENT_ARRIVED leaves an absent admission exactly alone (audit 2026-09-25 §3 items 2, 5, 6)", () => {
  it("anti-vacuity — the specimen really has no admissionId and is eligible to arrive", () => {
    const state = seedWardFlowState("standard");
    const found = movement(state, TARGET);
    expect(found.admissionId, `${TARGET} must start with no admissionId for this specimen to hold`).toBeUndefined();
    expect(found.stage).toBe("moving");
    expect(found.transport?.collectedAt).toBeDefined();
    expect(found.closure).toBeUndefined();
    expect(found.security).toBe("Secure");
  });

  it("does not fabricate an AD-ARR admission, and does not let allocatableLocked creep", () => {
    const before = seedWardFlowState("standard");
    const unitBefore = unit(before, UNIT);

    const after = wardFlowReducer(before, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW,
      movementId: TARGET,
      actingUnitId: UNIT,
    });

    expect(
      after.rejections.length,
      `PATIENT_ARRIVED was refused: ${after.rejections.at(-1)?.reason ?? "unknown"}`,
    ).toBe(before.rejections.length);

    const moved = movement(after, TARGET);
    expect(moved.closure?.outcome).toBe("arrived");
    // No admission is fabricated for a movement that never had one.
    expect(moved.admissionId, "arrival must not attach a fabricated admission").toBeUndefined();
    expect(after.admissions.some((candidate) => candidate.id.startsWith("AD-ARR-"))).toBe(false);
    expect(after.admissions).toEqual(before.admissions);

    // The bug's own signature: a locked bed never taken through PULL_PATIENT, so the free-locked
    // count must be exactly unchanged by arrival — not creeping up as it would once the phantom
    // admission later departed.
    const unitAfter = unit(after, UNIT);
    expect(unitAfter.allocatableLocked).toBe(unitBefore.allocatableLocked);
  });
});
