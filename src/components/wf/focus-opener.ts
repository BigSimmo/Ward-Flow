/**
 * Closing a panel gives focus back to what opened it (accessibility check A3, 2 Nov 2026), found again
 * by its test id when the list behind was redrawn.
 */

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
