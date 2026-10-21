"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Phone script budget (21 October 2026, fix plan item 4): the owner and call log panel only draws
 * inside an open referral, so a phone's first load skips its code, as the match panel does
 * (`referral-match-lazy.tsx`). The code is fetched once the browser is idle.
 */
const loadReferralOwnerAndCalls = () => import("./referral-owner-and-calls-panel");

export const ReferralOwnerAndCalls = dynamic(() => loadReferralOwnerAndCalls().then((m) => m.ReferralOwnerAndCalls), {
  loading: () => null,
});

preloadWhenIdle(loadReferralOwnerAndCalls);
