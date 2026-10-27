import { readFileSync } from "node:fs";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * What's new (Josh, 24 and 25 Oct 2026): a short note after each daily release, listing the changes
 * this device has not seen, shown only once the device has had the tour, and gone once closed. A
 * first visit gets the tour instead, which marks every change read.
 */

import {
  WHATS_NEW,
  WHATS_NEW_CARD_LIMIT,
  WHATS_NEW_STORAGE_KEY,
  WardWhatsNew,
  TOUR_AUTO_STARTED_EVENT,
  markWhatsNewSeen,
  unseenWhatsNew,
  type WhatsNewEntry,
} from "@/components/ward-management/help/ward-whats-new";

const TOUR_AUTO_DONE = "ward_flow_choice_tour_auto_done";
const newest = () => WHATS_NEW.at(-1) as WhatsNewEntry;

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe("what's new note", () => {
  it("stays hidden on a device that has not had the tour yet", () => {
    render(<WardWhatsNew />);
    expect(screen.queryByTestId("ward-whats-new")).toBeNull();
  });

  it("shows once on a returning device, and Got it keeps it closed", () => {
    window.localStorage.setItem(TOUR_AUTO_DONE, "yes");
    const { unmount } = render(<WardWhatsNew />);
    expect(screen.getByTestId("ward-whats-new").textContent).toContain(newest().line);
    fireEvent.click(screen.getByTestId("ward-whats-new-close"));
    expect(screen.queryByTestId("ward-whats-new")).toBeNull();
    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe(newest().id);
    unmount();
    render(<WardWhatsNew />);
    expect(screen.queryByTestId("ward-whats-new")).toBeNull();
  });

  it("sits under drawers, dialogs and toasts, so it never covers their buttons (P004)", () => {
    window.localStorage.setItem(TOUR_AUTO_DONE, "yes");
    render(<WardWhatsNew />);
    const host = screen.getByTestId("ward-whats-new").closest("[data-overlay-host]");
    expect(host?.getAttribute("data-overlay-host")).toBe("overlay");
  });

  it("lists only the changes added since this device last closed it", () => {
    window.localStorage.setItem(TOUR_AUTO_DONE, "yes");
    const before = WHATS_NEW.at(-2) as WhatsNewEntry;
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, before.id);
    render(<WardWhatsNew />);
    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual([newest().line]);
  });

  it("keeps away the note a device closed before the list began", () => {
    // The id the first note stored on 24 Oct, so devices that closed it do not see those lines again.
    expect(unseenWhatsNew("2026-10-24-help").map((entry) => entry.id)).not.toContain("2026-10-24-help-guide");
  });

  it("lists the newest first, at most a few, and the newest few for an id no longer listed", () => {
    const list = Array.from({ length: 7 }, (_, n) => ({ id: `e${n}`, date: "2026-10-25", line: `Line ${n}` }));
    expect(unseenWhatsNew("e4", list).map((entry) => entry.id)).toEqual(["e6", "e5"]);
    expect(unseenWhatsNew("e6", list)).toEqual([]);
    expect(unseenWhatsNew("gone", list).map((entry) => entry.id)).toEqual(["e6", "e5", "e4", "e3"]);
    expect(unseenWhatsNew(null, list)).toHaveLength(WHATS_NEW_CARD_LIMIT);
  });

  it("opens Help at What's new from its button", () => {
    window.localStorage.setItem(TOUR_AUTO_DONE, "yes");
    const opened: string[] = [];
    const listener = (event: Event) => opened.push((event as CustomEvent<{ view: string }>).detail.view);
    window.addEventListener("ward-flow-open-help", listener);
    render(<WardWhatsNew />);
    fireEvent.click(screen.getByRole("button", { name: "See all in Help" }));
    expect(opened).toEqual(["new"]);
    expect(screen.queryByTestId("ward-whats-new")).toBeNull();
    window.removeEventListener("ward-flow-open-help", listener);
  });

  it("marks every change read when the tour starts by itself on a first visit", () => {
    render(<WardWhatsNew />);
    act(() => {
      window.dispatchEvent(new Event(TOUR_AUTO_STARTED_EVENT));
    });
    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe(newest().id);
    // The tour sends the same event name, written out on its side to keep the files apart.
    const tourSource = readFileSync("src/components/ward-management/help/ward-tour-auto-start.tsx", "utf8");
    expect(tourSource).toContain(`"${TOUR_AUTO_STARTED_EVENT}"`);
  });

  it("stays hidden once marked read", () => {
    window.localStorage.setItem(TOUR_AUTO_DONE, "yes");
    act(() => markWhatsNewSeen());
    render(<WardWhatsNew />);
    expect(screen.queryByTestId("ward-whats-new")).toBeNull();
  });
});

describe("what's new list", () => {
  it("has unique ids, real dates in order and short plain lines", () => {
    const ids = WHATS_NEW.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [index, entry] of WHATS_NEW.entries()) {
      expect(entry.date, entry.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(entry.date)), entry.id).toBe(false);
      if (index > 0) expect(entry.date >= (WHATS_NEW[index - 1] as WhatsNewEntry).date, entry.id).toBe(true);
      expect(entry.line.length, entry.id).toBeLessThanOrEqual(120);
      expect(entry.line, entry.id).toMatch(/^[A-Z].*\.$/);
      // Staff words only: no pull request numbers, file names or code.
      expect(entry.line, entry.id).not.toMatch(/#\d|\.tsx?\b|`|\bPR\b/);
    }
  });

  it("stays short enough to load with every page", () => {
    expect(WHATS_NEW.length).toBeLessThanOrEqual(20);
  });
});
