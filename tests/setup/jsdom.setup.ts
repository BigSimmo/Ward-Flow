// Setup for the vitest `jsdom` project (see vitest.config.mts). Registers the
// jest-dom matchers (toBeInTheDocument, toHaveAttribute, …) on vitest's expect,
// unmounts any React tree rendered by @testing-library/react after each test so
// DOM state never leaks between cases, and polyfills the two browser APIs jsdom
// omits that our components touch (matchMedia, Element.scrollIntoView). Tests
// that care about a specific matchMedia result override window.matchMedia
// themselves; the default here just keeps components that probe it from throwing.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { applyDueSoonThresholds } from "@/components/ward-management/ward-clock";
import { DUE_SOON_MINUTES, DUE_SOON_URGENT_MINUTES } from "@/components/ward-management/ward-operational-defaults";

export function installMatchMediaStub(matches = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(), // deprecated, kept for older consumers
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (typeof window !== "undefined") {
  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      return setTimeout(() => callback(performance.now()), 0) as unknown as number;
    };
  }
  if (typeof window.cancelAnimationFrame !== "function") {
    window.cancelAnimationFrame = (id: number): void => {
      clearTimeout(id);
    };
  }
}

beforeEach(() => {
  installMatchMediaStub(false);
  // jsdom does not implement scrollIntoView; components call it on focus/expand.
  // Ensure a base impl exists, then re-spy each test so the mock's call history is
  // reset every time — vi.restoreAllMocks() only restores vi.spyOn spies, not a
  // one-time plain vi.fn() assignment.
  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = () => {};
  }
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  try {
    applyDueSoonThresholds(DUE_SOON_URGENT_MINUTES, DUE_SOON_MINUTES);
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.clear();
    window.localStorage.clear();
  } catch {
    // ignore in environments without web storage
  }
});
