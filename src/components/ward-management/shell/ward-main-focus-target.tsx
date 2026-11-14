"use client";

import { useEffect } from "react";

const MAIN_ID = "main-content";

/**
 * P073 (accessibility, 27 Oct 2026): the root layout's "Skip to main content" link points at
 * `#main-content`, but a `<main>` cannot take focus, so focus stayed on the link and the next Tab
 * went back through the sidebar. On that link, the page's main is made focusable outside the Tab
 * order (tabindex -1, unless it sets its own) and receives focus. Each screen renders its own
 * `<main id="main-content">`, so this lives once in the Ward Flow layout rather than on every screen.
 */
/**
 * BA-4 (front-end audit, 5 Nov 2026): the phone-only "needs a larger screen" card is also a
 * `main#main-content`, rendered ahead of the route and hidden above phone width. On the bed meeting
 * TV at desktop the skip link found that hidden card first and focus fell to the page. The first
 * main that is actually shown wins; a browser without `checkVisibility` keeps the first one.
 */
function visibleMain(): HTMLElement | null {
  const mains = Array.from(document.querySelectorAll<HTMLElement>(`[id="${MAIN_ID}"], main[data-phone-desktop-only]`));
  return mains.find((main) => main.checkVisibility?.() ?? true) ?? null;
}

export function WardMainFocusTarget() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (link?.getAttribute("href") !== `#${MAIN_ID}`) return;
      const main = visibleMain();
      if (!main) return;
      // The browser's own jump goes to the first #main-content, which may be the hidden one.
      if (main !== document.getElementById(MAIN_ID)) event.preventDefault();
      if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
      main.focus();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
