"use client";

/**
 * A click or tap outside an open drop-down built from `<details>` closes it, as every other menu and
 * drawer does (Josh, 3 Nov 2026; D-95). The browser leaves a `<details>` open until its summary is
 * pressed again, so "Change ward" on the board and "Change screen" on the bed meeting TV stayed open.
 *
 * Only a floating `<details>` is closed: one whose panel (a child other than the summary) is
 * positioned absolute or fixed. An inline disclosure that pushes the page down stays open, because
 * it is part of the page rather than a pop-up. A `<details data-light-dismiss="off">` opts out.
 * Mounted once, in the Ward Flow layout. Renders nothing.
 */
import { useEffect } from "react";

function isFloatingDetails(details: HTMLDetailsElement) {
  if (details.dataset.lightDismiss === "off") return false;
  return Array.from(details.children).some(
    (child) => child.tagName !== "SUMMARY" && /^(absolute|fixed)$/.test(getComputedStyle(child).position),
  );
}

function closeFloatingDetailsOutside(target: EventTarget | null, root: ParentNode = document) {
  if (!(target instanceof Node)) return;
  for (const details of Array.from(root.querySelectorAll<HTMLDetailsElement>("details[open]"))) {
    if (!details.contains(target) && isFloatingDetails(details)) details.open = false;
  }
}

export function WardDetailsLightDismiss() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => closeFloatingDetailsOutside(event.target);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);
  return null;
}
