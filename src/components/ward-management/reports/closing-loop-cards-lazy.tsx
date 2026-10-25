"use client";

import dynamic from "next/dynamic";

/**
 * Statistics' waiting-stages and fixed-questions cards (closing-the-loop features, Josh, 24 Oct
 * 2026), loaded on their own so the Statistics page's first load does not carry them. Desktop only:
 * the phone summary never draws them. `loading` gives each card its own Suspense boundary.
 */
const cardPending = () => null;

export const WaitingStagesCard = dynamic(() => import("./waiting-stages-card").then((m) => m.WaitingStagesCard), {
  loading: cardPending,
});

export const FixedQuestionsCard = dynamic(() => import("./fixed-questions-card").then((m) => m.FixedQuestionsCard), {
  loading: cardPending,
});
