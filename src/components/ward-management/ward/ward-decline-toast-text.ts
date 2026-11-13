import { WAITLIST_INSTEAD_OF_DECLINE_REASONS } from "@/components/ward-management/ward-legal-clock";

/**
 * "No suitable bed" and "Bed pulled for earlier referral" put the referral on this ward's waitlist
 * in the engine, so the toast says so rather than "declined".
 *
 * Its own file (phone size, 13 Nov 2026): the Ward screen reads only this line, and importing it from
 * `ward-answer-feedback.tsx` pulled that file and the answer view's stylesheet map onto the Ward
 * page's first load (about 9 KB before compression).
 */
export function declineToastText(reason: string | undefined) {
  return reason && (WAITLIST_INSTEAD_OF_DECLINE_REASONS as readonly string[]).includes(reason)
    ? "Referral waitlisted for this ward."
    : "Referral declined.";
}
