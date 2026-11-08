import { describe, expect, it } from "vitest";

import {
  REFUSAL_CHANGED_FIRST,
  REFUSAL_NOT_RECORDABLE,
  refusalReasonText,
  refusedActionText,
} from "@/components/ward-management/ward-refusal-words";
import { wardCommandFailure } from "@/components/ward-management/ward/use-ward-command-completion";

/** H-0839: refusals on screen carry no event code, field name or revision number. */
describe("refusal words on screen", () => {
  it("says someone else changed it first, never the revision numbers", () => {
    expect(refusalReasonText("CONFIRM_CAPACITY on unit u-1 is stale: expected revision 4, current 5")).toBe(
      REFUSAL_CHANGED_FIRST,
    );
  });

  it("drops a leading event code and keeps a plain reason", () => {
    expect(refusalReasonText("ADD_PATIENT needs a UMRN")).toBe("needs a UMRN");
    expect(refusalReasonText("TRIAGE_REFERRAL this referral is already triaged")).toBe(
      "this referral is already triaged",
    );
  });

  it("replaces a reason that names a code or field with a plain sentence", () => {
    expect(refusalReasonText("RECORD_REPATRIATION mode must be chosen from REPATRIATION_MODES")).toBe(
      REFUSAL_NOT_RECORDABLE,
    );
    expect(refusalReasonText("RECORD_DIRECTORY_CHECK entryId is not an entry id")).toBe(REFUSAL_NOT_RECORDABLE);
  });

  it("leaves a reason already in plain words alone", () => {
    expect(refusalReasonText("No allocatable bed on this ward")).toBe("No allocatable bed on this ward");
  });

  it("names the refused action in words", () => {
    expect(refusedActionText("CONFIRM_CAPACITY")).toBe("Confirm capacity");
    expect(refusedActionText("Accepted")).toBe("Accepted");
  });

  it("keeps event codes and revision numbers out of a refused command's toast", () => {
    expect(
      wardCommandFailure({
        status: "refused",
        message: "CONFIRM_CAPACITY on unit dn-rph-older is stale: expected revision 3, current 4. Nothing was changed.",
      } as Parameters<typeof wardCommandFailure>[0]),
    ).toBe(`Not recorded: ${REFUSAL_CHANGED_FIRST}.`);
    expect(
      wardCommandFailure({ status: "refused", message: "No allocatable bed on this ward." } as Parameters<
        typeof wardCommandFailure
      >[0]),
    ).toBe("Not recorded: No allocatable bed on this ward.");
  });
});
