import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { legalFormName, legalFormNameLabelFirst } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Owner ruling 2026-09-25 (Josh, "both yes"): a Form 5B CONTINUES the Form 5A community treatment
// order rather than replacing it. Only typed facts are kept; nothing is computed.

const NOW = NOW_ANCHOR;
const ID = "WF-002";
const FIVE_A_START = NOW - 60 * 24 * 60;
const FIVE_A_END = NOW + 30 * 24 * 60;
const FIVE_B_START = NOW - 10;
const FIVE_B_END = NOW + 90 * 24 * 60;

function withFiveA(): WardFlowState {
  const state = seedWardFlowState();
  return {
    ...state,
    movements: state.movements.map((m): Movement =>
      m.id === ID
        ? { ...m, formedAt: FIVE_A_START, legalForm: { code: "5A", dueAt: FIVE_A_END }, legalClock: undefined }
        : m,
    ),
  };
}

function movementIn(state: WardFlowState): Movement {
  const found = state.movements.find((m) => m.id === ID);
  if (!found) throw new Error(`fixture precondition: ${ID} must be seeded`);
  return found;
}

function continueWith5B(state: WardFlowState, paperExpiresAt?: number, now = NOW): WardFlowState {
  return wardFlowReducer(state, {
    type: "RECORD_LEGAL_FORM_CONTINUATION",
    role: "coordinator",
    now,
    movementId: ID,
    formCode: "5B",
    startedAt: FIVE_B_START,
    ...(paperExpiresAt === undefined ? {} : { paperExpiresAt }),
  });
}

describe("Form 5B continues Form 5A (owner ruling 2026-09-25)", () => {
  it("keeps the 5A record and its start, marks the continuation, and takes the 5B's typed end", () => {
    const after = continueWith5B(withFiveA(), FIVE_B_END);
    expect(after.rejections).toHaveLength(seedWardFlowState().rejections.length);
    const movement = movementIn(after);
    expect(movement.legalForm?.code).toBe("5A");
    expect(movement.formedAt).toBe(FIVE_A_START);
    expect(movement.legalForm?.dueAt).toBe(FIVE_B_END);
    expect(movement.legalForm?.continuedBy).toEqual({
      code: "5B",
      startedAt: FIVE_B_START,
      recordedAt: NOW,
      by: "coordinator",
      continuedFormDueAt: FIVE_A_END,
    });
  });

  it("leaves the current end unknown when the 5B has no typed end, never computing one", () => {
    const movement = movementIn(continueWith5B(withFiveA()));
    expect(movement.legalForm?.code).toBe("5A");
    expect(movement.legalForm?.dueAt).toBeUndefined();
    expect(movement.legalForm?.continuedBy?.continuedFormDueAt).toBe(FIVE_A_END);
  });

  it("a second 5B updates the continuation and still keeps the 5A's own typed end", () => {
    const once = continueWith5B(withFiveA(), FIVE_B_END);
    const twice = continueWith5B(once, FIVE_B_END + 60, NOW + 5);
    const movement = movementIn(twice);
    expect(movement.legalForm?.code).toBe("5A");
    expect(movement.legalForm?.dueAt).toBe(FIVE_B_END + 60);
    expect(movement.legalForm?.continuedBy?.recordedAt).toBe(NOW + 5);
    expect(movement.legalForm?.continuedBy?.continuedFormDueAt).toBe(FIVE_A_END);
  });

  it("names the form as the 5A community treatment order, continued by Form 5B", () => {
    const form = movementIn(continueWith5B(withFiveA(), FIVE_B_END)).legalForm!;
    expect(legalFormName(form)).toMatch(/^Form 5A.*, continued \(Form 5B\)$/);
    expect(legalFormNameLabelFirst(form)).toMatch(/\(5A\), continued \(Form 5B\)$/);
    expect(legalFormName({ code: "5A" })).not.toContain("continued");
  });

  it("a 5B with no current 5A is recorded as before, and other continuations still replace", () => {
    const state = seedWardFlowState();
    const noFiveA = movementIn(continueWith5B(state, FIVE_B_END));
    expect(noFiveA.legalForm?.code).toBe("5B");
    expect(noFiveA.legalForm?.continuedBy).toBeUndefined();

    const sixC = wardFlowReducer(withFiveA(), {
      type: "RECORD_LEGAL_FORM_CONTINUATION",
      role: "coordinator",
      now: NOW,
      movementId: ID,
      formCode: "6C",
      startedAt: FIVE_B_START,
    });
    expect(movementIn(sixC).legalForm?.code).toBe("6C");
  });
});
