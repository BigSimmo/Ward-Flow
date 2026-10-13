import { REFERRAL_SHEET_PATH } from "./referral-sheet-link";

/** The New referral link for one person, from an emergency department. */
export function edReferralSheetHref(patientId: string | undefined, edId: string): string {
  const params = new URLSearchParams({ source: "ed_medical", refer: "ward", originEdId: edId });
  if (patientId) params.set("patientId", patientId);
  return `${REFERRAL_SHEET_PATH}?${params.toString()}`;
}

/**
 * Opens the New referral slide-out from a button. The shell opens every link to the slide-out
 * route in place (`ward-bar.tsx`, capture-phase click on `a[href]`), so a button follows the same
 * path by clicking a transient link; outside the shell the link navigates as any link would.
 */
export function openReferralSheet(href: string): void {
  const link = document.createElement("a");
  link.href = href;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
  }
}
