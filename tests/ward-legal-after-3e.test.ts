import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { buildHistoryEntry } from "@/components/ward-management/ward-history";
import {
  AFTER_3E_REFUSAL,
  FORMS_REFUSED_AFTER_3E,
  refusedAfter3E,
} from "@/components/ward-management/ward-legal-after-3e";
import { LEGAL_CLOCK_FORM_CODES } from "@/components/ward-management/ward-legal-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** D-226 (Josh, 14 Nov 2026): forms after a Form 3E. Every input is synthetic. */

const seed = seedWardFlowState();
const target = seed.movements.find((m) => !m.closure && m.originEdId !== undefined && m.stage !== "arrived")!;
const now = NOW_ANCHOR + 600;
const of = (state: WardFlowState) => state.movements.find((m) => m.id === target.id)!;

function run(state: WardFlowState, event: Record<string, unknown>) {
  const next = wardFlowReducer(state, { role: "ed", now, movementId: target.id, ...event } as WardFlowEvent);
  return { next, refused: next.rejections.slice(state.rejections.length).map((r) => r.reason) };
}

function after3E(): WardFlowState {
  let state = run(seed, { type: "RECORD_LEGAL_FORM_WRITTEN", formCode: "3A", writtenAt: now - 300 }).next;
  const result = run(state, { type: "RECORD_LEGAL_FORM_WRITTEN", formCode: "3E", writtenAt: now - 100 });
  expect(result.refused).toEqual([]);
  state = result.next;
  return state;
}

describe("D-226: continuation forms after a Form 3E", () => {
  it.each(FORMS_REFUSED_AFTER_3E)("refuses Form %s after a 3E on the Forms page", (code) => {
    const result = run(after3E(), { type: "RECORD_LEGAL_FORM_WRITTEN", formCode: code, writtenAt: now - 10 });
    expect(result.refused).toEqual([AFTER_3E_REFUSAL]);
    expect(of(result.next).legalForm?.code).toBe("3E");
  });

  it("refuses a continuation after a 3E through the continuation action", () => {
    const result = run(after3E(), {
      type: "RECORD_LEGAL_FORM_CONTINUATION",
      role: "coordinator",
      formCode: "6C",
      startedAt: now - 10,
    });
    expect(result.refused).toEqual([AFTER_3E_REFUSAL]);
  });

  it.each(["1A", "3A", "3D", "6A", "6B"])("accepts Form %s, which starts a new order, after a 3E", (code) => {
    const result = run(after3E(), { type: "RECORD_LEGAL_FORM_WRITTEN", formCode: code, writtenAt: now - 10 });
    expect(result.refused).toEqual([]);
    expect(of(result.next).legalForm?.code).toBe(code);
  });

  it("every recognised form is either refused after a 3E or starts a new order", () => {
    const refused = LEGAL_CLOCK_FORM_CODES.filter((code) => refusedAfter3E({ legalForm: { code: "3E" } }, code));
    expect(refused).toEqual([...FORMS_REFUSED_AFTER_3E]);
  });

  it("lets a coordinator record it with a listed reason, and History names the reason", () => {
    const event = {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "coordinator",
      formCode: "3C",
      writtenAt: now - 10,
      after3EReason: "new_order_made",
    };
    const result = run(after3E(), event);
    expect(result.refused).toEqual([]);
    expect(of(result.next).legalForm?.code).toBe("3C");
    const entry = buildHistoryEntry({ ...event, now, movementId: target.id } as WardFlowEvent, now);
    expect(JSON.stringify(entry)).toContain("Paper checked: new order made");
  });

  it("ignores the reason from any other desk, and refuses a reason that is not on the list", () => {
    const fromEd = run(after3E(), {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      formCode: "3C",
      writtenAt: now - 10,
      after3EReason: "new_order_made",
    });
    expect(fromEd.refused).toEqual([AFTER_3E_REFUSAL]);
    const typed = run(after3E(), {
      type: "RECORD_LEGAL_FORM_WRITTEN",
      role: "coordinator",
      formCode: "3C",
      writtenAt: now - 10,
      after3EReason: "because I said so",
    });
    expect(typed.refused).toEqual([AFTER_3E_REFUSAL]);
  });

  it("does not refuse a continuation when no form is on file (warning only)", () => {
    const result = run(seed, {
      type: "RECORD_LEGAL_FORM_CONTINUATION",
      role: "coordinator",
      formCode: "6C",
      startedAt: now - 10,
    });
    expect(result.refused).not.toContain(AFTER_3E_REFUSAL);
  });
});
