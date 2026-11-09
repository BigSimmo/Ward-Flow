"use client";

import { useLayoutEffect, useSyncExternalStore, type RefObject } from "react";

/**
 * The desktop and tablet band (design system v10, section 7.1, Josh 10 Oct 2026 option 1).
 *
 * When a page opens on a hero that is not quiet (its top within 40px of the top of the page), the
 * hero runs square across the work column and up behind the header. The header (`WardBar`) reads
 * `useWfBandActive()` and sits in hero ink at rest, then turns solid and light once the page
 * scrolls. Phone bands too (v10 Home mockup, Josh 11 Oct 2026): its lean bar sits in hero ink at
 * rest over a square, full-width hero, then turns solid once the page scrolls.
 *
 * The hero registers itself here, so a page gets the band by using the shared `Hero` and nothing
 * else. The bleed is measured, not a MutationObserver: the hero reads where it would sit, then
 * pulls itself out to the column edges and up to the header's bottom edge with negative margins.
 *
 * First paint (site review B6, 12 Oct 2026): the bleed is measured after hydration, so a band hero
 * that waited for it painted as a rounded card first and jumped (layout shift up to 0.49). The
 * server render is now already the band: until `useWfBandBleed` has measured, a band hero inside
 * the work column carries no `data-band` and `hero.module.css` styles it as the band with the
 * usual 16px page insets (desktop and tablet only; phone is unchanged). The measure then writes
 * `data-band="on"` with the real insets, or `data-band="off"` when the page does not open on it.
 *
 * The pinned notes under the header (`data-wf-bar-notes`) count as part of the header: the hero
 * bands from under them, and while the header is ink they take the band's top colour too.
 *
 * The header stays in flow above the page and paints the band's top colour at rest, so the band
 * reads as one surface from the top of the window. The hero never rises above the page's own
 * box: the desktop `.shell` clips vertical overflow (`tests/ward-shell-fill.test.ts`), and a
 * hero pulled up behind the header would be cut off there.
 */

/** The band applies at every width, phone included (v10 Home mockup, Josh 11 Oct 2026). */
const WF_BAND_QUERY = "all";

/** A hero this close to the top of the page opens the page. */
const WF_BAND_TOP_SLACK_PX = 40;

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

/** True while the current page opens on a band hero. */
export function useWfBandActive(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

type Bleed = { top: number; left: number; right: number };

const NO_BLEED: Bleed = { top: 0, left: 0, right: 0 };

/** The scroll area the hero bleeds inside: the shell's work column, or the page if there is none. */
function scrollAreaOf(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>("[data-wf-scroller]");
}

/** The pinned notes under the header (offline, broadcast, downtime, demo saving, access). */
function barNotesIn(scroller: HTMLElement): HTMLElement | null {
  return scroller.querySelector<HTMLElement>("[data-wf-bar-notes]");
}

/**
 * The header sits first in the work column, with its pinned notes under it. Their heights are what
 * the hero pads under. The notes count as part of the header (Josh, 27 Oct 2026): counted as page
 * content, any note (an access banner on some desks, the demo saving note once text was typed)
 * pushed the hero past the slack and turned it back into the old floating card.
 */
function barHeightIn(scroller: HTMLElement): number {
  const bar = scroller.querySelector<HTMLElement>("[data-wf-bar]");
  const notes = barNotesIn(scroller);
  return (bar ? bar.offsetHeight : 0) + (notes ? notes.offsetHeight : 0);
}

function sameBleed(a: Bleed, b: Bleed) {
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.right - b.right) < 0.5;
}

/**
 * Measures and applies the bleed for one hero. `enabled` is false for a quiet hero. The applied
 * values are written as CSS custom properties on the hero (`--wf-band-*`) plus `data-band="on"`,
 * which `hero.module.css` turns into negative margins, padding and the round lip. A hero that does
 * not open the page gets `data-band="off"` with only the side bleed: it is still drawn as the band,
 * square to the column edges, but the header does not join it. The rounded floating card is gone
 * (Josh, 27 Oct 2026); only a quiet hero is a card.
 */
export function useWfBandBleed(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const hero = ref.current;
    if (!enabled || !hero || typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    // Leave the server-rendered band so the first measure reads where the hero would sit. This
    // runs before the browser paints again, so the band never shows as a card in between.
    // "measuring" styles the hero like "off", but the header's pre-hydration ink rule
    // (ward-bar.module.css) only lets go on a final "off". With "off" here, the forced layout in
    // the first measure restyled the header as light glass, and its band transition then faded it
    // back to ink: a light flash on every load (13 Oct 2026).
    const scroller = scrollAreaOf(hero);
    if (hero.dataset.band === undefined) hero.dataset.band = scroller ? "measuring" : "off";
    if (!scroller) return;
    const query = window.matchMedia(WF_BAND_QUERY);

    let applied: Bleed = NO_BLEED;
    let release: (() => void) | null = null;
    let frame = 0;

    const clear = (state: "off" | null) => {
      if (release) {
        release();
        release = null;
      }
      applied = NO_BLEED;
      // "off" ends the server-rendered band (see the header): this hero is measured and not a band.
      if (state) hero.dataset.band = state;
      else delete hero.dataset.band;
      hero.style.removeProperty("--wf-band-top");
      hero.style.removeProperty("--wf-band-left");
      hero.style.removeProperty("--wf-band-right");
    };

    const measure = () => {
      frame = 0;
      if (!query.matches) {
        clear("off");
        return;
      }
      const area = scroller.getBoundingClientRect();
      const rect = hero.getBoundingClientRect();
      const barHeight = barHeightIn(scroller);
      // Where the hero would sit without the bleed, in the scroll area's own coordinates. The
      // margins in force are read back rather than assumed to be the last bleed written: on the
      // first measure the server-rendered band's own insets (12px on a phone) can still be in
      // force, and adding back nothing then put a phone hero 12px out, so it dropped and rose
      // again (the /waiting phone layout shift, Q204, 1 Nov 2026).
      const margins = window.getComputedStyle(hero);
      const naturalTop = rect.top - area.top + scroller.scrollTop - (parseFloat(margins.marginTop) || 0);
      const naturalLeft = rect.left - area.left - (parseFloat(margins.marginLeft) || 0);
      const naturalRight = area.left + scroller.clientWidth - rect.right - (parseFloat(margins.marginRight) || 0);
      // The gap between the header's bottom edge and the hero. Anything taller above the hero (a
      // banner, a breadcrumb, a filter row) means the page does not open on its hero.
      const gap = naturalTop - barHeight;
      if (gap < 0 || gap > WF_BAND_TOP_SLACK_PX) {
        // Not the page's opening hero: the header stays light, but the hero still runs square to
        // the column edges as the band, never the old rounded card (Josh, 27 Oct 2026).
        if (release) {
          release();
          release = null;
        }
        const side: Bleed = { top: 0, left: Math.max(0, naturalLeft), right: Math.max(0, naturalRight) };
        if (!sameBleed(side, applied) || hero.dataset.band !== "off") {
          applied = side;
          hero.style.removeProperty("--wf-band-top");
          hero.style.setProperty("--wf-band-left", `${side.left}px`);
          hero.style.setProperty("--wf-band-right", `${side.right}px`);
          hero.dataset.band = "off";
        }
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
    // A note arriving or leaving moves the hero without resizing either of those.
    const notes = barNotesIn(scroller);
    if (notes) observer?.observe(notes);
    query.addEventListener("change", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      query.removeEventListener("change", schedule);
      window.removeEventListener("resize", schedule);
      clear(null);
    };
  }, [ref, enabled]);
}
