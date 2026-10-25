/** The nearest fixed or sticky box holding `element` (a pinned header, action bar or the phone dock). */
function pinnedBox(element: Element | null): HTMLElement | null {
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    const position = getComputedStyle(node).position;
    if (position === "fixed" || position === "sticky") return node as HTMLElement;
  }
  return null;
}

/** The box that scrolls the page: the shell's work column where it scrolls, else the window. A
 *  row that scrolls sideways (a chip strip) is never the one moved. */
function scrollerOf(element: HTMLElement): Element | null {
  const column = element.closest("[data-wf-scroller]");
  if (column && column.scrollHeight > column.clientHeight + 1) return column;
  return document.scrollingElement;
}

/** Room left between a control brought clear and the bar it was under. */
const FOCUS_CLEARANCE = 8;

/**
 * WCAG 2.4.11 (device sweep, 24 Oct 2026): a control reached with the keyboard is never left
 * hidden under a pinned bar. Scroll padding keeps it clear of the header and the dock, but a page's
 * own sticky action bar (Patient, Movement, Handover) can still sit over it. After the browser has
 * scrolled to the focused control, this checks its top and bottom edges and, if a fixed or sticky
 * bar that does not hold it covers either, scrolls just far enough to bring it clear. Dialogs keep
 * their own focus handling and are left alone.
 */
export function keepKeyboardFocusClear(event: FocusEvent) {
  const element = event.target;
  if (!(element instanceof HTMLElement) || typeof document.elementFromPoint !== "function") return;
  if (element.closest('[role="dialog"], [aria-modal="true"]')) return;
  try {
    if (!element.matches(":focus-visible")) return;
  } catch {
    return;
  }
  requestAnimationFrame(() => {
    if (document.activeElement !== element) return;
    const rect = element.getBoundingClientRect();
    if (rect.height === 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) return;
    const x = Math.min(Math.max(rect.left + rect.width / 2, 0), window.innerWidth - 1);
    let shift = 0;
    for (const y of [rect.top + 2, rect.bottom - 2]) {
      if (y < 0 || y >= window.innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || element.contains(hit) || hit.contains(element)) continue;
      const bar = pinnedBox(hit);
      if (!bar || bar.contains(element)) continue;
      const box = bar.getBoundingClientRect();
      // A full-screen layer is not a bar to scroll clear of.
      if (box.height > window.innerHeight / 2) continue;
      // A bar in the lower half of the window is a foot bar: the control moves up above it.
      // One in the upper half is a header: the control moves down below it.
      if (box.top + box.height / 2 > window.innerHeight / 2) {
        if (box.top < rect.bottom) shift = Math.max(shift, rect.bottom - box.top + FOCUS_CLEARANCE);
      } else if (box.bottom > rect.top) {
        shift = Math.min(shift, rect.top - box.bottom - FOCUS_CLEARANCE);
      }
    }
    if (shift !== 0) scrollerOf(element)?.scrollBy({ top: shift, behavior: "instant" });
  });
}
