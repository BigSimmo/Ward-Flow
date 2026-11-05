"use client";

import { useRef, type TouchEvent } from "react";

import { useIsPhone, useIsTabletPortrait } from "@/components/wf";

import type { TourDevice, TourStep } from "./ward-tour-steps";

/** One chapter of the tour as the chapter menu lists it: where it starts and how many steps it has. */
export type TourChapterSpan = { readonly name: string; readonly start: number; readonly count: number };

/** The tour's chapters in the order they are walked, each once, for the chapter menu and Help. */
export function tourChapters(steps: readonly TourStep[]): readonly TourChapterSpan[] {
  const spans: TourChapterSpan[] = [];
  steps.forEach((each, at) => {
    const lastSpan = spans.at(-1);
    if (lastSpan && lastSpan.name === each.chapter)
      spans[spans.length - 1] = { ...lastSpan, count: lastSpan.count + 1 };
    else spans.push({ name: each.chapter, start: at, count: 1 });
  });
  return spans;
}

/**
 * The three screens the tour and Show me play on: a phone (under 746px, with the dock), a tablet
 * (746px to 1000px, where the rail is a bar across the top) and a desk (the rail down the side).
 * `TourDevice` gains "tablet" in `ward-tour-steps.ts`; until then this union says the same thing,
 * and once it has, the two are one type.
 */
export type WardTourDevice = TourDevice | "tablet";

/** Which of the three this window is now. Follows the window as it is resized or turned. */
export function useTourDevice(): WardTourDevice {
  const phone = useIsPhone();
  const tablet = useIsTabletPortrait();
  return phone ? "phone" : tablet ? "tablet" : "desk";
}

/**
 * The device a step list is chosen for. Show me's steps name "desk" or "phone" only, so a tablet
 * walks the computer's steps (its controls are the same, laid out across the top).
 */
export function walkDevice(device: WardTourDevice): "desk" | "phone" {
  return device === "phone" ? "phone" : "desk";
}

/** How far a finger must travel sideways, in px, before a swipe counts. */
const SWIPE_MIN = 48;

/**
 * Swipe left for Next and right for Back, on a touch screen. Only a clearly sideways stroke counts,
 * so scrolling a long card up and down never turns the page. Taps and mouse use pass through.
 */
export function useSwipe(onNext: (() => void) | undefined, onBack: (() => void) | undefined) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      start.current = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchEnd(event: TouchEvent) {
      const from = start.current;
      start.current = null;
      const touch = event.changedTouches[0];
      if (!from || !touch) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) onNext?.();
      else onBack?.();
    },
    onTouchCancel() {
      start.current = null;
    },
  };
}
