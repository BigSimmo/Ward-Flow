import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

function paperState() {
  const state = seedWardFlowState();
  const movement = state.movements.find((candidate) => !candidate.closure)!;
  movement.legalForm = { code: "1A", region: "country", dueAt: 700 };
  movement.formedAt = 400;
  movement.legalClock = undefined;
  return { state, movementId: movement.id };
}

function correction(movementId: string) {
  return {
    type: "RECORD_LEGAL_FORM_EXPIRY" as const,
    role: "coordinator" as const,
    now: 540,
    movementId,
    dueAt: 650,
    correction: {
      expectedFormCode: "1A",
      expectedFormWrittenAt: 400,
      expectedDueAt: 700,
      reason: "transcription_error" as const,
    },
  };
}

describe("checked paper-expiry corrections", () => {
  it("records an earlier corrected paper time with old and new facts, actor and a distinct audit operation", () => {
    const { state, movementId } = paperState();
    const next = wardFlowReducer(state, correction(movementId));
    const movement = next.movements.find((candidate) => candidate.id === movementId)!;
    expect(next.rejections).toHaveLength(state.rejections.length);
    expect(movement.legalForm?.dueAt).toBe(650);
    expect(movement.legalFormExpiryCorrections).toEqual([
      {
        at: 540,
        by: "coordinator",
        formCode: "1A",
        formWrittenAt: 400,
        previousDueAt: 700,
        dueAt: 650,
        reason: "transcription_error",
      },
    ]);
    expect(movement.legalFormExpiryHistory?.at(-1)).toMatchObject({ dueAt: 650, basis: "correction" });
    expect(next.auditEvents.at(-1)).toMatchObject({
      outcome: "accepted",
      category: "legal-form",
      details: {
        operation: "expiry-corrected",
        previousDueAt: 700,
        dueAt: 650,
        reason: "transcription_error",
      },
    });
  });

  it.each([{ expectedDueAt: 699 }, { expectedFormCode: "3A" }, { expectedFormWrittenAt: 399 }])(
    "refuses a correction after the paper facts changed: %j",
    (changed) => {
      const { state, movementId } = paperState();
      const event = correction(movementId);
      const next = wardFlowReducer(state, { ...event, correction: { ...event.correction, ...changed } });
      expect(next.rejections).toHaveLength(state.rejections.length + 1);
      expect(next.movements).toBe(state.movements);
    },
  );

  it.each([
    null,
    {},
    { ...correction("").correction, reason: "unrecognised" },
    { ...correction("").correction, expectedDueAt: Number.NaN },
    { ...correction("").correction, expectedFormWrittenAt: Number.NaN },
    { ...correction("").correction, note: "extra" },
    "transcription_error",
  ])("refuses malformed correction facts without treating them as an extension: %j", (invalid) => {
    const { state, movementId } = paperState();
    const next = wardFlowReducer(state, {
      ...correction(movementId),
      dueAt: 750,
      correction: invalid,
    } as unknown as WardFlowEvent);
    expect(next.rejections).toHaveLength(state.rejections.length + 1);
    expect(next.movements).toBe(state.movements);
  });

  it("keeps an ordinary extension later-only and requires a different corrected value", () => {
    const { state, movementId } = paperState();
    const ordinary = {
      type: "RECORD_LEGAL_FORM_EXPIRY" as const,
      role: "coordinator" as const,
      now: 540,
      movementId,
      dueAt: 650,
    };
    expect(wardFlowReducer(state, ordinary).movements).toBe(state.movements);
    expect(wardFlowReducer(state, { ...correction(movementId), dueAt: 700 }).movements).toBe(state.movements);
    const extended = wardFlowReducer(state, { ...ordinary, dueAt: 750 });
    expect(extended.movements.find((candidate) => candidate.id === movementId)?.legalForm?.dueAt).toBe(750);
    expect(extended.auditEvents.at(-1)).toMatchObject({ details: { operation: "extension-recorded" } });
  });
});
