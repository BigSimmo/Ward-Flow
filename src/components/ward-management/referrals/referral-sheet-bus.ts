"use client";

// RQ9 (Josh, 3 Nov 2026): open the Referral sheet from anywhere. A button anywhere in the app calls
// `openReferralRecord`; `ReferralSheetHost`, mounted once in the shell, shows the sheet. Carries an
// id only, never a name or any typed text.

const REFERRAL_RECORD_EVENT = "ward-flow-open-referral-record";

export type ReferralSheetTab = "summary" | "full" | "sent";

export type ReferralRecordRequest = { referralId: string; tab?: ReferralSheetTab };

/** Opens the Referral sheet for one referral, on the Summary tab unless another is named. */
export function openReferralRecord(referralId: string, tab?: ReferralSheetTab) {
  if (typeof window === "undefined" || !referralId) return;
  window.dispatchEvent(
    new CustomEvent<ReferralRecordRequest>(REFERRAL_RECORD_EVENT, { detail: { referralId, ...(tab ? { tab } : {}) } }),
  );
}

export function subscribeReferralRecord(onOpen: (request: ReferralRecordRequest) => void) {
  if (typeof window === "undefined") return () => {};
  function handler(event: Event) {
    const detail = (event as CustomEvent<ReferralRecordRequest>).detail;
    if (detail?.referralId) onOpen(detail);
  }
  window.addEventListener(REFERRAL_RECORD_EVENT, handler);
  return () => window.removeEventListener(REFERRAL_RECORD_EVENT, handler);
}
