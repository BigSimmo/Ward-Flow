"use client";

import { useEffect, useSyncExternalStore } from "react";
import { WARD_DESK_PENDING_ATTRIBUTE } from "./ward-desk-early";

const never = () => () => {};

/**
 * H-0111: clears the first-load mark set by `WARD_DESK_EARLY_SCRIPT` once the app has drawn the
 * device's own desk. The browser's first pass draws the server's page; the pass straight after it
 * reads the stored desk (here and in the access store together), and this effect runs once that
 * pass is on screen, so the page area is shown with the right desk's page and never the wrong one.
 */
export function WardDeskPendingClear() {
  const deskKnown = useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
  useEffect(() => {
    if (deskKnown) document.documentElement.removeAttribute(WARD_DESK_PENDING_ATTRIBUTE);
  }, [deskKnown]);
  return null;
}
