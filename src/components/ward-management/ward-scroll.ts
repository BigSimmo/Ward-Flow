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
  // The patient typeahead scrolls the list's parent and the legacy palette the list itself; the
  // global palette, whose groups are separate listboxes (DA-05), scrolls a pane a few levels up.
  // Never climb into the application's page scroller.
  let scroller: HTMLElement | null = list;
  for (let depth = 0; ; depth += 1, scroller = scroller.parentElement) {
    if (!scroller || depth > 3 || scroller.hasAttribute("data-wf-scroller") || scroller === document.body) return;
    if (/^(auto|scroll)$/.test(window.getComputedStyle(scroller).overflowY)) break;
  }
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
