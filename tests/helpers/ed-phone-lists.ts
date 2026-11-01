import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

/**
 * Handover build (Josh, 1 Nov 2026): the desktop ED page shows one Lists card with Awaiting review,
 * Expected and Forms. The full Lists (referral inbox with Decline, Still to be moved, Recently
 * answered) stay on the phone's Lists pane, so tests of those lists run at phone width.
 */
export function atPhoneWidthForEachTest() {
  let original: typeof window.matchMedia | undefined;
  beforeEach(() => {
    original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(max-width: 48rem)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    if (original) window.matchMedia = original;
  });
}

/** Chooses the phone's Lists pane, if the board offers one. */
export function showPhoneLists() {
  const pane = screen.queryByRole("radio", { name: /^Lists/u });
  if (pane && pane.getAttribute("aria-checked") !== "true") fireEvent.click(pane);
}

/** Inside an `atPhoneWidthForEachTest` file, makes one case read the desktop layout instead. */
export function atDesktopWidth() {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
