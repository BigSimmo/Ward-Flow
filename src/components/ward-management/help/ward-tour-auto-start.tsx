"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { parseTourSeen, useTourRole, useTourSeen, type WardTourRole } from "./ward-help-store";
import { useTourFacts } from "./ward-tour-facts";

// The welcome cards, their words and the tour length they quote load only when the offer shows,
// so this file (on every signed-in page) stays small.
const WardTourWelcome = dynamic(() => import("./ward-tour-welcome").then((m) => m.WardTourWelcome), { ssr: false });

export const TOUR_AUTO_DONE_STORAGE_KEY = "ward_flow_choice_tour_auto_done";
// Heard by the what's new note (`ward-whats-new.tsx`), written out so neither loads the other: the
// note carries the whole change list, which must not ride in this file's first-load chunk too.
const TOUR_AUTO_STARTED_EVENT = "ward-flow-tour-auto-started";

/**
 * The desks whose tour has already started on its own on this device. Josh, 24 Oct 2026: help must
 * not keep appearing. Josh, 26 Oct 2026 (HF-01): every device opens as the coordinator first, so a
 * once-per-device tour meant no other desk ever met its own. Each desk's tour now starts by itself
 * once, the first time that desk reaches its home, and after that only from Help or Settings.
 * Josh, 3 Nov 2026 (G3) replaced that: in the demo every desk switch brought the offer back, so the
 * offer now shows once per device (`readTourAutoDone`). Each desk is still marked as it is offered.
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

/**
 * G3 (Josh, Notion "Diagnosed Issues", 3 Nov 2026, "yes to all recommendations"): the tour is now
 * offered once per device, whichever desk reaches its home first. Switching desks in the demo kept
 * bringing the offer back. Each desk's mark is still recorded, and Help keeps every desk's tour.
 */
function readTourAutoDone(): boolean {
  try {
    const raw = window.localStorage.getItem(TOUR_AUTO_DONE_STORAGE_KEY);
    return raw !== null && parseTourAutoDone(raw).length > 0;
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
 * Offers each desk's tour once per device: the first time that signed-in desk reaches its own home
 * screen. P188 (Josh, 27 Oct 2026): the tour is offered, not forced. A small card asks first; "Start
 * the tour" starts it and "Not now" closes the card. Mounted only while role access is on (a desk is
 * signed in), so the shared demo never shows it. The desk is marked the moment the card shows, so a
 * reload or a role that settles late never shows it again; a switch to another desk whose tour has
 * not been offered yet does not (G3, once per device). After that, Help (with its "New" marker for a desk
 * whose tour is unseen) and Settings are the way in.
 *
 * Nov 2026 (Help extension): the small card became three welcome cards (`ward-tour-welcome.tsx`):
 * what Ward Flow is, that it holds made-up data only, and where Help is, then "Start the tour" or
 * "Not now". Same once-per-device rule and storage; the cards load only when offered.
 */
export function WardTourAutoStart({ onStart }: { onStart: () => void }) {
  const role = useTourRole();
  const seen = useTourSeen(role);
  const { home, deskHome } = useTourFacts(role);
  const pathname = usePathname() ?? "";
  const started = useRef<WardTourRole | null>(null);
  // The offer remembers the desk and page it was raised on, so a desk switch cannot leave a card
  // open that would start another desk's tour.
  const [offered, setOffered] = useState<{ readonly role: WardTourRole; readonly pathname: string } | null>(null);
  useEffect(() => {
    if (started.current === role || seen || !home || (pathname !== home && pathname !== deskHome)) return;
    const timer = window.setTimeout(() => {
      started.current = role;
      if (readTourAutoDone() || !markTourAutoDone(role)) return;
      // A first visit gets the tour offer, not the what's new note as well.
      window.dispatchEvent(new Event(TOUR_AUTO_STARTED_EVENT));
      setOffered({ role, pathname });
    }, TOUR_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [deskHome, home, pathname, role, seen]);
  const showing = Boolean(offered && offered.role === role && offered.pathname === pathname);
  if (!showing) return null;
  // Escape is "Not now" (the welcome's own modal contract).
  return (
    <WardTourWelcome
      onStart={() => {
        setOffered(null);
        onStart();
      }}
      onClose={() => setOffered(null)}
    />
  );
}
