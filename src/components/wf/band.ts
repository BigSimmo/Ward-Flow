"use client";

import { useLayoutEffect, useSyncExternalStore, type RefObject } from "react";

/**
 * The desktop and tablet band (design system v10, section 7.1, Josh 10 Oct 2026 option 1).
 *
 * When a page opens on a hero that is not quiet (its top within 40px of the top of the page), the
 * hero runs square across the work column and up behind the header. The header (`WardBar`) reads
 * `useWfBandActive()` and sits in hero ink at rest, then turns solid and light once the page
 * scrolls. Phone (48rem and under) never bands: it keeps its own lean bar.
 *
 * The hero registers itself here, so a page gets the band by using the shared `Hero` and nothing
 * else. The bleed is measured, not a MutationObserver: the hero reads where it would sit, then
 * pulls itself out to the column edges and up to the header's bottom edge with negative margins.
 *
 * The header stays in flow above the page and paints the band's top colour at rest, so the band
 * reads as one surface from the top of the window. The hero never rises above the page's own
 * box: the desktop `.shell` clips vertical overflow (`tests/ward-shell-fill.test.ts`), and a
 * hero pulled up behind the header would be cut off there.
 */

/** Above the phone width, the band applies. Matches the phone shell's `(max-width: 48rem)`. */
export const WF_BAND_QUERY = "(min-width: 48.0625rem)";

/** A hero this close to the top of the page opens the page. */
export const WF_BAND_TOP_SLACK_PX = 40;

/** The header turns solid and light once the page has scrolled this far. */
export const WF_BAND_SCROLLED_PX = 4;

let registered = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot() {
  return registered > 0;
}

/** Registers one band hero. Returns the matching release. */
export function registerWfBandHero(): () => void {
  registered += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    registered = Math.max(0, registered - 1);
    emit();
  };
}

/** True while the current page opens on a band hero (desktop and tablet only). */
export function useWfBandActive(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

type Bleed = { top: number; left: number; right: number };

const NO_BLEED: Bleed = { top: 0, left: 0, right: 0 };

/** The scroll area the hero bleeds inside: the shell's work column, or the page if there is none. */
function scrollAreaOf(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>("[data-wf-scroller]");
}

/** The header sits first in the work column. Its height is what the hero pads under. */
function barHeightIn(scroller: HTMLElement): number {
  const bar = scroller.querySelector<HTMLElement>("[data-wf-bar]");
  return bar ? bar.offsetHeight : 0;
}

function sameBleed(a: Bleed, b: Bleed) {
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.right - b.right) < 0.5;
}

/**
 * Measures and applies the bleed for one hero. `enabled` is false for a quiet hero. The applied
 * values are written as CSS custom properties on the hero (`--wf-band-*`) plus `data-band="on"`,
 * which `hero.module.css` turns into negative margins, padding and the round lip.
 */
export function useWfBandBleed(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const hero = ref.current;
    if (!enabled || !hero || typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const scroller = scrollAreaOf(hero);
    if (!scroller) return;
    const query = window.matchMedia(WF_BAND_QUERY);

    let applied: Bleed = NO_BLEED;
    let release: (() => void) | null = null;
    let frame = 0;

    const clear = () => {
      if (release) {
        release();
        release = null;
      }
      applied = NO_BLEED;
      delete hero.dataset.band;
      hero.style.removeProperty("--wf-band-top");
      hero.style.removeProperty("--wf-band-left");
      hero.style.removeProperty("--wf-band-right");
    };

    const measure = () => {
      frame = 0;
      if (!query.matches) {
        clear();
        return;
      }
      const area = scroller.getBoundingClientRect();
      const rect = hero.getBoundingClientRect();
      const barHeight = barHeightIn(scroller);
      // Where the hero would sit without the bleed, in the scroll area's own coordinates.
      const naturalTop = rect.top - area.top + scroller.scrollTop + applied.top;
      const naturalLeft = rect.left - area.left + applied.left;
      const naturalRight = area.left + scroller.clientWidth - rect.right + applied.right;
      // The gap between the header's bottom edge and the hero. Anything taller above the hero (a
      // banner, a breadcrumb, a filter row) means the page does not open on its hero.
      const gap = naturalTop - barHeight;
      if (gap < 0 || gap > WF_BAND_TOP_SLACK_PX) {
        clear();
        return;
      }
      const next: Bleed = {
        top: gap,
        left: Math.max(0, naturalLeft),
        right: Math.max(0, naturalRight),
      };
      if (!sameBleed(next, applied) || hero.dataset.band !== "on") {
        applied = next;
        hero.style.setProperty("--wf-band-top", `${next.top}px`);
        hero.style.setProperty("--wf-band-left", `${next.left}px`);
        hero.style.setProperty("--wf-band-right", `${next.right}px`);
        hero.dataset.band = "on";
      }
      if (!release) release = registerWfBandHero();
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    observer?.observe(scroller);
    observer?.observe(hero);
    query.addEventListener("change", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      query.removeEventListener("change", schedule);
      window.removeEventListener("resize", schedule);
      clear();
    };
  }, [ref, enabled]);
}
