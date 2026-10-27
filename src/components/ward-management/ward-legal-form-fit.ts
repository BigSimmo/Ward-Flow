import type { LegalStatus } from "./ward-model";

/**
 * Findings 6 and 78 (Josh, 27 Oct 2026): a legal form that does not fit the legal status is a
 * warning, never a block. The clinician still chooses both (owner, 24 Aug 2026: "avoid any hard
 * rules now"), so only the two plain contradictions are named: a form for a voluntary patient, and
 * no form for a status that rests on one. Which form fits which status is not judged here.
 *
 * `formCode` is the chosen form's code, `null` for "No form", or `undefined` while unanswered.
 */
export function legalFormStatusWarning(
  legalStatus: LegalStatus | "" | undefined,
  formCode: string | null | undefined,
): string | null {
  if (!legalStatus || formCode === undefined) return null;
  if (legalStatus === "Voluntary" && formCode !== null) {
    return `Check the legal form: Form ${formCode} is chosen, but the legal status is Voluntary.`;
  }
  if (legalStatus !== "Voluntary" && formCode === null) {
    return `Check the legal form: no form is chosen, but the legal status is ${legalStatus}.`;
  }
  return null;
}
