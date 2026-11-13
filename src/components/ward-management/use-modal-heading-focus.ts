"use client";

import { useMemo, type RefObject } from "react";

/**
 * A first-focus target on a kit Sheet or Dialog's own heading (A12-08, Josh 13 Nov 2026). The kit
 * ignores Escape while focus sits on a native select, so that the Escape that closes an open
 * drop-down does not also close the box. A box that opened with focus on its first select could
 * therefore not be closed with Escape until focus moved. Starting on the heading names the box
 * first and lets Escape close it; the kit and its select guard stay as they are.
 *
 * The heading belongs to the kit, so it is found when the kit asks for it: the panel by its test
 * id, then the element its `aria-labelledby` names. The heading takes `tabindex="-1"` so it can
 * hold focus without joining the Tab order. Memoised, because the kit reopens its focus handling
 * when the ref object changes.
 */
export function useModalHeadingFocus(panelTestId: string): RefObject<HTMLElement | null> {
  return useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        const panel = document.querySelector<HTMLElement>(`[data-testid="${panelTestId}"]`);
        const headingId = panel?.getAttribute("aria-labelledby");
        const heading = headingId ? document.getElementById(headingId) : null;
        if (heading && !heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
        return heading;
      },
    }),
    [panelTestId],
  );
}
