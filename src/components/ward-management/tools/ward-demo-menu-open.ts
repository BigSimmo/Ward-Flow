"use client";

import { useEffect, useRef } from "react";

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

/**
 * For a Board time pill in a sheet footer: the Demo menu sits below the sheet's modal layer, so the
 * returned opener closes the sheet first, and the menu opens a frame after the sheet has gone, once
 * the sheet's own focus restore has run. Phone has no pill, so there Tools opens at Demo as before.
 */
export function useDemoMenuFromSheet<Id>(open: Id | null, closeSheet: (id: Id) => void, isPhone: boolean) {
  const pending = useRef(false);
  useEffect(() => {
    if (open !== null || !pending.current) return;
    pending.current = false;
    const frame = window.requestAnimationFrame(() => requestDemoMenu());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);
  return (id: Id, from: HTMLElement) => {
    if (isPhone) return requestDemoMenu(from);
    pending.current = true;
    closeSheet(id);
  };
}
