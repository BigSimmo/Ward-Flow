import { modalFocusTargets } from "./focus-targets";

/**
 * Keyboard focus helpers for pop-ups that manage their own chrome (accessibility check A3 and A4,
 * 2 Nov 2026): Tab stays inside an open panel, and lost focus is noticed. The shell loads this on
 * every page, so it stays small; the opener lookup lives in `focus-opener.ts`.
 */

/**
 * Tab and Shift+Tab cycle inside `panel`, as Sheet's own trap does. Returns true when it moved focus.
 * `requireLayout` is false only in tests, where nothing has a layout box.
 */
export function cycleTabWithin(event: KeyboardEvent, panel: HTMLElement | null, requireLayout = true): boolean {
  if (event.key !== "Tab" || !panel) return false;
  const focusable = modalFocusTargets(panel, false, requireLayout);
  if (focusable.length === 0) return false;
  const index = focusable.indexOf(document.activeElement as HTMLElement);
  const next =
    index === -1
      ? event.shiftKey
        ? focusable.length - 1
        : 0
      : (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
  event.preventDefault();
  focusable[next].focus();
  return true;
}

/** True when focus has fallen to the page (the body, nothing, or a node that has gone). */
export function focusIsLost(inside?: HTMLElement | null): boolean {
  const active = document.activeElement;
  return active === null || active === document.body || !active.isConnected || Boolean(inside?.contains(active));
}
