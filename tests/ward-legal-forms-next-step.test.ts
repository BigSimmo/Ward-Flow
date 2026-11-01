import { describe, expect, it } from "vitest";

import { nextStep } from "@/components/ward-management/legal-forms/legal-forms-next-step";
import type { Movement } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The Forms side panel's one next step (1 Nov 2026). Synthetic: each case is the seeded WF-001 move
 * with only the fields that make it that case overridden.
 */
const template = wardMovements.find((movement) => movement.id === "WF-001");
if (!template) throw new Error("WF-001 seed missing");

const NOW = NOW_ANCHOR;
const move = (overrides: Partial<Movement>): Movement => ({
  ...template,
  legalStatus: "Detained awaiting examination",
  legalForm: { code: "1A", dueAt: NOW + 120 },
  formedAt: NOW - 60,
  legalFormReceivedAt: NOW - 30,
  examination: undefined,
  closure: undefined,
  ...overrides,
});

describe("nextStep", () => {
  it("asks for the next form once the form has moved on", () => {
    const step = nextStep(move({ closure: { outcome: "arrived" } as Movement["closure"] }), NOW);
    expect(step).toMatchObject({ action: "next-form", title: "Record Form 6A" });
    expect(step.detail).toBe("Form 1A ended at arrival.");
  });

  it("offers extend or the next form when the typed end time has gone by, repeating it only as typed", () => {
    const step = nextStep(move({ legalForm: { code: "1A", dueAt: NOW - 10 }, formedAt: undefined }), NOW);
    expect(step.action).toBe("extend");
    expect(step.title).toBe("Extend or record the next form");
    expect(step.detail).toMatch(/^Form 1A ended .* as typed\.$/);
  });

  it("asks for the time written before anything else still to record", () => {
    expect(nextStep(move({ formedAt: undefined, legalFormReceivedAt: undefined }), NOW)).toMatchObject({
      action: "written",
      title: "Add the time written",
    });
  });

  it("does not ask for a written time this page cannot record", () => {
    const step = nextStep(move({ legalForm: { code: "4A", dueAt: NOW + 120 }, formedAt: undefined }), NOW);
    expect(step.action).not.toBe("written");
  });

  it("then asks for the paper form, then the examination", () => {
    expect(nextStep(move({ legalFormReceivedAt: undefined }), NOW)).toMatchObject({
      action: "received",
      title: "Mark Form 1A received",
    });
    expect(nextStep(move({}), NOW)).toMatchObject({ action: "examination", title: "Record the examination" });
  });

  it("says plainly when nothing is left to record", () => {
    expect(nextStep(move({ legalStatus: "Involuntary inpatient" }), NOW)).toMatchObject({
      action: "none",
      title: "Nothing to record now",
    });
  });
});
