import { describe, expect, it } from "vitest";

import { screenHelpFor } from "@/components/ward-management/help/ward-help-content";
import {
  LEGAL_FORMS_EXPORT_HEADER,
  legalEndAsTyped,
  legalFormsExportLines,
} from "@/components/ward-management/legal-forms/legal-forms-export";
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import { MOVEMENTS_EXPORT_HEADER, movementsExportLines } from "@/components/ward-management/ward-movements-export";
import { searchCoreViews } from "@/components/ward-management/search/ward-smart-search";
import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Feature 44 exports for Legal forms and Movements, the help added for four pages, and the Leave
// page in search. Synthetic seed only.
const state = seedWardFlowState();
const dayZero = new Date(Date.UTC(2026, 10, 11));
const NAME = { givenName: "Synthia", familyName: "Testperson" };
const typed = state.movements.find(
  (movement) => currentLegalDueAt(movement) !== undefined && movement.closure === undefined,
)!;
const ctx = { umrnOf: () => "UM000001", edName: () => "Synthetic ED", wardName: () => null, now: NOW_ANCHOR, dayZero };

describe("legal end as typed (D-93)", () => {
  const dueAt = currentLegalDueAt(typed)!;
  it("gives the typed time with its date, never a count", () => {
    expect(legalEndAsTyped(typed, dueAt - 75, dayZero)).toBe(`Ends ${formatSheetMoment(dueAt, dayZero)}`);
    expect(legalEndAsTyped(typed, dueAt + 75, dayZero)).toBe(`Ended ${formatSheetMoment(dueAt, dayZero)}`);
  });
  it("says when nothing was typed or the form was recorded as ended", () => {
    const blank = { ...typed, legalForm: { ...typed.legalForm!, dueAt: undefined } } as Movement;
    expect(legalEndAsTyped(blank, NOW_ANCHOR, dayZero)).toBe("No expiry recorded from the form");
    const ended = { ...typed, legalForm: { ...typed.legalForm!, endedBy: {} } } as unknown as Movement;
    expect(legalEndAsTyped(ended, NOW_ANCHOR, dayZero)).toBe("Recorded as ended");
  });
});

describe("Legal forms and Movements exports (D-102)", () => {
  const named = { ...typed, ...NAME } as Movement;
  it("has a header row and one row per form, without names", () => {
    const lines = legalFormsExportLines([named], ctx);
    expect(lines[0]).toEqual([...LEGAL_FORMS_EXPORT_HEADER]);
    expect(lines[1]?.[0]).toBe(typed.id);
    expect(lines[1]?.[4]).toBe("No receiving ward");
    expect(String(lines[1]?.[2])).toMatch(/^Form /u);
    expect(JSON.stringify(lines)).not.toMatch(/Synthia|Testperson/u);
  });
  it("lists each movement with its stage and outcome, without names", () => {
    const lines = movementsExportLines([named], { ...ctx, wardName: () => "Synthetic ward" });
    expect(lines[0]).toEqual([...MOVEMENTS_EXPORT_HEADER]);
    expect(lines[1]?.[0]).toBe(typed.id);
    expect(lines[1]?.[10]).toBe("Open");
    expect(String(lines[1]?.[9])).not.toMatch(/as typed/u);
    expect(JSON.stringify(lines)).not.toMatch(/Synthia|Testperson/u);
  });
});

describe("help for pages that had none", () => {
  it.each([
    ["/ward-flow/leave", "leave"],
    ["/ward-flow/review", "todays-review"],
    ["/ward-flow/triage/new", "triage-start"],
    ["/ward-flow/people/PT-001/triage", "triage"],
  ])("%s has its own help", (path, id) => {
    expect(screenHelpFor(path, [])?.id).toBe(id);
  });
  it("keeps the patient page's help on the patient page", () => {
    expect(screenHelpFor("/ward-flow/people/PT-001", [])?.id).toBe("patient");
  });
  it("leaves the bed meeting TV without help, since Help cannot open there (HF-10)", () => {
    expect(screenHelpFor("/ward-flow/bed-meeting", [])).toBeUndefined();
  });
});

it("finds the Leave page in search", () => {
  expect(searchCoreViews("leave").map((result) => result.href)).toContain("/ward-flow/leave");
  expect(searchCoreViews("due back").map((result) => result.href)).toContain("/ward-flow/leave");
});
