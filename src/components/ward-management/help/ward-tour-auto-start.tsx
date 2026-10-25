"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useTourRole, useTourSeen } from "./ward-help-store";
import { useTourFacts } from "./ward-tour-facts";
import { markWhatsNewSeen } from "./ward-whats-new";

export const TOUR_AUTO_DONE_STORAGE_KEY = "ward_flow_choice_tour_auto_done";

/**
 * Whether a tour has already started on its own on this device. Josh, 24 Oct 2026: help must not
 * keep appearing. The tour starts by itself once per device, whichever desk is signed in, and after
 * that only from Help or Settings. Kept here, not in the store, so the rail's first load stays the
 * same size; the `ward_flow_choice_` prefix keeps it at sign-out. Unreadable storage counts as
 * done, so a blocked store never brings the tour back at every visit.
 */
function readTourAutoDone(): boolean {
  try {
    return window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

/**
 * Records that the tour has started on its own on this device (the value is a fixed word), and says
 * whether that was saved. A tour whose mark cannot be saved does not start on its own, or it would
 * start again at the next visit.
 */
function markTourAutoDone(): boolean {
  try {
    window.localStorage.setItem(TOUR_AUTO_DONE_STORAGE_KEY, "yes");
    return true;
  } catch {
    return false;
  }
}

/**
 * How long the desk, its home and the page must hold still before the tour starts. The first
 * render reads the whole-network coordinator until the stored or shared desk applies, and a desk
 * switch changes the role before it reaches the new home, so the tour waits for both to settle.
 */
const TOUR_SETTLE_MS = 500;

/**
 * Starts the tour once per device: the first time a signed-in desk reaches its own home screen.
 * Mounted only while role access is on (a desk is signed in), so the shared demo never pops it up.
 * The device is marked the moment the tour starts, so a reload, a desk switch or a role that
 * settles late never starts it again. After that, Help (with its "New" marker for a desk whose tour
 * is unseen) and Settings are the way in.
 */
export function WardTourAutoStart({ onStart }: { onStart: () => void }) {
  const role = useTourRole();
  const seen = useTourSeen(role);
  const { home, deskHome } = useTourFacts(role);
  const pathname = usePathname() ?? "";
  const started = useRef(false);
  useEffect(() => {
    if (started.current || seen || !home || (pathname !== home && pathname !== deskHome)) return;
    const timer = window.setTimeout(() => {
      started.current = true;
      if (readTourAutoDone() || !markTourAutoDone()) return;
      // A first visit gets the tour, not the what's new note as well.
      markWhatsNewSeen();
      onStart();
    }, TOUR_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [deskHome, home, onStart, pathname, role, seen]);
  return null;
}
