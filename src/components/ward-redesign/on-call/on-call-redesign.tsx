"use client";

import { OnCallScreen } from "./on-call-screen";

/**
 * On-call, redesigned. The review found the page the right shape and its problems density, so it
 * draws a copy of today's screen (`on-call-screen.tsx`, `on-call-parts.tsx`, `on-call.module.css`;
 * cover times, My list, Copy who is on, the downtime card and every mock number work as now) with
 * the redesign made in the copied stylesheet: the seven service lines become a compact two-line
 * strip, and the directory's filters sit closer together.
 */
export function OnCallRedesign() {
  return <OnCallScreen />;
}
