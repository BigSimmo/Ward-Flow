"use client";

import { WARD_HOME_HREF } from "@/components/ward-management/ward-nav";

import { areCharacterShortcutsEnabled } from "./ward-character-shortcuts";

/**
 * GO-TO KEYS (feature 49, Josh 9 Nov 2026): press G, then one letter, to open a main page. Like the
 * other single-key shortcuts they stay off while typing and when Settings turns shortcuts off, and a
 * page this login cannot open is skipped, so the key press is left alone.
 */
const GO_TO_PAGES: readonly { key: string; label: string; href: string }[] = [
  { key: "h", label: "Home", href: WARD_HOME_HREF },
  { key: "e", label: "ED", href: "/ward-flow/ed" },
  { key: "w", label: "Waiting", href: "/ward-flow/waiting" },
  { key: "b", label: "Wards", href: "/ward-flow/wards" },
  { key: "d", label: "Discharges", href: "/ward-flow/discharges" },
  { key: "r", label: "Referrals", href: "/ward-flow/referrals" },
  { key: "c", label: "Capacity", href: "/ward-flow/capacity" },
  { key: "s", label: "Statistics", href: "/ward-flow/statistics" },
];

/** How long G waits for its letter. */
export const GO_TO_WINDOW_MS = 1_500;

let pendingSince: number | null = null;

/** Test seam: forget a half-typed G. */
export function resetGoToShortcut(): void {
  pendingSince = null;
}

function plainKey(event: KeyboardEvent): boolean {
  return !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.isComposing;
}

/**
 * Handles G and the letter after it. Returns true when the key press was used (G itself, or the
 * letter that opened a page). Callers have already left typing targets alone.
 */
export function goToPageForShortcut(
  event: KeyboardEvent,
  canOpenHref: (href: string) => boolean,
  navigate: (href: string) => void,
  homeHref: string = WARD_HOME_HREF,
  now: number = Date.now(),
): boolean {
  if (!areCharacterShortcutsEnabled() || !plainKey(event)) {
    pendingSince = null;
    return false;
  }
  const key = event.key.toLowerCase();
  if (pendingSince !== null && now - pendingSince <= GO_TO_WINDOW_MS) {
    pendingSince = null;
    const page = GO_TO_PAGES.find((candidate) => candidate.key === key);
    // H opens this desk's own Home, as the menu's Home does.
    const href = page?.key === "h" ? homeHref : page?.href;
    if (!href || !canOpenHref(href)) return false;
    event.preventDefault();
    navigate(href);
    return true;
  }
  pendingSince = key === "g" ? now : null;
  return key === "g";
}
