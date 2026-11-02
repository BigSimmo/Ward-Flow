import { modalFocusTargets } from "./focus-targets";

/**
 * Keyboard focus helpers for pop-ups that manage their own chrome (accessibility check A3 and A4,
 * 2 Nov 2026): Tab stays inside an open panel, and closing it gives focus back to what opened it.
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

/** What opened a panel: the element, and its test id so a redrawn copy of it can be found again. */
export type FocusOpener = { element: HTMLElement | null; testId: string | null };

export function rememberOpener(element: HTMLElement | null): FocusOpener {
  return { element, testId: element?.getAttribute("data-testid") ?? null };
}

/**
 * Focuses the opener if it is still on the page. When the list behind was redrawn (a phone list that
 * swaps out while a detail is open), the same control is found again by its test id, which carries
 * the record's id. Returns true when focus moved.
 */
export function returnFocusToOpener(opener: FocusOpener | null, root: ParentNode = document): boolean {
  if (!opener) return false;
  const candidates: HTMLElement[] = [];
  if (opener.element?.isConnected) candidates.push(opener.element);
  if (opener.testId) {
    for (const element of root.querySelectorAll<HTMLElement>("[data-testid]")) {
      if (element !== opener.element && element.getAttribute("data-testid") === opener.testId) candidates.push(element);
    }
  }
  // The first copy that takes focus wins: a hidden copy (display: none) refuses it.
  for (const target of candidates) {
    if (typeof target.focus !== "function") continue;
    target.focus({ preventScroll: true });
    if (document.activeElement === target) return true;
  }
  return false;
}

/** True when focus has fallen to the page (the body, nothing, or a node that has gone). */
export function focusIsLost(inside?: HTMLElement | null): boolean {
  const active = document.activeElement;
  return active === null || active === document.body || !active.isConnected || Boolean(inside?.contains(active));
}
