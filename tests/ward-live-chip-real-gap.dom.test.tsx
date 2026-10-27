import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveChip, publishLiveRefresh } from "@/components/wf";

/**
 * P167 (audit register): the Live chip read "Stale as at" for seconds at a time after a duplicate tab
 * closed, and flipped with "Demo" while one refresh failed or ran slow. Stale must mean a real gap:
 * the last good refresh older than its limit while the tab is shown.
 */
let visibility: DocumentVisibilityState = "visible";

function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date("2026-10-07T10:26:00+08:00"));
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
});
afterEach(() => {
  act(() => publishLiveRefresh(undefined));
  setVisibility("visible");
  vi.useRealTimers();
});

describe("Live chip Stale needs a real gap (P167)", () => {
  it("gives a tab coming back from hidden the normal refresh time before Stale", () => {
    act(() => publishLiveRefresh({ unavailable: false, receivedAt: Date.now(), staleAfterMs: 6000 }));
    render(<LiveChip state="live" />);
    setVisibility("hidden");
    act(() => vi.advanceTimersByTime(20_000));
    setVisibility("visible");
    expect(screen.getByRole("status")).toHaveTextContent(/^Demo$/);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole("status")).toHaveTextContent(/^Demo$/);
    // Still no good refresh once shown for longer than the limit: that is a real gap.
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("status")).toHaveTextContent("Stale, as at 10:26");
  });

  it("does not read Stale for one failed refresh while the last good one is recent", () => {
    act(() => publishLiveRefresh({ unavailable: true, receivedAt: Date.now(), staleAfterMs: 6000 }));
    render(<LiveChip state="live" />);
    expect(screen.getByRole("status")).toHaveTextContent(/^Demo$/);
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.getByRole("status")).toHaveTextContent("Stale, as at 10:26");
  });
});
