/*
 * Test-only drawer openers for the community team screen.
 *
 * The screen used to install ten functions on `window` on every visit (`use-community-screen-
 * window-bridge.ts`), three of which wrote records (accept, decline, complete contact) while
 * skipping the screen's own steps. Nothing in the app called any of them (production audit USC-03,
 * deleted with Josh's approval, 25 Oct 2026). Two DOM tests still open the referral and patient
 * drawers by id, including ids no row on screen would offer, so these two openers remain, and only
 * when `NODE_ENV` is `"test"`. Next.js inlines `NODE_ENV` at build time, so a production bundle
 * never installs them. They open a drawer; they record nothing.
 */

import { useEffect } from "react";

type CommunityDrawerTestWindow = Window & {
  openReferralDrawer?: (referralId: string) => void;
  openPatientDrawer?: (patientId: string) => void;
};

export function useCommunityDrawerTestOpeners({
  openReferralDrawer,
  openPatientDrawer,
}: {
  openReferralDrawer: (referralId: string) => void;
  openPatientDrawer: (patientId: string) => void;
}): void {
  useEffect(() => {
    if (process.env.NODE_ENV !== "test" || typeof window === "undefined") return;
    const win: CommunityDrawerTestWindow = window;
    win.openReferralDrawer = openReferralDrawer;
    win.openPatientDrawer = openPatientDrawer;
    return () => {
      delete win.openReferralDrawer;
      delete win.openPatientDrawer;
    };
  }, [openReferralDrawer, openPatientDrawer]);
}
