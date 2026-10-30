// Preview wrapper of `sampleProfile` in src/components/ward-management/referrals/ward-referral-drawer-model.ts.
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { Patient } from "@/components/ward-management/ward-patients";
import {
  sampleProfile as sharedSampleProfile,
  type MockPatientProfile,
} from "@/components/ward-management/referrals/ward-referral-drawer-model";

// The hook copy takes its model and sender imports from here, so it stays under 1,500 lines.
export * from "@/components/ward-management/referrals/ward-referral-drawer-model";
export {
  NO_SENDING_WARD,
  useReferralUrlPrefill,
  useSheetSender,
} from "@/components/ward-management/referrals/use-referral-sheet-sender";

/**
 * The slide-out's patient profile with the person named surname first (D-83). The shared profile
 * names an ED stay with the display name; a registered person is already "Family, Given".
 */
export function sampleProfile(
  key: string,
  record: { movements: Movement[]; patients: Patient[]; referrals: Referral[]; dayZero: Date },
  now: Instant,
): MockPatientProfile {
  const profile = sharedSampleProfile(key, record, now);
  const movement = record.movements.find((candidate) => candidate.id === key);
  if (!movement) return profile;
  return { ...profile, name: resolveSubjectPatient(movement, record).formalName };
}
