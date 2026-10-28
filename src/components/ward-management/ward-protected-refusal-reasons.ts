import type { AuditDecision } from "./ward-audit";

// Kept apart from the protected-record event slice so page code (the provider) can use it without
// pulling the lazy reducer slice into its static imports (tests/ward-reducer-lazy-slices.test.ts).
/**
 * What a refused protected-record step says when its check gives no reason of its own: what
 * happened, then what to do (stress test 25 Oct 2026). A record outside the desk's place and one
 * that does not exist read alike, so the wording never says which.
 */
export const PROTECTED_REFUSAL_REASONS: Record<AuditDecision["reasonCode"], string> = {
  none: "This change was not made. Check the board, then try again. Nothing was changed.",
  role: "Your role cannot make this change. Nothing was changed.",
  scope: "This record is not open to your desk, or no longer exists. Nothing was changed.",
  "missing-or-inaccessible": "This record is not open to your desk, or no longer exists. Nothing was changed.",
  revision: "Someone else changed this record first. Check the board, then try again. Nothing was changed.",
  generation:
    "The board was reset or replaced since you opened this. Check the board, then try again. Nothing was changed.",
  transition:
    "This record has moved on to a step that does not allow this change. Check the board. Nothing was changed.",
  "invalid-payload": "Some details were missing or not valid. Check the form, then try again. Nothing was changed.",
  "identity-link":
    "The patient record link could not be checked. Check the patient, then try again. Nothing was changed.",
};
