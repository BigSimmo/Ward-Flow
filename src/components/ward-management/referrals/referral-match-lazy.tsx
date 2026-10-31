"use client";
// Copied from src/components/ward-management/referrals/referral-match-lazy.tsx (Referrals redesign).

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";

/**
 * Phone script budget (19 October 2026): the match panel and its tiers are about 16 KB of the
 * Referrals page, yet a phone opens the page with no referral chosen, so the panel only draws after
 * a tap. `ReferralBoard` imports it from here, so a phone's first load skips that code. A desktop
 * that opens with the first referral chosen still draws it on the server, and the code is fetched
 * once the browser is idle so a tap normally finds it already there.
 */
const loadReferralMatch = () => import("./referral-match");

// `loading` gives the panel its own Suspense boundary, so only the panel waits for its code rather
// than the whole route (the same reason as `coordinator/shortlist-panel-lazy.tsx`).
export const ReferralMatchView = dynamic(() => loadReferralMatch().then((m) => m.ReferralMatchView), {
  loading: () => null,
});

preloadWhenIdle(loadReferralMatch);
