"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useTourRole, useTourSeen } from "./ward-help-store";
import { useTourFacts } from "./ward-tour-facts";

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
    started.current = true;
    onStart();
  }, [deskHome, home, onStart, pathname, seen]);
  return null;
}
