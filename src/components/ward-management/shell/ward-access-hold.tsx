"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { WARD_DESK_PENDING_ATTRIBUTE } from "./ward-desk-early";

const never = () => () => {};

/** False in the server's page and the browser's first pass over it; true from the pass after. */
function useDeskKnown(): boolean {
  return useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
}

/**
 * H-0111: clears the first-load mark set by `WARD_DESK_EARLY_SCRIPT` once the app has drawn the
 * device's own desk. The browser's first pass draws the server's page; the pass straight after it
 * reads the stored desk (here and in the access store together), and this effect runs once that
 * pass is on screen, so the page area is shown with the right desk's page and never the wrong one.
 */
export function WardDeskPendingClear() {
  const deskKnown = useDeskKnown();
  useEffect(() => {
    if (deskKnown) document.documentElement.removeAttribute(WARD_DESK_PENDING_ATTRIBUTE);
  }, [deskKnown]);
  return null;
}

/**
 * Desk walk follow-up (9 Nov 2026): when the request carried `WARD_DESK_HELD_COOKIE` (a desk other
 * than the whole-network coordinator's), the server sends `placeholder` in place of the page, and
 * the browser's first pass keeps it so the two match. The pass after reads the stored desk, so the
 * page is first drawn for that desk and the coordinator's figures never reach the page at all.
 * Since D-137 (10 Nov 2026) a fresh device, which sends no cookie, is held as well; only a browser
 * whose desk is the whole-network coordinator's gets the server's page straight away.
 */
export function WardDeskHold({
  held,
  placeholder,
  children,
}: {
  held: boolean;
  placeholder: ReactNode;
  children: ReactNode;
}) {
  const deskKnown = useDeskKnown();
  return held && !deskKnown ? placeholder : children;
}
