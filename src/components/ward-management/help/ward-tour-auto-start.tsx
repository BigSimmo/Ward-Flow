"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useTourRole, useTourSeen } from "./ward-help-store";
import { useTourFacts } from "./ward-tour-facts";

/**
 * How long the desk, its home and the page must hold still before the tour starts. The first
 * render reads the whole-network coordinator until the stored or shared desk applies, and a desk
 * switch changes the role before it reaches the new home, so the tour waits for both to settle.
 */
const TOUR_SETTLE_MS = 500;

/**
 * Starts the tour once, the first time a signed-in desk reaches its own home screen on this device.
 * Mounted only while role access is on (a desk is signed in), so the shared demo never pops it up.
 * Anywhere else, and after the tour has been seen or closed, Help's "New" marker is the way in.
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
      onStart();
    }, TOUR_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [deskHome, home, onStart, pathname, role, seen]);
  return null;
}
