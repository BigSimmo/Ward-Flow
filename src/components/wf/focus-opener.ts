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

/** What counts as a row: the opener's row leaves with it when an action removes it. */
const ROW_SELECTOR = 'tr, li, [role="row"], [role="listitem"], [data-focus-row]';
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
const CONTROL_SELECTOR = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/**
 * Where an overlay's opener sat on the page, noted when the overlay opens: its row's list and place,
 * which control it was in that row, and the nearest heading above it outside the row. If the action
 * taken in the overlay removes the row (a pull, a save that moves the patient on), the opener has
 * left the page when the overlay closes, and focus goes to the row now in that place, else to the
 * heading (spec item 5, 13 Nov 2026), never the page body.
 */
export type OpenerPlace = {
  list: HTMLElement | null;
  rowIndex: number;
  controlIndex: number;
  heading: HTMLElement | null;
};

function rowsOf(list: HTMLElement): HTMLElement[] {
  return Array.from(list.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.matches(ROW_SELECTOR),
  );
}

function controlsIn(row: HTMLElement): HTMLElement[] {
  const controls = Array.from(row.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)).filter(
    (control) => !control.matches(":disabled") && !control.closest('[inert], [aria-hidden="true"], [hidden]'),
  );
  return row.matches(CONTROL_SELECTOR) ? [row, ...controls] : controls;
}

/** The last heading before `element` in document order, inside its nearest ancestor that holds one. */
function headingAbove(element: HTMLElement, row: HTMLElement | null): HTMLElement | null {
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const headings = Array.from(ancestor.querySelectorAll<HTMLElement>(HEADING_SELECTOR)).filter(
      (heading) =>
        !row?.contains(heading) &&
        !heading.contains(element) &&
        Boolean(heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
    if (headings.length > 0) return headings[headings.length - 1];
  }
  return null;
}

export function rememberOpenerPlace(opener: HTMLElement | null): OpenerPlace | null {
  if (!opener?.isConnected || opener === document.body) return null;
  const row = opener.closest<HTMLElement>(ROW_SELECTOR);
  const list = row?.parentElement ?? null;
  const rowIndex = row && list ? rowsOf(list).indexOf(row) : -1;
  const controlIndex = row ? Math.max(0, controlsIn(row).indexOf(opener)) : 0;
  return { list, rowIndex, controlIndex, heading: headingAbove(opener, row) };
}

function tryFocus(target: HTMLElement, allowed: (target: HTMLElement) => boolean): boolean {
  if (!target.isConnected || !allowed(target)) return false;
  target.focus({ preventScroll: true });
  return document.activeElement === target;
}

/**
 * Focuses a heading or region for one hand-over only: it takes `tabindex="-1"` until it loses focus,
 * so it never joins the Tab order. Returns true when focus moved.
 */
export function focusForHandover(target: HTMLElement, allowed: (target: HTMLElement) => boolean = () => true) {
  if (!target.isConnected || !allowed(target)) return false;
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
  return tryFocus(target, allowed);
}

/**
 * The kit's focus-return fallback once the opener has left the page: the same control on the row now
 * in the opener's row's place (or the last row), else the heading above it. `allowed` lets an overlay
 * refuse a target another layer covers. Returns true when focus moved.
 */
export function focusOpenerPlace(
  place: OpenerPlace | null,
  allowed: (target: HTMLElement) => boolean = () => true,
): boolean {
  if (!place) return false;
  if (place.list?.isConnected && place.rowIndex >= 0) {
    const rows = rowsOf(place.list);
    const start = Math.min(place.rowIndex, rows.length - 1);
    // The row now in that place first, then the ones after it, then the ones before.
    const order = [...rows.slice(start), ...rows.slice(0, Math.max(start, 0)).reverse()];
    for (const row of order) {
      const controls = controlsIn(row);
      const preferred = controls[Math.min(place.controlIndex, controls.length - 1)];
      for (const control of preferred ? [preferred, ...controls.filter((c) => c !== preferred)] : []) {
        if (tryFocus(control, allowed)) return true;
      }
    }
  }
  return place.heading ? focusForHandover(place.heading, allowed) : false;
}
