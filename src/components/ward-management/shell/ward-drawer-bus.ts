"use client";

export type WardDrawerId = "activity" | "tasks" | "tools" | "referral" | "service";

const WARD_DRAWER_EVENT = "ward-flow-open-drawer";

const WARD_DRAWER_CLOSE_EVENT = "ward-flow-close-drawer";

export function openWardDrawer(drawerId: WardDrawerId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WARD_DRAWER_EVENT, { detail: { drawerId } }));
}

export function closeWardDrawer() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WARD_DRAWER_CLOSE_EVENT));
}

export function subscribeWardDrawer(onOpen: (drawerId: WardDrawerId) => void) {
  if (typeof window === "undefined") return () => {};
  function handler(event: Event) {
    const custom = event as CustomEvent<{ drawerId: WardDrawerId }>;
    if (custom.detail?.drawerId) {
      onOpen(custom.detail.drawerId);
    }
  }
  window.addEventListener(WARD_DRAWER_EVENT, handler);
  return () => window.removeEventListener(WARD_DRAWER_EVENT, handler);
}

export function subscribeWardDrawerClose(onClose: () => void) {
  if (typeof window === "undefined") return () => {};
  function handler() {
    onClose();
  }
  window.addEventListener(WARD_DRAWER_CLOSE_EVENT, handler);
  return () => window.removeEventListener(WARD_DRAWER_CLOSE_EVENT, handler);
}

const WARD_MENU_EVENT = "ward-flow-open-menu";

/** The phone layout's one breakpoint (8 Oct 2026). Everything phone-only in the shell keys off it. */
export const PHONE_QUERY = "(max-width: 48rem)";

/** Read once, outside React, so the phone menu and the rail's sheet never both answer Menu. */
export function isPhoneViewport(): boolean {
  return (
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches
  );
}

/** Phone bar Menu button: opens the rail's navigation sheet, returning focus to `trigger`. */
export function openWardMenu(trigger: HTMLButtonElement | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WARD_MENU_EVENT, { detail: { trigger } }));
}

export function subscribeWardMenu(onOpen: (trigger: HTMLButtonElement | null) => void) {
  if (typeof window === "undefined") return () => {};
  function handler(event: Event) {
    onOpen((event as CustomEvent<{ trigger: HTMLButtonElement | null }>).detail?.trigger ?? null);
  }
  window.addEventListener(WARD_MENU_EVENT, handler);
  return () => window.removeEventListener(WARD_MENU_EVENT, handler);
}
