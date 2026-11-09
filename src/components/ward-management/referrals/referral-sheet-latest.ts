// RQ9 (Josh, 3 Nov 2026): the one referral a patient panel's Referral button opens. Reads the
// patient link (archived D-14 allowlist entry, tests/ward-patient-link-default-deny.test.ts) to find that
// person's own latest referral, and nothing else: one referral, never a list or a history.
import type { Referral } from "@/components/ward-management/ward-model";

/**
 * The newest referral linked to this person in the referrals the desk can already see (the store
 * is scoped to the desk before any screen reads it). `undefined` when none is linked.
 */
export function latestReferralForPerson(
  personId: string | undefined,
  referrals: readonly Referral[],
): Referral | undefined {
  if (!personId) return undefined;
  let latest: Referral | undefined;
  for (const referral of referrals) {
    if (referral.patientId !== personId) continue;
    if (latest === undefined || referral.raisedAt > latest.raisedAt) latest = referral;
  }
  return latest;
}
