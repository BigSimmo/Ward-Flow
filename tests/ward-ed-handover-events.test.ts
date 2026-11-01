import { describe, expect, it } from "vitest";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * ED handover build (Josh, 1 Nov 2026). Q124: the Form dropdown records the form with no written
 * time, and the time is never defaulted to now (Q120). Q103: the presentation is a fixed list.
 */
const now = NOW_ANCHOR;
const open = (s: WardFlowState) => s.movements.find((m) => !m.closure && m.legalForm?.code !== "1A")!;
const run = (s: WardFlowState, e: WardFlowEvent) => {
  const next = wardFlowReducer(s, e);
  return { next, refused: next.rejections.slice(s.rejections.length) };
};

describe("RECORD_LEGAL_FORM_CODE", () => {
  it("records the form with its written time left blank, never now", () => {
    const state = seedWardFlowStateAt(0);
    const target = open(state);
    const { next, refused } = run(state, {
      type: "RECORD_LEGAL_FORM_CODE",
      role: "ed",
      now,
      movementId: target.id,
      formCode: "1A",
    });
    expect(refused).toEqual([]);
    const after = next.movements.find((m) => m.id === target.id)!;
    expect(after.legalForm?.code).toBe("1A");
    expect(after.formedAt).toBeUndefined();
    expect(after.legalForm?.dueAt).toBeUndefined();
  });

  it("is taken back by the legal form Undo", () => {
    const state = seedWardFlowStateAt(0);
    const target = open(state);
    const { next } = run(state, {
      type: "RECORD_LEGAL_FORM_CODE",
      role: "ed",
      now,
      movementId: target.id,
      formCode: "1A",
    });
    const { next: undone, refused } = run(next, {
      type: "UNDO_LEGAL_FORM_RECORD",
      role: "ed",
      now: now + 1,
      movementId: target.id,
    });
    expect(refused).toEqual([]);
    expect(undone.movements.find((m) => m.id === target.id)?.legalForm?.code).toBe(target.legalForm?.code);
  });

  it("refuses the form the person is already on, and an unknown form", () => {
    const state = seedWardFlowStateAt(0);
    const target = open(state);
    const { next } = run(state, {
      type: "RECORD_LEGAL_FORM_CODE",
      role: "ed",
      now,
      movementId: target.id,
      formCode: "1A",
    });
    expect(
      run(next, { type: "RECORD_LEGAL_FORM_CODE", role: "ed", now, movementId: target.id, formCode: "1A" }).refused,
    ).toHaveLength(1);
    expect(
      run(state, { type: "RECORD_LEGAL_FORM_CODE", role: "ed", now, movementId: target.id, formCode: "ZZ" }).refused,
    ).toHaveLength(1);
  });
});

describe("RECORD_ED_PRESENTATION", () => {
  it("saves the fixed list in list order, clears on empty, and refuses typed text", () => {
    const state = seedWardFlowStateAt(0);
    const target = open(state);
    const saved = run(state, {
      type: "RECORD_ED_PRESENTATION",
      role: "ed",
      now,
      movementId: target.id,
      presentations: ["Psychosis", "Low mood"],
    });
    expect(saved.refused).toEqual([]);
    expect(saved.next.movements.find((m) => m.id === target.id)?.edPresentations).toEqual(["Low mood", "Psychosis"]);
    const cleared = run(saved.next, {
      type: "RECORD_ED_PRESENTATION",
      role: "ed",
      now,
      movementId: target.id,
      presentations: [],
    });
    expect(cleared.next.movements.find((m) => m.id === target.id)?.edPresentations).toBeUndefined();
    const typed = run(state, {
      type: "RECORD_ED_PRESENTATION",
      role: "ed",
      now,
      movementId: target.id,
      presentations: ["Typed words" as never],
    });
    expect(typed.refused).toHaveLength(1);
  });

  it("is refused for a ward", () => {
    const state = seedWardFlowStateAt(0);
    const target = open(state);
    expect(
      run(state, { type: "RECORD_ED_PRESENTATION", role: "ward", now, movementId: target.id, presentations: ["Mania"] })
        .refused,
    ).toHaveLength(1);
  });
});
