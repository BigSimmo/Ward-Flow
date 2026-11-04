"use client";

// Ward page parts a person opens on purpose: the accept dialog, the Decisions jobs strip, the overrides
// register. Each arrives as its own chunk when first shown, so the phone's first load stays inside
// its script budget (4 Nov 2026, #1360). Nothing here renders before it is asked for.

import dynamic from "next/dynamic";

export const WardAcceptDialog = dynamic(() => import("./ward-answer-accept-dialog").then((m) => m.WardAcceptDialog), {
  ssr: false,
});
export const WardScreenDecisionJobs = dynamic(
  () => import("./ward-screen-decision-jobs").then((m) => m.WardScreenDecisionJobs),
  { ssr: false },
);
export const OverrideRegister = dynamic(
  () => import("@/components/ward-management/override-register").then((m) => m.OverrideRegister),
  { ssr: false },
);
