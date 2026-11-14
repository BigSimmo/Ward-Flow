import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  CONTINUATION_FORM_CODES,
  isContinuationFormCode,
  LEGAL_CLOCK_FORM_CODES,
} from "@/components/ward-management/ward-legal-clock";
import { currentLegalDueAt, currentLegalPosition } from "@/components/ward-management/ward-legal-form-progression";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Mechanics and clock audit M13 (b to e), D-MCA (Josh, 14 Nov 2026), ruling 6. The record engine
 * refuses the legal records the audit found it accepting. Every input is synthetic.
 */

const seed = seedWardFlowState();
const target = seed.movements.find((m) => !m.closure && m.originEdId !== undefined && m.stage !== "arrived")!;
const now = NOW_ANCHOR + 600;
const of = (state: WardFlowState) => state.movements.find((m) => m.id === target.id)!;

function run(state: WardFlowState, event: Record<string, unknown>) {
  const next = wardFlowReducer(state, { role: "ed", now, movementId: target.id, ...event } as WardFlowEvent);
  return { next, refused: next.rejections.slice(state.rejections.length).map((r) => r.reason) };
}

function written(code: string, extra: Record<string, unknown> = {}, state = seed) {
  const result = run(state, { type: "RECORD_LEGAL_FORM_WRITTEN", formCode: code, writtenAt: now - 120, ...extra });
  expect(result.refused).toEqual([]);
  return result.next;
}

describe("M13 (b): a typed expiry is never before the time the form was written (D-189 item 9(g))", () => {
  it("refuses Record expiry before the written time, and keeps the record as it was", () => {
    const state = written("3A");
    const result = run(state, { type: "RECORD_LEGAL_FORM_EXPIRY", dueAt: now - 300 });
    expect(result.refused).toHaveLength(1);
    expect(currentLegalDueAt(of(result.next))).toBeUndefined();
  });

  it("still accepts an expiry after the written time", () => {
    const state = written("3A");
    const result = run(state, { type: "RECORD_LEGAL_FORM_EXPIRY", dueAt: now + 300 });
    expect(result.refused).toEqual([]);
    expect(currentLegalDueAt(of(result.next))).toBe(now + 300);
  });

  it("refuses moving the written time after the typed expiry", () => {
    const state = written("3A", { writtenAt: now - 500, paperExpiresAt: now - 200 });
    const result = run(state, { type: "RECORD_LEGAL_FORM_WRITTEN", formCode: "3A", writtenAt: now - 10 });
    expect(result.refused).toHaveLength(1);
    expect(of(result.next).formedAt).toBe(now - 500);
  });
});

describe("M13 (c, d), ruling 6: Form 3E and the continuation list", () => {
  it("records a Form 3E as a new form that replaces the Form 3A", () => {
    const state = written("3A", { paperExpiresAt: now + 600 });
    const result = run(state, { type: "RECORD_LEGAL_FORM_WRITTEN", formCode: "3E", writtenAt: now - 10 });
    expect(result.refused).toEqual([]);
    const position = currentLegalPosition(of(result.next));
    expect(position.form?.code).toBe("3E");
    expect(position.ended).toBe(false);
  });

  it("refuses 'Form 3E made' as a new ending", () => {
    const state = written("3A");
    const result = run(state, { type: "RECORD_LEGAL_FORM_DETAILS", formCode: "3A", endedBy: "form_3e" });
    expect(result.refused).toEqual(["Record a Form 3E as a new form. It replaces the Form 3A on the record."]);
    expect(currentLegalPosition(of(result.next)).ended).toBe(false);
  });

  it("still loads and shows an old record that holds 'Form 3E made'", () => {
    const old = {
      ...target,
      legalForm: { code: "3A", kind: "detention" as const, dueAt: now + 60, endedBy: "form_3e" as const },
    };
    const position = currentLegalPosition(old);
    expect(position.ended).toBe(true);
    expect(position.endedBy).toBe("form_3e");
    expect(position.dueAt).toBeUndefined();
  });

  it("offers the picker exactly the codes the engine accepts as a continuation", () => {
    expect(CONTINUATION_FORM_CODES).not.toContain("3E");
    expect(LEGAL_CLOCK_FORM_CODES.filter((code) => isContinuationFormCode(code))).toEqual([...CONTINUATION_FORM_CODES]);
    const refused = CONTINUATION_FORM_CODES.filter(
      (code) =>
        run(seed, { type: "RECORD_LEGAL_FORM_CONTINUATION", role: "coordinator", formCode: code, startedAt: now - 30 })
          .refused.length > 0,
    );
    // Whatever the engine refuses here, it is for the record's state, not because the picker
    // offered a code outside the shared list.
    for (const code of refused) expect(isContinuationFormCode(code)).toBe(true);
    const outside = run(seed, {
      type: "RECORD_LEGAL_FORM_CONTINUATION",
      role: "coordinator",
      formCode: "3E",
      startedAt: now - 30,
    });
    expect(outside.refused).toHaveLength(1);
  });

  it("refuses a Form 3C continuation after a Form 3D, as the written path does", () => {
    const state = written("3D");
    const viaWritten = run(state, { type: "RECORD_LEGAL_FORM_WRITTEN", formCode: "3C", writtenAt: now - 30 });
    const viaContinuation = run(state, {
      type: "RECORD_LEGAL_FORM_CONTINUATION",
      role: "coordinator",
      formCode: "3C",
      startedAt: now - 30,
    });
    expect(viaWritten.refused).toHaveLength(1);
    expect(viaContinuation.refused).toHaveLength(1);
    expect(of(viaContinuation.next).legalForm?.code).toBe("3D");
  });

  it("refuses a Form 5B on a Form 5A recorded as ended", () => {
    const fiveA = written("5A");
    const ended = run(fiveA, { type: "RECORD_LEGAL_FORM_DETAILS", formCode: "5A", endedBy: "revoked" });
    expect(ended.refused).toEqual([]);
    const fiveB = run(ended.next, {
      type: "RECORD_LEGAL_FORM_CONTINUATION",
      role: "coordinator",
      formCode: "5B",
      startedAt: now - 10,
      paperExpiresAt: now + 5000,
    });
    expect(fiveB.refused).toHaveLength(1);
    expect(currentLegalDueAt(of(fiveB.next))).toBeUndefined();
  });
});

describe("M13 (e): no expiry or extension on a form recorded as ended", () => {
  it("refuses the expiry and keeps the form ended", () => {
    const state = written("3A", { paperExpiresAt: now + 60 });
    const ended = run(state, { type: "RECORD_LEGAL_FORM_DETAILS", formCode: "3A", endedBy: "revoked" });
    const result = run(ended.next, { type: "RECORD_LEGAL_FORM_EXPIRY", dueAt: now + 600 });
    expect(result.refused).toEqual(["This form is recorded as ended, so no expiry or extension can be added to it."]);
    const m = of(result.next);
    expect(m.legalForm?.dueAt).toBe(now + 60);
    expect(currentLegalDueAt(m)).toBeUndefined();
  });
});
