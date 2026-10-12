/** Explicit scroll animations must honour both system and Ward accessibility preferences. */
export function wardScrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  const reduced =
    document.documentElement.hasAttribute("data-reduced-motion") ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return reduced ? "instant" : "smooth";
}

/** Reveal a search option inside its list without scrolling the page or moving the header. */
export function revealWardOption(option: HTMLElement | null): void {
  const list = option?.closest<HTMLElement>('[role="listbox"]');
  if (!option || !list) return;
  // The global palette and patient typeahead scroll the list's parent; the legacy
  // palette scrolls the list itself. Never climb into the application's page scroller.
  const scroller = [list, list.parentElement].find(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && /^(auto|scroll)$/.test(window.getComputedStyle(element).overflowY),
  );
  if (!scroller) return;
  const row = option.getBoundingClientRect();
  const box = scroller.getBoundingClientRect();
  const top = box.top + scroller.clientTop;
  const bottom = top + scroller.clientHeight;
  if (row.top < top) scroller.scrollTop += row.top - top;
  else if (row.bottom > bottom) scroller.scrollTop += row.bottom - bottom;
}

/**
 * Return the page to its top. The work column (`[data-wf-scroller]`) scrolls on every width from
 * phone up (phone since 12 Oct 2026, so iOS Safari's toolbar never collapses under the dock); the
 * window is reset too for the tablet widths where the document still scrolls.
 */
export function scrollWardPageToTop(): void {
  if (typeof window === "undefined") return;
  const scroller = document.querySelector<HTMLElement>("[data-wf-scroller]");
  if (scroller) scroller.scrollTop = 0;
  window.scrollTo({ top: 0 });
}
