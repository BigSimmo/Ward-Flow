"use client";

import { useIsPhone, useIsTabletLandscape, useIsTabletPortrait } from "@/components/wf";

/**
 * Home's four layouts (v10 Home chapter, Tablet and Phone). The tablet ranges are the shell's own:
 * landscape 1001 to 1200px keeps the icon rail, portrait 769 to 1000px has no rail.
 *
 * - desktop: three equal columns (queue, State bedflow, Placement).
 * - tablet-landscape: two columns, the queue and one panel that switches between Placement and
 *   State bedflow.
 * - tablet-portrait: one column behind a segmented control (Priority queue, State bedflow);
 *   choosing a patient opens Placement as a side sheet over a scrim.
 * - phone: direction A, queue first, with sheets.
 */
export type HomeLayout = "desktop" | "tablet-landscape" | "tablet-portrait" | "phone";

/** Desktop on the server and on first paint, so the desktop tree is the hydration default. */
export function useHomeLayout(): HomeLayout {
  const phone = useIsPhone();
  const portrait = useIsTabletPortrait();
  const landscape = useIsTabletLandscape();
  if (phone) return "phone";
  if (portrait) return "tablet-portrait";
  if (landscape) return "tablet-landscape";
  return "desktop";
}
