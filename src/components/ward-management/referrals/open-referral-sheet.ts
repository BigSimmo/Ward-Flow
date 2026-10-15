import { REFERRAL_SHEET_PATH } from "./referral-sheet-link";

/** The New referral link for one person, from an emergency department. */
export function edReferralSheetHref(patientId: string | undefined, edId: string): string {
  const params = new URLSearchParams({ source: "ed_medical", refer: "ward", originEdId: edId });
  if (patientId) params.set("patientId", patientId);
  return `${REFERRAL_SHEET_PATH}?${params.toString()}`;
}
