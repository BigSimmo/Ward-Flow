"use client";

// Ward page parts a person opens on purpose: the accept dialog, the Decisions jobs strip, the overrides
// register. Each arrives as its own chunk when first shown, so the phone's first load stays inside
// its script budget (4 Nov 2026, #1360). Nothing here renders before it is asked for.

import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";

export const WardAcceptDialog = dynamic(
  withLoadRetry(() => import("./ward-answer-accept-dialog").then((m) => m.WardAcceptDialog)),
  {
    ssr: false,
  },
);
export const WardScreenDecisionJobs = dynamic(
  withLoadRetry(() => import("./ward-screen-decision-jobs").then((m) => m.WardScreenDecisionJobs)),
  { ssr: false },
);
export const OverrideRegister = dynamic(
  withLoadRetry(() => import("@/components/ward-management/override-register").then((m) => m.OverrideRegister)),
  { ssr: false, loading: () => <p role="status">Loading overrides…</p> },
);
