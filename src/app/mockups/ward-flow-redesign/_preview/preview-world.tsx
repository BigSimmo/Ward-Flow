"use client";

import type { ReactNode } from "react";

import { OverlayScope, ToastProvider } from "@/components/wf";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardLiveRegion } from "@/components/ward-management/shell/ward-live-region";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WARD_OFFLINE_SAVED_NOTE } from "@/components/ward-management/ward-offline-copy";

import layoutStyles from "../../../ward-flow/ward-flow-layout.module.css";

/**
 * Preview only. The same synthetic world every `/ward-flow` page reads, pinned to the 10:42 night
 * the fixtures were written for, so each mock-up shows the same figures as the running app and a
 * screenshot of one can sit beside the other. Nothing here saves or reaches a provider: the shared
 * connection is never turned on for a pinned clock.
 */
export function PreviewWorld({ children }: { children: ReactNode }) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider offlineNote={WARD_OFFLINE_SAVED_NOTE}>
        <OverlayScope className={layoutStyles.overlayScope} />
        <WardLiveRegion />
        {children}
      </ToastProvider>
    </WardFlowProvider>
  );
}
