import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CensusEmpty } from "@/components/ward-management/search/patient-census-view";
import WardFlowLoading from "@/app/ward-flow/loading";
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
  const both = (startTime: number, extra?: object) => [
    fetched("http://localhost:3000/ward-flow/referrals?_rsc=tree", startTime, extra),
    fetched("http://localhost:3000/ward-flow/referrals?_rsc=page", startTime, extra),
  ];

  it("opens a dock page whose route tree and data both came back a moment ago", () => {
    expect(offlineCanOpen(link("ward-phone-dock-link"), target, both(now - 5_000), now)).toBe(true);
    expect(offlineCanOpen(link("ward-phone-menu-need"), target, both(now - 5_000), now)).toBe(true);
  });

  it("does not open a link whose page was only part fetched", () => {
    expect(offlineCanOpen(link("ward-rail-link"), target, both(now - 5_000), now)).toBe(false);
    expect(offlineCanOpen(link(), target, both(now - 5_000), now)).toBe(false);
    const treeOnly = [fetched("http://localhost:3000/ward-flow/referrals?_rsc=tree", now)];
    expect(offlineCanOpen(link("ward-phone-dock-link"), target, treeOnly, now)).toBe(false);
  });

  it("does not open a page fetched too long ago, for another address, or with an error", () => {
    const late = now + OFFLINE_PREFETCH_FRESH_MS + 1_000;
    expect(offlineCanOpen(link("ward-phone-dock-link"), target, both(now - 5_000), late)).toBe(false);
    const other = [
      fetched("http://localhost:3000/ward-flow/alerts?_rsc=tree", now),
      fetched("http://localhost:3000/ward-flow/alerts?_rsc=page", now),
    ];
    expect(offlineCanOpen(link("ward-phone-dock-link"), target, other, now)).toBe(false);
    const failed = [
      fetched("http://localhost:3000/ward-flow/referrals?_rsc=tree", now),
      fetched("http://localhost:3000/ward-flow/referrals?_rsc=page", now, { responseStatus: 500 }),
    ];
    expect(offlineCanOpen(link("ward-phone-dock-link"), target, failed, now)).toBe(false);
  });

  it("keeps the tap on the page where the browser gives no status", () => {
    expect(offlineCanOpen(link("ward-phone-dock-link"), target, both(now, { encodedBodySize: 3000 }), now)).toBe(false);
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

// Josh (5 Nov 2026, design audit card 8): one slow message and one timer, the first-load note's.
describe("Q275: a hung page change offers Reload", () => {
  it("draws the slow line with a Reload button the early script reloads from", () => {
    render(<WardFlowLoading />);
    const slow = screen.getByTestId("ward-loading-slow");
    expect(slow).toHaveTextContent("Still loading. Check the connection.");
    const retry = screen.getByRole("button", { name: "Reload", hidden: true });
    expect(retry).toHaveAttribute("data-wf-loading-reload");
  });

  it("the early script reloads when a reload button is pressed", () => {
    const reload = vi.fn();
    const listeners: EventListener[] = [];
    const add = vi.spyOn(document, "addEventListener").mockImplementation((type, listener) => {
      if (type === "click") listeners.push(listener as EventListener);
    });
    new Function("location", WARD_LOADING_NOTE_EARLY_SCRIPT)({ reload });
    add.mockRestore();
    const button = document.createElement("button");
    button.setAttribute("data-wf-loading-reload", "");
    document.body.append(button);
    listeners.forEach((listener) => listener({ target: button } as unknown as Event));
    expect(reload).toHaveBeenCalledTimes(1);
    listeners.forEach((listener) => listener({ target: document.body } as unknown as Event));
    expect(reload).toHaveBeenCalledTimes(1);
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
