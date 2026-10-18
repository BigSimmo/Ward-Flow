import type { LegalStatus } from "@/components/ward-management/ward-model";

/**
 * ONE READING OF A LEGAL STATUS (review 18 Oct 2026, item 4). A movement's status is the closed
 * `LegalStatus` union; a patient record's is free text. Both used to be read with separate exact
 * matches and patterns in several files, and one case, a patient record of "Referred for
 * psychiatric examination", was read as "not recorded" by criteria led discharge. Every reader of a
 * free-text status now goes through `classifyLegalStatus`, and `tests/ward-legal-status.test.ts`
 * covers every class.
 *
 * - `voluntary`: recorded as voluntary.
 * - `referred`: on a referral for psychiatric examination, not yet an involuntary patient.
 * - `detained`: detained awaiting examination, or an involuntary patient (any "Involuntary ..." text).
 * - `cto`: a community treatment order.
 * - `not_recorded`: nothing recorded.
 * - `unrecognised`: text that is none of the above. Never guessed into a class: each reader below
 *   decides which way an unknown status fails, and says so.
 */
export type LegalStatusClass = "voluntary" | "referred" | "detained" | "cto" | "not_recorded" | "unrecognised";

export function classifyLegalStatus(status: LegalStatus | string | undefined): LegalStatusClass {
  const text = status?.trim() ?? "";
  if (text === "") return "not_recorded";
  if (/community treatment order/i.test(text)) return "cto";
  if (/^voluntary\b/i.test(text)) return "voluntary";
  if (/^referred for psychiatric examination\b/i.test(text)) return "referred";
  if (/^involuntary\b/i.test(text) || /^detained awaiting examination$/i.test(text)) return "detained";
  return "unrecognised";
}

/**
 * Whether a status is detained or involuntary, for the discharge guards. Deliberately excludes a
 * referral and unknown text, so it never widens a hard refusal beyond what is recorded.
 */
export function legalStatusIsDetained(status: LegalStatus | string | undefined): boolean {
  return classifyLegalStatus(status) === "detained";
}

/**
 * On an order: any recorded status that is not voluntary, including a referral, a community
 * treatment order and unknown text. Not recorded is not assumed either way.
 */
export function legalStatusIsOnOrder(status: LegalStatus | string | undefined): boolean {
  const kind = classifyLegalStatus(status);
  return kind !== "voluntary" && kind !== "not_recorded";
}
