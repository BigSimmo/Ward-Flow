// F-10 (phone review, October 2026): code-split panels are fetched once the page has loaded and the
// browser is idle, never during the first load, and a failed fetch never surfaces as an error.
import { afterEach, describe, expect, it, vi } from "vitest";

import { preloadWhenIdle, shouldSkipIdlePreload } from "@/components/ward-management/preload-when-idle";

function setReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, "readyState", { configurable: true, get: () => state });
}

function setConnection(connection: { saveData?: boolean; effectiveType?: string } | undefined) {
  Object.defineProperty(navigator, "connection", { configurable: true, get: () => connection });
}

afterEach(() => {
  setReadyState("complete");
  setConnection(undefined);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("preloadWhenIdle", () => {
  it("waits for the load event and an idle moment before fetching", () => {
    setReadyState("loading");
    let idle: (() => void) | undefined;
    vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
      idle = callback;
      return 1;
    });
    const load = vi.fn(() => Promise.resolve());

    preloadWhenIdle(load);
    expect(idle).toBeUndefined();
    expect(load).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("load"));
    expect(load).not.toHaveBeenCalled();

    idle?.();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("falls back to a timer when the browser has no idle callback, and swallows a failed fetch", async () => {
    setReadyState("complete");
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    const failing = vi.fn(() => Promise.reject(new Error("offline")));
    const working = vi.fn(() => Promise.resolve());

    preloadWhenIdle(failing, working);
    expect(failing).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1500);
    expect(failing).toHaveBeenCalledTimes(1);
    expect(working).toHaveBeenCalledTimes(1);
  });

  // PERF-06 (front-end audit, 5 November 2026): Data Saver and 2G skip the preload entirely.
  it("skips the preload with Data Saver on or a 2G connection, and keeps it on a fast one", () => {
    setReadyState("complete");
    let idle: (() => void) | undefined;
    vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
      idle = callback;
      return 1;
    });
    const load = vi.fn(() => Promise.resolve());

    for (const connection of [{ saveData: true }, { effectiveType: "2g" }, { effectiveType: "slow-2g" }]) {
      setConnection(connection);
      preloadWhenIdle(load);
      idle?.();
    }
    expect(load).not.toHaveBeenCalled();

    setConnection({ saveData: false, effectiveType: "4g" });
    preloadWhenIdle(load);
    idle?.();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("treats a browser with no connection hint as a normal connection", () => {
    expect(shouldSkipIdlePreload(undefined)).toBe(false);
    expect(shouldSkipIdlePreload({ effectiveType: "3g" })).toBe(false);
  });
});
