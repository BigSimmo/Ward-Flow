import type { ReferralIntakeDetails } from "@/components/ward-management/referrals/referral-submission";

/**
 * H-0821: the one list of risk flag words. The referral drawer, the ward's referral detail and the
 * officer's job panel all read it, so a flag reads the same on every screen. Kept in its own small
 * module so the officer's phone bundle does not pull in the referral drawer.
 */
export const RISK_FLAG_LABELS: Record<ReferralIntakeDetails["riskFlags"][number], string> = {
  aggression: "Aggression",
  absconding: "Absent without leave",
  medical: "Acute medical",
  vulnerable: "Vulnerable adult",
  suicide: "Suicide or self-harm",
};

/** A recorded flag in words; a flag not on the list reads as recorded. */
export function riskFlagLabel(flag: string): string {
  return Object.hasOwn(RISK_FLAG_LABELS, flag) ? RISK_FLAG_LABELS[flag as keyof typeof RISK_FLAG_LABELS] : flag;
}
