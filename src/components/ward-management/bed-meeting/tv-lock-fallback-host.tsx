"use client";

/**
 * F-65 (K8, RC 5.3, A14-24): mounted once in the layout beside `TvLockGuard`. A browser locked as a
 * TV whose TV view shows no Unlock of its own (closed to this desk, failed to load, or the TV views
 * switched off) gets the stand-in Unlock after a short wait, so the lock can never trap it. The
 * control's code loads only then, so the layout still carries no dialog code.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { withLoadRetry } from "@/components/ward-management/load-retry";

import { isTvPath, useTvLock, useTvLockControlShown } from "./tv-lock-guard";

/** Long enough for a TV view that is still loading to draw its own control first. */
export const TV_LOCK_FALLBACK_WAIT_MS = 2000;

const TvLockFallback = dynamic(
  withLoadRetry(() => import("./tv-lock").then((m) => m.TvLockFallback)),
  { loading: () => null },
);

export function TvLockFallbackHost() {
  const locked = useTvLock();
  const pathname = usePathname() ?? "";
  const controlShown = useTvLockControlShown();
  const stuck = locked !== null && isTvPath(pathname) && !controlShown;
  const [waitedFor, setWaitedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!stuck) return;
    const timer = window.setTimeout(() => setWaitedFor(locked), TV_LOCK_FALLBACK_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [stuck, locked]);
  return locked !== null && stuck && waitedFor === locked ? <TvLockFallback href={locked} /> : null;
}
