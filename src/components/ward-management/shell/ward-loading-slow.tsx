"use client";

import { useEffect, useState } from "react";

/** How long a page change may show "Loading page" before the line offers a way out. */
export const WARD_PAGE_SLOW_MS = 10_000;

/**
 * Q275 (pre-launch review E3, 2 Nov 2026): a page change that never finished (slow server, a
 * captive Wi-Fi portal) showed "Loading page" forever. After `WARD_PAGE_SLOW_MS` this adds "This is
 * taking longer than usual." and a Try again button, which loads the address afresh. It sits inside
 * the placeholder's status line, so the change is read out. No kit import: the loading boundary
 * stays light (app/ward-flow/loading.tsx).
 */
export function WardLoadingSlow({ className, buttonClassName }: { className?: string; buttonClassName?: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), WARD_PAGE_SLOW_MS);
    return () => window.clearTimeout(timer);
  }, []);
  if (!slow) return null;
  return (
    <span className={className} data-testid="ward-loading-slow">
      This is taking longer than usual.
      <button type="button" className={buttonClassName} onClick={() => window.location.reload()}>
        Try again
      </button>
    </span>
  );
}
