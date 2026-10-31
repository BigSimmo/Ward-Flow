"use client";

import type { ReactNode } from "react";

import { useClickOnLoad, visibleControl } from "./click-on-load";

/**
 * The Community note mock-up: the Midland team page with Record contact open. The page draws the
 * redesigned dialog (`community-note-dialog.tsx`); this presses the page's own Record contact button
 * (the hero's on a computer, the chip on a phone).
 */
export function PopCommunityNote({ page }: { page: ReactNode }) {
  useClickOnLoad(
    () =>
      visibleControl('[data-testid="ward-community-phone-chip-contact"]') ?? visibleControl("button", "Record contact"),
  );
  return <>{page}</>;
}
