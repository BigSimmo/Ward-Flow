// The bar's two scroll watchers (phone bar and desktop band header), moved out of `ward-bar.tsx`
// to keep it under the line cap.
import { useEffect, useState, type RefObject } from "react";

import { WF_BAND_SCROLLED_PX } from "@/components/wf";

/**
 * True once the page has scrolled past `enterPx`, and false again only at or under `exitPx`. The
 * separate thresholds stop a small scroll reversal or bounce near the top flicking the bar. The
 * work column scrolls inside `[data-wf-scroller]`; the window is watched too, for a page shown
 * without the shell's column and for widths where the window scrolls.
 */
function useScrolledPast(
  barRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  enterPx: number,
  exitPx: number,
): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const scroller = barRef.current?.closest<HTMLElement>("[data-wf-scroller]") ?? null;
    let frame = 0;
    const update = () => {
      frame = 0;
      const offset = Math.max(scroller?.scrollTop ?? 0, window.scrollY);
      setScrolled((previous) => offset > (previous ? exitPx : enterPx));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [barRef, enabled, enterPx, exitPx]);

  return enabled && scrolled;
}

/**
 * Phone bar (Josh, 8 Oct 2026, board 00b): bar A with C's behaviour. It never hides. At the top of
 * the page it sits on the page with no fill; once the page scrolls its controls condense and it
 * turns solid. Its layout height stays fixed so scrolling never moves the content below it.
 * Phone only: `enabled` is false above 48rem, so the desktop bar never gets `data-scrolled`.
 * Phone scrolls inside the work column, not the window, so iOS Safari's toolbar never collapses and
 * the fixed dock stays put (Josh, 12 Oct 2026).
 */
const SCROLLED_AFTER_PX = 8;
const RESTING_BELOW_PX = 2;

export function useBarScrolled(barRef: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  return useScrolledPast(barRef, enabled, SCROLLED_AFTER_PX, RESTING_BELOW_PX);
}

/**
 * Desktop and tablet band header (v10 section 7.1, Josh 10 Oct 2026, option 1). True once the
 * page has scrolled past 4px. Below 1000px the window scrolls instead of the work column, so both
 * are watched. Off on phone, which keeps its own bar. Header audit (27 Oct 2026): it settles back
 * only at 2px, as the phone bar does, so a bounce near the top does not flick it ink and light.
 */
export function useBandScrolled(barRef: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  return useScrolledPast(barRef, enabled, WF_BAND_SCROLLED_PX, RESTING_BELOW_PX);
}
