import { recordedMovementMedicalClearance } from "@/components/ward-management/ward-medical-clearance";
import { type Movement, type Referral } from "@/components/ward-management/ward-model";

import type { IsbarRecorded } from "./referral-board-sheets";

// Moved out of referral-board.tsx (page tops, 9 Nov 2026) to keep the board under its line cap.

/** The kit drawer the chosen referral opens in (drawer review, 6 Nov 2026). */
export const REFERRAL_DRAWER_TEST_ID = "ward-referral-detail";

/**
 * Another overlay is over the page: a sheet, a menu's dialog or a form. The referral's own drawer is
 * not one, so the board's keys (J, K, A, D, S, 1 to 3) keep working while it is open.
 */
export function otherOverlayOpen(): boolean {
  return Array.from(document.querySelectorAll('[aria-modal="true"]')).some(
    (modal) => modal.getAttribute("data-testid") !== REFERRAL_DRAWER_TEST_ID,
  );
}

/**
 * WS-18: the decision's own controls (`referral-match.tsx`) that the A and D keys use. A presses
 * Accept at the chosen ward, or an ED's Accept presentation, which still asks to confirm. The
 * community team's Accept referral decides in one press with no choice before it, so it stays a tap.
 * D opens the ward's decline reasons, or moves to an ED's or a community team's reason list.
 */
export const REFERRAL_ACCEPT_CONTROL =
  '[data-testid="ward-referral-match-phone-accept"], [data-testid="ward-referral-match-accept-emergency_department"]';
export const REFERRAL_DECLINE_CONTROL =
  '[data-testid="ward-referral-match-decline-open"], [data-testid="ward-referral-match-decline-reason-emergency_department"], [data-testid="ward-referral-match-decline-reason-community_team"]';

export function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable === true
  );
}

/** The record's legal status and clearance for the summary: the linked journey's, or the referral's own. */
export function isbarRecorded(
  referral: Referral,
  movements: readonly Movement[],
  referrals: readonly Referral[],
): IsbarRecorded {
  const linked = movements.find((movement) => movement.referralId === referral.id && !movement.closure);
  return {
    legalStatus: linked?.legalStatus,
    clearance: linked ? recordedMovementMedicalClearance(linked, referrals) : referral.medicalClearance,
  };
}
