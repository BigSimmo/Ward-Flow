import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CensusEmpty } from "@/components/ward-management/search/patient-census-view";
import { WARD_PAGE_SLOW_MS, WardLoadingSlow } from "@/components/ward-management/shell/ward-loading-slow";
import {
  WARD_LOADING_NOTE_EARLY_SCRIPT,
  WARD_LOADING_SLOW_ATTRIBUTE,
  WARD_LOADING_SLOW_MS,
} from "@/components/ward-management/shell/ward-loading-note-early";
import { OFFLINE_PREFETCH_FRESH_MS, offlineCanOpen } from "@/components/ward-management/shell/ward-offline-links";

/* Pre-launch review, check E (2 Nov 2026): empty, loading and offline states. */

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute(WARD_LOADING_SLOW_ATTRIBUTE);
  document.documentElement.removeAttribute("data-wf-bar-ready");
  document.body.innerHTML = "";
});

function link(testId?: string): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = "/ward-flow/referrals";
  if (testId) a.setAttribute("data-testid", testId);
  return a;
}

const target = new URL("http://localhost:3000/ward-flow/referrals");
const fetched = (name: string, startTime: number, extra: object = { responseStatus: 200 }) => ({
  name,
  startTime,
  duration: 50,
  ...extra,
});

describe("Q273: an offline tap opens a page the router already holds in full", () => {
  const now = 100_000;
  it("opens a dock page fetched in full a moment ago", () => {
    const entries = [fetched("http://localhost:3000/ward-flow/referrals?_rsc=abc", now - 5_000)];
    expect(offlineCanOpen(link("ward-phone-dock-link"), target, entries, now)).toBe(true);
  });

  it("does not open a link whose page was only part fetched", () => {
    const entries = [fetched("http://localhost:3000/ward-flow/referrals?_rsc=abc", now - 5_000)];
    expect(offlineCanOpen(link("ward-rail-link"), target, entries, now)).toBe(false);
    expect(offlineCanOpen(link(), target, entries, now)).toBe(false);
  });

  it("does not open a page fetched too long ago, never fetched, or fetched with an error", () => {
    const late = now + OFFLINE_PREFETCH_FRESH_MS + 1_000;
    const entries = [fetched("http://localhost:3000/ward-flow/referrals?_rsc=abc", now - 5_000)];
    expect(offlineCanOpen(link("ward-phone-dock-link"), target, entries, late)).toBe(false);
    expect(
      offlineCanOpen(
        link("ward-phone-dock-link"),
        target,
        [fetched("http://localhost:3000/ward-flow/alerts?_rsc=a", now)],
        now,
      ),
    ).toBe(false);
    expect(
      offlineCanOpen(
        link("ward-phone-dock-link"),
        target,
        [fetched("http://localhost:3000/ward-flow/referrals", now)],
        now,
      ),
    ).toBe(false);
    expect(
      offlineCanOpen(
        link("ward-phone-dock-link"),
        target,
        [fetched("http://localhost:3000/ward-flow/referrals?_rsc=a", now, { responseStatus: 500 })],
        now,
      ),
    ).toBe(false);
  });

  it("reads the body size where the browser gives no status", () => {
    const ok = [fetched("http://localhost:3000/ward-flow/referrals?_rsc=a", now, { encodedBodySize: 3000 })];
    const empty = [fetched("http://localhost:3000/ward-flow/referrals?_rsc=a", now, { encodedBodySize: 0 })];
    expect(offlineCanOpen(link("ward-phone-menu-need"), target, ok, now)).toBe(true);
    expect(offlineCanOpen(link("ward-phone-menu-need"), target, empty, now)).toBe(false);
  });
});

describe("Q274: the loading note offers Reload when the code never arrives", () => {
  it("marks the load slow after 15 seconds if the header is still not ready", () => {
    vi.useFakeTimers();
    new Function(WARD_LOADING_NOTE_EARLY_SCRIPT)();
    vi.advanceTimersByTime(WARD_LOADING_SLOW_MS - 1);
    expect(document.documentElement.hasAttribute(WARD_LOADING_SLOW_ATTRIBUTE)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(document.documentElement.hasAttribute(WARD_LOADING_SLOW_ATTRIBUTE)).toBe(true);
  });

  it("leaves a page that became ready alone", () => {
    vi.useFakeTimers();
    new Function(WARD_LOADING_NOTE_EARLY_SCRIPT)();
    document.documentElement.setAttribute("data-wf-bar-ready", "");
    vi.advanceTimersByTime(WARD_LOADING_SLOW_MS);
    expect(document.documentElement.hasAttribute(WARD_LOADING_SLOW_ATTRIBUTE)).toBe(false);
  });
});

describe("Q275: a hung page change offers Try again", () => {
  it("adds the line after 10 seconds", () => {
    vi.useFakeTimers();
    render(<WardLoadingSlow />);
    expect(screen.queryByTestId("ward-loading-slow")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(WARD_PAGE_SLOW_MS);
    });
    expect(screen.getByTestId("ward-loading-slow")).toHaveTextContent("This is taking longer than usual.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("Q277: Patients says plainly when nobody is on the census", () => {
  it("says No patients yet. with no Clear search", () => {
    render(<CensusEmpty query="" onReset={() => {}} onAdd={() => {}} nothingHeld />);
    expect(screen.getByText("No patients yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("still blames the search when one is set", () => {
    render(<CensusEmpty query="Test" onReset={() => {}} onAdd={() => {}} />);
    expect(screen.getByText("No patient matches “Test”")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
  });
});
