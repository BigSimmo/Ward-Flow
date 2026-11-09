"use client";

import dynamic from "next/dynamic";

import { useTrainingMode } from "@/components/ward-management/demo-reset/ward-training-mode";

/**
 * Feature 47: while this tab is in the training sandbox, every Ward Flow page says so, above the
 * pinned notes, with the way out. The layout carries only this gate on every page (phone size
 * limits); the banner's code loads the first time training is on.
 */
const Body = dynamic(() => import("./ward-training-banner-body").then((m) => m.WardTrainingBannerBody), {
  ssr: false,
});

export function WardTrainingBanner() {
  return useTrainingMode() ? <Body /> : null;
}
