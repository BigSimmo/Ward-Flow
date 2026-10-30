"use client";

import { WardScreen } from "@/components/ward-redesign/ward/ward-screen";

/** The one ward the mock-up draws, as the app's own example address does. */
const WARD_ID = "rph-adult-secure";

/**
 * My ward, redesigned. A fork of the real screen (`ward-screen.tsx` and the files it draws through:
 * `ward-screen-top-bar.tsx`, `ward-screen-home-section.tsx`, `ward-home-tab.tsx` and its CSS module)
 * holds every design change in markup, so a diff of each copy against its source is the change to
 * build. The nurse in charge's differences are commented role branches inside the same copies, so
 * one component serves the coordinator and the ward desk.
 */
export function WardRedesign() {
  return <WardScreen unitId={WARD_ID} />;
}
