"use client";

import { requestToolsTool } from "./ward-tools-open";

const DEMO_MENU_EVENT = "ward-flow-demo-menu-open";

/**
 * Opens the Demo menu under the header's Synthetic pill (change 8, D-77, 21 Oct 2026). The Board
 * time pills use it, so the scenario, clock and reset controls still live in one place. The phone's
 * lean bar has no pill, so there the demo controls stay in Tools and this opens them there.
 */
export function requestDemoMenu(returnFocus?: HTMLElement) {
  const pill = document.querySelector<HTMLElement>('[data-data-mode="prototype"]');
  if (!pill || pill.getClientRects().length === 0) {
    requestToolsTool("demo", returnFocus);
    return;
  }
  window.dispatchEvent(new CustomEvent(DEMO_MENU_EVENT, { detail: { returnFocus } }));
}

export function subscribeDemoMenu(onOpen: (returnFocus?: HTMLElement) => void) {
  function handler(event: Event) {
    onOpen((event as CustomEvent<{ returnFocus?: HTMLElement }>).detail?.returnFocus);
  }
  window.addEventListener(DEMO_MENU_EVENT, handler);
  return () => window.removeEventListener(DEMO_MENU_EVENT, handler);
}
