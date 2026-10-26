"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { parseTourSeen, useTourRole, useTourSeen, type WardTourRole } from "./ward-help-store";
import { useTourFacts } from "./ward-tour-facts";

export const TOUR_AUTO_DONE_STORAGE_KEY = "ward_flow_choice_tour_auto_done";
// Heard by the what's new note (`ward-whats-new.tsx`), written out so neither loads the other: the
// note carries the whole change list, which must not ride in this file's first-load chunk too.
const TOUR_AUTO_STARTED_EVENT = "ward-flow-tour-auto-started";

/**
 * The desks whose tour has already started on its own on this device. Josh, 24 Oct 2026: help must
 * not keep appearing. Josh, 26 Oct 2026 (HF-01): every device opens as the coordinator first, so a
 * once-per-device tour meant no other desk ever met its own. Each desk's tour now starts by itself
 * once, the first time that desk reaches its home, and after that only from Help or Settings.
 *
 * Stored as desk role ids only. The old value "yes" was written before this change, when the
 * device's first desk was nearly always the coordinator, so it reads as the coordinator's mark.
 * Kept here, not in the store, so the rail's first load stays the same size; the
 * `ward_flow_choice_` prefix keeps it at sign-out. Unreadable storage counts as done, so a blocked
 * store never brings the tour back at every visit.
 */
export function parseTourAutoDone(raw: string): readonly WardTourRole[] {
  return parseTourSeen(raw.replace(/^yes$/u, "coordinator"));
}

function readTourAutoDone(role: WardTourRole): boolean {
  try {
    const raw = window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY);
    return raw !== null && parseTourAutoDone(raw).includes(role);
  } catch {
    return true;
  }
}

/**
 * Records that this desk's tour has started on its own on this device, and says whether that was
 * saved. A tour whose mark cannot be saved does not start on its own, or it would start again at
 * the next visit.
 */
function markTourAutoDone(role: WardTourRole): boolean {
  try {
    const done = parseTourAutoDone(window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY) ?? "");
    window.localStorage.setItem(TOUR_AUTO_DONE_STORAGE_KEY, [...new Set([...done, role])].join(","));
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
 * Starts each desk's tour once per device: the first time that signed-in desk reaches its own home
 * screen. Mounted only while role access is on (a desk is signed in), so the shared demo never pops
 * it up. The desk is marked the moment its tour starts, so a reload or a role that settles late
 * never starts it again; a switch to another desk whose tour has not started yet does start that
 * desk's. After that, Help (with its "New" marker for a desk whose tour is unseen) and Settings are
 * the way in.
 */
export function WardTourAutoStart({ onStart }: { onStart: () => void }) {
  const role = useTourRole();
  const seen = useTourSeen(role);
  const { home, deskHome } = useTourFacts(role);
  const pathname = usePathname() ?? "";
  const started = useRef<WardTourRole | null>(null);
  useEffect(() => {
    if (started.current === role || seen || !home || (pathname !== home && pathname !== deskHome)) return;
    const timer = window.setTimeout(() => {
      started.current = role;
      if (readTourAutoDone(role) || !markTourAutoDone(role)) return;
      // A first visit gets the tour, not the what's new note as well.
      window.dispatchEvent(new Event(TOUR_AUTO_STARTED_EVENT));
      onStart();
    }, TOUR_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [deskHome, home, onStart, pathname, role, seen]);
  return null;
}
