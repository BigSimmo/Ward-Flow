import { describe, expect, it } from "vitest";
import { legalFormStatusWarning } from "@/components/ward-management/ward-legal-form-fit";

// Findings 6 and 78 (Josh, 27 Oct 2026): a form that does not fit the legal status is a warning.
describe("legalFormStatusWarning", () => {
  it("says nothing until both the status and the form are answered", () => {
    expect(legalFormStatusWarning(undefined, "1A")).toBeNull();
    expect(legalFormStatusWarning("", null)).toBeNull();
    expect(legalFormStatusWarning("Voluntary", undefined)).toBeNull();
  });

  it("warns on a form for a voluntary patient", () => {
    expect(legalFormStatusWarning("Voluntary", "1A")).toBe(
      "Check the legal form: Form 1A is chosen, but the legal status is Voluntary.",
    );
  });

  it("warns on no form for a status that rests on one", () => {
    expect(legalFormStatusWarning("Involuntary inpatient", null)).toBe(
      "Check the legal form: no form is chosen, but the legal status is Involuntary inpatient.",
    );
    expect(legalFormStatusWarning("Detained awaiting examination", null)).not.toBeNull();
    expect(legalFormStatusWarning("Referred for psychiatric examination", null)).not.toBeNull();
  });

  it("does not judge which form fits which status", () => {
    expect(legalFormStatusWarning("Voluntary", null)).toBeNull();
    expect(legalFormStatusWarning("Involuntary inpatient", "1A")).toBeNull();
    expect(legalFormStatusWarning("Referred for psychiatric examination", "6A")).toBeNull();
  });
});
