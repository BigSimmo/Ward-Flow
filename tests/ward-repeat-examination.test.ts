import { describe, expect, it } from "vitest";

import {
  CANCEL_TRANSPORT_REASONS,
  GENDER_PLACEMENT_REASONS,
} from "../src/components/ward-management/ward-change-reasons";
import { examinationRevokedWhileBedHeld } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function seeded() {
  return seedWardFlowState();
}

function movement(state: ReturnType<typeof seeded>, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing ${id}`);
  return found;
}

/** WF-012 (Adult/Secure) walked to a pulled bed at rph-adult-secure, with no examination yet. */
function atPulledBed(movementId: string) {
  let state = seeded();
  for (const step of [
    // T12 (item 9, owner answer 17 September 2026): WF-012 is Non-binary, so referring it needs
    // a reason and a recorded ward check — the fixture predates T12 and never carried either.
    {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      unitIds: ["rph-adult-secure"],
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
      genderPlacementChecked: true,
    },
    { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
    { type: "PULL_PATIENT", role: "ward", unitId: "rph-adult-secure" },
  ] as const) {
    state = wardFlowReducer(state, { ...step, now: NOW, movementId } as never);
  }
  expect(state.rejections, "the walk to a pulled bed must succeed, or nothing below proves anything").toEqual([]);
  return state;
}

/** The same walk, continued to handover_ready with a booked, accepted-by-nobody transport job. */
function atHandoverReady(movementId: string) {
  let state = atPulledBed(movementId);
  for (const step of [
    {
      type: "BOOK_TRANSPORT",
      role: "ed",
      provider: "Ambulance service",
      escortRequired: true,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    },
    { type: "HANDOVER_READY", role: "ed" },
  ] as const) {
    state = wardFlowReducer(state, { ...step, now: NOW, movementId } as never);
  }
  expect(state.rejections, "the walk to handover_ready must succeed, or nothing below proves anything").toEqual([]);
  return state;
}

/** Continued further: transport accepted and en route, the two preconditions PATIENT_COLLECTED
 *  checks alongside stage `handover_ready`. */
function atEnRoute(movementId: string) {
  let state = atHandoverReady(movementId);
  for (const step of [
    { type: "TRANSPORT_ACCEPTED", role: "officer" },
    { type: "TRANSPORT_EN_ROUTE", role: "officer" },
  ] as const) {
    state = wardFlowReducer(state, { ...step, now: NOW, movementId } as never);
  }
  expect(state.rejections, "the walk to en route must succeed, or nothing below proves anything").toEqual([]);
  return state;
}

describe("PATIENT_COLLECTED — refused while examinationRevokedWhileBedHeld (T9, owner answer 5, second round 2026-09-17)", () => {
  it("refuses collection while a revoked examination still holds the bed", () => {
    const TARGET = "WF-012";
    const enRoute = atEnRoute(TARGET);
    const flagged = wardFlowReducer(enRoute, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: TARGET,
      outcome: "revoked",
    });
    expect(flagged.rejections.slice(enRoute.rejections.length)).toEqual([]);
    expect(examinationRevokedWhileBedHeld(movement(flagged, TARGET))).toBe(true);

    const collected = wardFlowReducer(flagged, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      now: NOW + 2,
      movementId: TARGET,
    });
    expect(collected.rejections.slice(flagged.rejections.length)).toHaveLength(1);
    expect(collected.rejections.at(-1)?.reason).toContain("revoked");
    expect(movement(collected, TARGET).stage).toBe("handover_ready");
  });

  it("allows collection once a repeat examination supersedes the flagged record with a non-revoking outcome", () => {
    const TARGET = "WF-012";
    const enRoute = atEnRoute(TARGET);
    const ordered = wardFlowReducer(enRoute, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: TARGET,
      outcome: "further_examination_ordered",
    });
    const repeat = wardFlowReducer(ordered, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 2,
      movementId: TARGET,
      outcome: "inpatient_order",
    });
    expect(repeat.rejections.slice(enRoute.rejections.length)).toEqual([]);
    expect(examinationRevokedWhileBedHeld(movement(repeat, TARGET))).toBe(false);

    const collected = wardFlowReducer(repeat, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      now: NOW + 3,
      movementId: TARGET,
    });
    expect(collected.rejections.slice(repeat.rejections.length)).toEqual([]);
    expect(movement(collected, TARGET).stage).toBe("moving");
  });

  it("allows collection once the flagged bed has actually been released", () => {
    const TARGET = "WF-012";
    const enRoute = atEnRoute(TARGET);
    const flagged = wardFlowReducer(enRoute, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: TARGET,
      outcome: "revoked",
    });
    expect(examinationRevokedWhileBedHeld(movement(flagged, TARGET))).toBe(true);

    // The bed has been released (`admissionId` cleared) — the same fact
    // `examinationRevokedWhileBedHeld`'s own "clears once STEP_BACK_STAGE then RELEASE_PULL"
    // test above proves is reachable through the ordinary release path. Spliced directly here to
    // isolate PATIENT_COLLECTED's own guard from the unrelated stage guard STEP_BACK_STAGE would
    // otherwise also trip (stepping back leaves stage at `pulled`, not `handover_ready`).
    const released = {
      ...flagged,
      movements: flagged.movements.map((m) => (m.id === TARGET ? { ...m, admissionId: undefined } : m)),
    };
    expect(examinationRevokedWhileBedHeld(movement(released, TARGET))).toBe(false);

    const collected = wardFlowReducer(released, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      now: NOW + 3,
      movementId: TARGET,
    });
    expect(collected.rejections.slice(released.rejections.length)).toEqual([]);
    expect(movement(collected, TARGET).stage).toBe("moving");
  });
});

describe("PATIENT_ARRIVED — never guarded by examinationRevokedWhileBedHeld (T9)", () => {
  it("still succeeds while the flag is true", () => {
    const TARGET = "WF-012";
    const enRoute = atEnRoute(TARGET);
    const flagged = wardFlowReducer(enRoute, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: TARGET,
      outcome: "revoked",
    });
    // Spliced to `moving` with the flag still true — PATIENT_COLLECTED's own guard above refuses
    // reaching this state through the ordinary path, so it is constructed directly to check
    // PATIENT_ARRIVED's guard in isolation, the same technique the release test above uses.
    const flaggedAndMoving = {
      ...flagged,
      movements: flagged.movements.map((m) =>
        m.id === TARGET ? { ...m, stage: "moving" as const, transport: { ...m.transport!, collectedAt: NOW + 2 } } : m,
      ),
    };
    expect(examinationRevokedWhileBedHeld(movement(flaggedAndMoving, TARGET))).toBe(true);

    const acceptedUnitId = movement(flaggedAndMoving, TARGET).acceptedUnitId!;
    const arrived = wardFlowReducer(flaggedAndMoving, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW + 3,
      movementId: TARGET,
      actingUnitId: acceptedUnitId,
    } as never);
    expect(arrived.rejections.slice(flaggedAndMoving.rejections.length)).toEqual([]);
    expect(movement(arrived, TARGET).stage).toBe("arrived");
  });
});

describe("RECORD_EXAMINATION — further_examination_ordered (owner item 7, 2026-09-17)", () => {
  it("closes nothing and refunds nothing", () => {
    const TARGET = "WF-012";
    const before = atPulledBed(TARGET);
    const beforeUnit = before.units.find((candidate) => candidate.id === "rph-adult-secure")!;
    const beforeMovement = movement(before, TARGET);
    // Non-vacuity: there must be a real bed and admission standing, or "refunds nothing" proves
    // nothing — the same discriminator ward-flow-reducer.test.ts's own WLQ-4 tests use.
    expect(beforeMovement.admissionId, "the walk must create a pulled admission").toBeDefined();
    expect(beforeUnit.allocatable.value).toBe(0);

    const next = wardFlowReducer(before, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: TARGET,
      outcome: "further_examination_ordered",
    });
    expect(next.rejections).toEqual([]);
    const target = movement(next, TARGET);
    expect(target.examination).toEqual({ at: NOW + 1, outcome: "further_examination_ordered" });

    // Closes nothing:
    expect(target.closure).toBeUndefined();
    expect(target.stage).toBe("pulled");
    expect(target.blocker).toBe(beforeMovement.blocker);

    // Refunds nothing:
    expect(next.units.find((candidate) => candidate.id === "rph-adult-secure")!.allocatable.value).toBe(0);
    expect(target.admissionId).toBe(beforeMovement.admissionId);
    expect(next.admissions.some((candidate) => candidate.id === beforeMovement.admissionId)).toBe(true);
  });

  it("is false on examinationRevokedWhileBedHeld even though the bed is held — it is not a revocation", () => {
    const TARGET = "WF-012";
    const before = atPulledBed(TARGET);
    const next = wardFlowReducer(before, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: TARGET,
      outcome: "further_examination_ordered",
    });
    expect(next.rejections).toEqual([]);
    expect(movement(next, TARGET).admissionId).toBeDefined();
    expect(examinationRevokedWhileBedHeld(movement(next, TARGET))).toBe(false);
  });
});

describe("RECORD_EXAMINATION — repeat examinations supersede the earlier record", () => {
  it("allows a second examination only after further_examination_ordered, moving the first to supersededExaminations", () => {
    // WF-001 is seeded with no examination recorded yet.
    const first = wardFlowReducer(seeded(), {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW,
      movementId: "WF-001",
      outcome: "further_examination_ordered",
    });
    expect(first.rejections).toEqual([]);
    expect(movement(first, "WF-001").supersededExaminations).toBeUndefined();

    const second = wardFlowReducer(first, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 10,
      movementId: "WF-001",
      outcome: "inpatient_order",
    });
    expect(second.rejections).toEqual([]);
    const target = movement(second, "WF-001");
    expect(target.examination).toEqual({ at: NOW + 10, outcome: "inpatient_order" });
    expect(target.supersededExaminations).toEqual([{ at: NOW, outcome: "further_examination_ordered" }]);
  });

  it("a second after further_examination_ordered can itself be superseded again by a third", () => {
    const first = wardFlowReducer(seeded(), {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW,
      movementId: "WF-001",
      outcome: "further_examination_ordered",
    });
    const second = wardFlowReducer(first, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 10,
      movementId: "WF-001",
      outcome: "further_examination_ordered",
    });
    expect(second.rejections).toEqual([]);
    expect(movement(second, "WF-001").supersededExaminations).toEqual([
      { at: NOW, outcome: "further_examination_ordered" },
    ]);

    const third = wardFlowReducer(second, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 20,
      movementId: "WF-001",
      outcome: "revoked",
    });
    expect(third.rejections).toEqual([]);
    const target = movement(third, "WF-001");
    expect(target.examination).toEqual({ at: NOW + 20, outcome: "revoked" });
    expect(target.supersededExaminations).toEqual([
      { at: NOW, outcome: "further_examination_ordered" },
      { at: NOW + 10, outcome: "further_examination_ordered" },
    ]);
  });

  it("a second examination after inpatient_order is refused: 'already examined'", () => {
    const first = wardFlowReducer(seeded(), {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW,
      movementId: "WF-001",
      outcome: "inpatient_order",
    });
    expect(first.rejections).toEqual([]);

    const second = wardFlowReducer(first, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 10,
      movementId: "WF-001",
      outcome: "further_examination_ordered",
    });
    expect(second.rejections).toHaveLength(1);
    expect(second.rejections[0].reason).toContain("already examined");
    // The first examination stands unchanged; the refused second one wrote nothing.
    expect(movement(second, "WF-001").examination).toEqual({ at: NOW, outcome: "inpatient_order" });
    expect(movement(second, "WF-001").supersededExaminations).toBeUndefined();
  });
});

describe("examinationRevokedWhileBedHeld — derived from records, never from movement.blocker", () => {
  it("is false when no examination has been recorded", () => {
    expect(examinationRevokedWhileBedHeld(movement(seeded(), "WF-012"))).toBe(false);
  });

  it("is true once a revoked examination is recorded at handover_ready", () => {
    const TARGET = "WF-012";
    const revoked = wardFlowReducer(atHandoverReady(TARGET), {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: TARGET,
      outcome: "revoked",
    });
    expect(revoked.rejections).toEqual([]);
    expect(examinationRevokedWhileBedHeld(movement(revoked, TARGET))).toBe(true);
  });

  it("survives RECORD_MOVEMENT_BLOCKER and TRANSPORT_ACCEPTED overwriting the prose blocker", () => {
    const TARGET = "WF-012";
    const revoked = wardFlowReducer(atHandoverReady(TARGET), {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: TARGET,
      outcome: "revoked",
    });
    expect(revoked.rejections).toEqual([]);
    expect(examinationRevokedWhileBedHeld(movement(revoked, TARGET))).toBe(true);

    const blockerOverwritten = wardFlowReducer(revoked, {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: NOW + 2,
      movementId: TARGET,
      blocker: "Awaiting a single room",
    });
    expect(blockerOverwritten.rejections).toEqual([]);
    // Non-vacuity: the prose really no longer mentions the revoked examination, so the flag below
    // cannot be passing by reading the very sentence this test overwrote.
    expect(movement(blockerOverwritten, TARGET).blocker).not.toMatch(/revoked/i);
    expect(examinationRevokedWhileBedHeld(movement(blockerOverwritten, TARGET))).toBe(true);

    const transportAccepted = wardFlowReducer(blockerOverwritten, {
      type: "TRANSPORT_ACCEPTED",
      role: "officer",
      now: NOW + 3,
      movementId: TARGET,
    });
    // Product-correct: transport must not advance while the examination is revoked and the bed
    // is still held. The prose blocker can still be overwritten; the derived flag is the gate.
    expect(transportAccepted.rejections).toHaveLength(1);
    expect(transportAccepted.rejections[0]).toMatchObject({
      attempted: "TRANSPORT_ACCEPTED",
      movementId: TARGET,
    });
    expect(transportAccepted.rejections[0].reason).toMatch(/examination was revoked/i);
    expect(movement(transportAccepted, TARGET).blocker).not.toMatch(/revoked/i);
    expect(examinationRevokedWhileBedHeld(movement(transportAccepted, TARGET))).toBe(true);
  });

  it("clears once STEP_BACK_STAGE then RELEASE_PULL actually release the bed", () => {
    const TARGET = "WF-012";
    const revoked = wardFlowReducer(atHandoverReady(TARGET), {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId: TARGET,
      outcome: "revoked",
    });
    expect(revoked.rejections).toEqual([]);
    expect(examinationRevokedWhileBedHeld(movement(revoked, TARGET))).toBe(true);

    const steppedBack = wardFlowReducer(revoked, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: NOW + 2,
      movementId: TARGET,
      to: "pulled",
      reason: "the_patient_situation_changed",
    } as never);
    expect(steppedBack.rejections).toEqual([]);
    expect(movement(steppedBack, TARGET).stage).toBe("pulled");
    // STEP_BACK_STAGE alone does not release the bed, so the flag must still be true.
    expect(examinationRevokedWhileBedHeld(movement(steppedBack, TARGET))).toBe(true);

    // Owner ruling 2026-09-25: RELEASE_PULL refuses while a transport job is booked ("...has a
    // transport job booked; cancel it (CANCEL_TRANSPORT) before releasing the pull"). STEP_BACK_STAGE
    // never touches `transport` (its own "TOUCH NOTHING ELSE" rule), so the job atHandoverReady()
    // booked is still standing here — cancel it before releasing.
    const cancelledTransport = wardFlowReducer(steppedBack, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: NOW + 3,
      movementId: TARGET,
      reason: CANCEL_TRANSPORT_REASONS[0],
    } as never);
    expect(cancelledTransport.rejections).toEqual([]);

    const released = wardFlowReducer(cancelledTransport, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now: NOW + 4,
      movementId: TARGET,
      reason: "patient_no_longer_coming",
    } as never);
    expect(released.rejections).toEqual([]);
    expect(movement(released, TARGET).admissionId).toBeUndefined();
    expect(examinationRevokedWhileBedHeld(movement(released, TARGET))).toBe(false);
  });
});
