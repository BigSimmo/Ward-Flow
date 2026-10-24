import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WARD_FLOW_TYPED_TEXT_EVENT_TYPES } from "@/components/ward-management/ward-flow-persistence-classification";
import {
  normaliseTypedText,
  TYPED_TEXT_LEDGER_EVENT_TYPES,
  typedTextOf,
} from "@/components/ward-management/ward-flow-typed-text-ledger";

/*
 * Josh, 21 Oct 2026 (fix plan item 2, option A): a session holding typed text keeps saving a copy with
 * every typed value replaced. The ledger is what that copy is checked against, so it must read every
 * typed-text event, and must say so (`null`) when it cannot, so saving stops as it did before.
 */
describe("typed-text ledger", () => {
  it("reads exactly the typed-text event types", () => {
    expect([...TYPED_TEXT_LEDGER_EVENT_TYPES].sort()).toEqual([...WARD_FLOW_TYPED_TEXT_EVENT_TYPES].sort());
  });

  it("returns null for an event type on neither list, so saving stops", () => {
    const unknown = { type: "NOT_A_REAL_EVENT", role: "coordinator", now: 0, note: "x" } as unknown as WardFlowEvent;
    expect(typedTextOf(unknown)).toBeNull();
  });

  it("treats every string of a typed-text event as typed, except reviewed keys", () => {
    const values = typedTextOf({
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: 0,
      movementId: "MOV-1",
      blocker: "Synthetic blocker words",
    });
    expect(values).toEqual(["Synthetic blocker words"]);
  });

  it("reads nested typed text, such as a new unreviewed field inside a typed event", () => {
    const event = {
      type: "UPLOAD_PATIENT_FORM",
      role: "ward",
      now: 0,
      movementId: "MOV-1",
      formName: "Synthetic form",
      fileName: "synthetic.pdf",
      futureField: { inner: "Unreviewed synthetic words" },
    } as unknown as WardFlowEvent;
    expect(typedTextOf(event)).toEqual(["Synthetic form", "synthetic.pdf", "Unreviewed synthetic words"]);
  });

  it("returns nothing for a text-safe event", () => {
    expect(typedTextOf({ type: "ADVANCE_CLOCK", role: "demo", now: 0, minutes: 5 })).toEqual([]);
  });

  it("reads an override sign-off name on an otherwise text-safe event", () => {
    const event = {
      type: "PULL_PATIENT",
      role: "coordinator",
      now: 0,
      movementId: "MOV-1",
      unitId: "unit",
      overrideSignOff: { role: "coordinator", name: "Synthetic Signer" },
    } as unknown as WardFlowEvent;
    expect(typedTextOf(event)).toEqual(["Synthetic Signer"]);
  });

  it("reads a patient-specific discharge criterion, and nothing from the fixed list", () => {
    const event = {
      type: "SET_DISCHARGE_CRITERIA",
      role: "ward",
      now: 0,
      admissionId: "ADM-1",
      criteria: null,
      met: [],
      setByTreatingPsychiatrist: true,
      patientSpecific: ["Synthetic criterion words"],
    } as unknown as WardFlowEvent;
    expect(typedTextOf(event)).toEqual(["Synthetic criterion words"]);
  });

  it("compares typed text without case, spacing or width differences", () => {
    expect(normaliseTypedText("  Ｔyped\n  TEXT ")).toBe("typed text");
  });
});
