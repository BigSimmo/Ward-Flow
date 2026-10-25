"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Phone script budget (closing-the-loop package A, 24 Oct 2026): the response commitment panels
 * draw only inside an open referral or a ward's inbox card, so a phone's first load skips their
 * code, as the owner and call log panel does (`referral-owner-and-calls-lazy.tsx`).
 */
const loadReferralCommitments = () => import("./referral-commitments-panel");

export const ReferralCommitments = dynamic(() => loadReferralCommitments().then((m) => m.ReferralCommitments), {
  loading: () => null,
});

export const WardCommitmentControls = dynamic(() => loadReferralCommitments().then((m) => m.WardCommitmentControls), {
  loading: () => null,
});

preloadWhenIdle(loadReferralCommitments);
