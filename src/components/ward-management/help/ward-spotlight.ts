"use client";

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

import type { TourDevice, TourTarget } from "./ward-tour-steps";

/**
 * THE SPOTLIGHT, shared by the desk tour (`ward-tour.tsx`) and Show me (`ward-show-me.tsx`): find a
 * step's control on screen, bring it into view, light it, and keep the card beside it clear of it.
 * One engine, so the two walkthroughs look and behave the same on every device.
 */

/** Said on a step whose control is not on screen, so the card never just floats with no reason. */
export const SPOT_NOT_HERE = "This is not on the screen right now, for example when there is nothing to act on yet.";

export type SpotBox = { top: number; left: number; width: number; height: number };

/** How long a step waits for its control to appear (a page still loading) before it says so. */
const FIND_TIMEOUT_MS = 2500;
/** How often the spotlight re-measures, so a notice that shifts the page cannot leave it behind. */
const REMEASURE_MS = 400;
const GAP = 12;
const EDGE = 8;
/** A control taller than this share of the window is shown from its top, at this share. */
const TALL_SHARE = 0.45;
/** Room left above a control scrolled to the top, for the header that sits over the page. */
const HEADER_ROOM = 72;

function tall(rect: DOMRect): boolean {
  return rect.height > window.innerHeight * TALL_SHARE;
}

/** Brings the control into view: centred, or a tall one to just under the header. */
function bringIntoView(element: HTMLElement): void {
  const behavior: ScrollBehavior = "instant";
  if (!tall(element.getBoundingClientRect())) {
    element.scrollIntoView({ block: "center", inline: "nearest", behavior });
    return;
  }
  const margin = element.style.scrollMarginTop;
  element.style.scrollMarginTop = `${HEADER_ROOM}px`;
  element.scrollIntoView({ block: "start", inline: "nearest", behavior });
  element.style.scrollMarginTop = margin;
}

function shown(element: HTMLElement): boolean {
  if (element.getClientRects().length === 0) return false;
  // A control laid out but hidden (the phone dock under another dialog) is not on screen.
  return element.checkVisibility?.({ visibilityProperty: true }) ?? true;
}

/** The step's control on screen now, or null. See `TourTarget`. */
export function findTourTarget(target: TourTarget): HTMLElement | null {
  const match = Array.from(document.querySelectorAll<HTMLElement>(target.sel)).find(
    (element) => shown(element) && (!target.text || (element.textContent ?? "").includes(target.text)),
  );
  let element: HTMLElement | null = match ?? null;
  for (let level = 0; element && level < (target.up ?? 0); level++) element = element.parentElement;
  return element;
}

/** The first of `targets` on screen now: a desktop control first, then its phone stand-in. */
function findFirst(targets: readonly TourTarget[]): HTMLElement | null {
  return targets.reduce<HTMLElement | null>((found, each) => found ?? findTourTarget(each), null);
}

/** The spotlight's box: the control with a little room, kept inside the window. */
function spotBox(element: HTMLElement): SpotBox {
  const rect = element.getBoundingClientRect();
  const pad = rect.width < 120 || rect.height < 40 ? 6 : 4;
  const top = Math.max(EDGE / 2, rect.top - pad);
  const left = Math.max(EDGE / 2, rect.left - pad);
  // A tall control is lit from its top only, leaving room under it for the card.
  const tallest = tall(rect) ? window.innerHeight * TALL_SHARE : Infinity;
  const bottom = Math.min(window.innerHeight - EDGE / 2, rect.bottom + pad, top + tallest);
  const right = Math.min(window.innerWidth - EDGE / 2, rect.right + pad);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/**
 * Where the card goes. On a desktop it sits beside the control (right, left, below, then above),
 * kept inside the window. On a phone it spans the width, docked to whichever end has more room.
 * With no control it sits in the middle (a phone docks it to the foot).
 *
 * H-0376 / H-0890 (L1 re-measure, 26 Oct 2026): the card stays at the window's top left and moves
 * by transform only, so settling from the middle to beside its control, or a phone card changing
 * height at the foot, never counts as a layout shift.
 */
function placeCard(card: HTMLElement, box: SpotBox | null, device: TourDevice): void {
  const style = card.style;
  style.maxHeight = "";
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const moveTo = (left: number, top: number) => {
    style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  };
  // A phone card spans the width from its CSS insets, so it only ever moves down.
  const dock = (end: "top" | "bottom") => {
    card.dataset.place = end;
    moveTo(0, end === "top" ? EDGE : Math.max(EDGE, vh - EDGE - card.offsetHeight));
  };
  if (!box) {
    // B6-20 (device sweep, 24 Oct 2026): on a phone a step with no control still docks to the foot
    // like every other phone step, rather than floating mid-screen over the page.
    if (device === "phone") {
      dock("bottom");
      return;
    }
    card.dataset.place = "centre";
    moveTo((vw - card.offsetWidth) / 2, (vh - card.offsetHeight) / 2);
    return;
  }
  if (device === "phone") {
    const above = box.top;
    const below = vh - (box.top + box.height);
    const room = Math.max(above, below) - GAP - EDGE;
    // Never cover the control when there is room for a readable card, else take just over half,
    // and on a short screen (a phone on its side) at least 260px, so a step reads with Next in view.
    style.maxHeight = `${room >= 200 ? room : Math.round(Math.max(vh * 0.56, Math.min(vh - EDGE * 2, 260)))}px`;
    dock(above > below ? "top" : "bottom");
    return;
  }
  card.dataset.place = "beside";
  const cw = card.offsetWidth;
  const ch = card.offsetHeight;
  // D2 (device sweep, 24 Oct 2026): twice the edge below, so Next and its focus ring never touch the
  // bottom of the window.
  const clampTop = (top: number) => Math.min(Math.max(EDGE, top), Math.max(EDGE, vh - ch - EDGE * 2));
  const clampLeft = (left: number) => Math.min(Math.max(EDGE, left), Math.max(EDGE, vw - cw - EDGE));
  const bottom = box.top + box.height;
  const right = box.left + box.width;
  // Right, left, below, above, each kept in the window; the first that leaves the control clear
  // wins, else whichever covers least of it.
  const candidates = [
    { left: clampLeft(right + GAP), top: clampTop(box.top) },
    { left: clampLeft(box.left - GAP - cw), top: clampTop(box.top) },
    { left: clampLeft(box.left), top: clampTop(bottom + GAP) },
    { left: clampLeft(box.left), top: clampTop(box.top - GAP - ch) },
  ];
  const covered = ({ left, top }: { left: number; top: number }) =>
    Math.max(0, Math.min(left + cw, right) - Math.max(left, box.left)) *
    Math.max(0, Math.min(top + ch, bottom) - Math.max(top, box.top));
  const best = candidates.reduce((chosen, candidate) => (covered(candidate) < covered(chosen) ? candidate : chosen));
  moveTo(best.left, best.top);
}

/**
 * Finds the first of `targets` on screen (waiting a moment for a page still drawing), brings it into
 * view and follows it while the window scrolls or resizes. A control the page draws again (React
 * replacing it) or that turns up late (a page that opened after the step began) is looked for again
 * on every re-measure, so the light never stays lost. `key` names the step: a new key starts dark.
 * `missing` turns true once the wait is over with nothing found, so the card can say so.
 */
export function useSpotlight(
  targets: readonly TourTarget[] | undefined,
  key: string,
): { box: SpotBox | null; missing: boolean } {
  const [spot, setSpot] = useState<{ key: string; box: SpotBox | null; missing: boolean } | null>(null);
  useEffect(() => {
    if (!targets?.length) return;
    let element: HTMLElement | null = null;
    let frame = 0;
    let follow = 0;
    let gaveUp = false;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!element || !element.isConnected) {
          const found = findFirst(targets);
          if (found && found !== element) bringIntoView(found);
          element = found;
        }
        setSpot({ key, box: element ? spotBox(element) : null, missing: !element && gaveUp });
      });
    };
    const started = Date.now();
    const poll = window.setInterval(() => {
      element = findFirst(targets);
      if (!element && Date.now() - started < FIND_TIMEOUT_MS) return;
      window.clearInterval(poll);
      gaveUp = !element;
      if (element) bringIntoView(element);
      measure();
      follow = window.setInterval(measure, REMEASURE_MS);
    }, 100);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(follow);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [targets, key]);
  return spot && spot.key === key ? { box: spot.box, missing: spot.missing } : { box: null, missing: false };
}

/**
 * Keeps the card placed beside the lit control (or in the middle without one), and stops a tall
 * control's light short of a card below it. `step` re-places the card when its words change size.
 */
export function usePlacedCard(
  cardRef: RefObject<HTMLElement | null>,
  spotRef: RefObject<HTMLElement | null>,
  box: SpotBox | null,
  device: TourDevice,
  step: unknown,
): void {
  useLayoutEffect(() => {
    // The card is placed by transform, so a step with no control is placed again when the window
    // changes size (one with a control follows it through the spotlight's own re-measure).
    const card = cardRef.current;
    if (!card || box) return;
    const place = () => placeCard(card, null, device);
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [box, cardRef, device]);

  useLayoutEffect(() => {
    if (cardRef.current) placeCard(cardRef.current, box, device);
    // A tall control with no room beside it: the light stops short of the card below it.
    const spotElement = spotRef.current;
    const card = cardRef.current;
    if (!spotElement || !card || !box) return;
    const rect = card.getBoundingClientRect();
    const stop = rect.top - GAP / 2 - box.top;
    const sideBySide = rect.left >= box.left + box.width || rect.right <= box.left;
    spotElement.style.height =
      !sideBySide && rect.top > box.top && stop < box.height ? `${Math.max(24, stop)}px` : `${box.height}px`;
  }, [box, cardRef, device, spotRef, step]);
}
