import type { LegalStatus } from "@/components/ward-management/ward-model";
import { classifyLegalStatus } from "@/components/ward-management/ward-legal-status";

/**
 * THE TWO NAMED LEGAL RULES (D-186 item 4, D-187 item 3; Q4 and Q24 of the clinical sign-off
 * sitting, 13 Nov 2026). Each screen and count says which of the two it uses. Both read the one
 * classification in `ward-legal-status.ts`, so a free-text patient status and a movement's closed
 * `LegalStatus` are read the same way.
 *
 * - `isNotVoluntary`: anything recorded that is not Voluntary. A referral for psychiatric
 *   examination, a detention, an involuntary order, a community treatment order and unrecognised
 *   text all count. Nothing recorded (blank, or the words "Not recorded") does not.
 * - `isDetained`: held under the Act right now, "Detained awaiting examination" or an involuntary
 *   inpatient. "Referred for psychiatric examination" is a referral for assessment, not detention,
 *   so it is left out (the 9 October 2026 rule "Referred is not involuntary", and the Act s 4 as
 *   quoted in the clinical check pack). This is the rule the ED detained counts have always used.
 *
 * Neither rule changes a clinical value or threshold. They only name a meaning that used to be
 * written out again in several files.
 */
export function isNotVoluntary(status: LegalStatus | string | undefined): boolean {
  const kind = classifyLegalStatus(status);
  return kind !== "voluntary" && kind !== "not_recorded";
}

/** Held under the Act now: detained awaiting examination or involuntary. Never a referral (D-187 item 3). */
export function isDetained(status: LegalStatus | string | undefined): boolean {
  return classifyLegalStatus(status) === "detained";
}
