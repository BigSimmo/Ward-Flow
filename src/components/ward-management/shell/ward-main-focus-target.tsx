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
export function WardMainFocusTarget() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (link?.getAttribute("href") !== `#${MAIN_ID}`) return;
      const main = document.getElementById(MAIN_ID);
      if (!main) return;
      if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
      main.focus();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
