// The bar's two scroll watchers (phone bar and desktop band header), moved out of `ward-bar.tsx`
// to keep it under the line cap.
import { useEffect, useState, type RefObject } from "react";

import { WF_BAND_SCROLLED_PX } from "@/components/wf";

/**
 * Phone bar (Josh, 8 Oct 2026, board 00b): bar A with C's behaviour. It never hides. At the top of
 * the page it sits on the page with no fill; once the page scrolls its controls condense and it
 * turns solid. Its layout height stays fixed so scrolling never moves the content below it.
 * Phone only: `enabled` is false above 48rem, so the desktop bar never gets `data-scrolled`.
 */
const SCROLLED_AFTER_PX = 8;
const RESTING_BELOW_PX = 2;

export function useBarScrolled(barRef: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    // Phone scrolls inside the work column (`[data-wf-scroller]`), not the window, so iOS Safari's
    // toolbar never collapses and the fixed dock stays put (Josh, 12 Oct 2026). The window is still
    // watched in case a page is ever shown without the shell's column.
    const scroller = barRef.current?.closest<HTMLElement>("[data-wf-scroller]") ?? null;
    let frame = 0;
    const update = () => {
      frame = 0;
      const offset = Math.max(scroller?.scrollTop ?? 0, window.scrollY);
      // Separate entry and exit thresholds avoid flicker during small scroll reversals or bounce.
      setScrolled((previous) => offset > (previous ? RESTING_BELOW_PX : SCROLLED_AFTER_PX));
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
  }, [barRef, enabled]);

  return enabled && scrolled;
}

/**
 * Desktop and tablet band header (v10 section 7.1, Josh 10 Oct 2026, option 1). True once the
 * page has scrolled past 4px. The desktop work column scrolls inside `[data-wf-scroller]`; below
 * 1000px the window scrolls instead, so both are watched. Off on phone, which keeps its own bar.
 */
export function useBandScrolled(barRef: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const scroller = barRef.current?.closest<HTMLElement>("[data-wf-scroller]") ?? null;
    let frame = 0;
    const update = () => {
      frame = 0;
      const offset = Math.max(scroller?.scrollTop ?? 0, window.scrollY);
      setScrolled(offset > WF_BAND_SCROLLED_PX);
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
  }, [barRef, enabled]);

  return enabled && scrolled;
}
