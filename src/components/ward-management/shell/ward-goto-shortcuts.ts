"use client";

import {
  WARD_CAPACITY_HREF,
  WARD_ED_HREF,
  WARD_HOME_HREF,
  WARD_NAV,
  WARD_VIEWS,
  type WardNavId,
} from "@/components/ward-management/ward-nav";

import { areCharacterShortcutsEnabled } from "./ward-character-shortcuts";

/**
 * GO-TO KEYS (feature 49, Josh 9 Nov 2026): press G, then one letter, to open a main page. Like the
 * other single-key shortcuts they stay off while typing and when Settings turns shortcuts off, and a
 * page this login cannot open is skipped, so the key press is left alone.
 */
// Every address comes from ward-nav, so no route is typed twice (the facade test guards shell/).
const navHref = (id: WardNavId): string => WARD_NAV.find((item) => item.id === id)?.href ?? WARD_HOME_HREF;
const WAITING_HREF = WARD_VIEWS.find((view) => view.id === "delays")?.href ?? WARD_HOME_HREF;

const GO_TO_PAGES: readonly { key: string; label: string; href: string }[] = [
  { key: "h", label: "Home", href: WARD_HOME_HREF },
  { key: "e", label: "ED", href: WARD_ED_HREF },
  { key: "w", label: "Waiting", href: WAITING_HREF },
  { key: "b", label: "Wards", href: navHref("wards") },
  { key: "d", label: "Discharges", href: navHref("discharges") },
  { key: "r", label: "Referrals", href: navHref("referrals") },
  { key: "c", label: "Capacity", href: WARD_CAPACITY_HREF },
  { key: "s", label: "Statistics", href: navHref("statistics") },
];

/** How long G waits for its letter, in milliseconds: a keyboard timing, not a clinical time. */
export const GO_TO_KEY_WAIT = 1_500;

let pendingSince: number | null = null;

/** Forget a half-typed G: another control used a key, or a test starts clean. */
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
  if (pendingSince !== null && now - pendingSince <= GO_TO_KEY_WAIT) {
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
