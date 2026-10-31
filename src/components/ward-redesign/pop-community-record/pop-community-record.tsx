"use client";

import type { ReactNode } from "react";

import { useClickOnLoad, visibleControl } from "@/components/ward-redesign/pop-community-note/click-on-load";

/**
 * The Community record drawer mock-up: the Midland team page with the first person's record open.
 * The page draws the redesigned drawer (`community-record-drawer.tsx`); this presses the page's own
 * control for the first person in a bed (the name on a computer, the row on a phone).
 */
export function PopCommunityRecord({ page }: { page: ReactNode }) {
  useClickOnLoad(
    () =>
      visibleControl('[data-testid^="ward-community-phone-in-bed-"] button') ??
      visibleControl('[data-testid^="ward-community-open-dossier-"]'),
  );
  return <>{page}</>;
}
