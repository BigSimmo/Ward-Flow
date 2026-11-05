import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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
  LEGACY_ORDER,
  WardWhatsNew,
  TOUR_AUTO_STARTED_EVENT,
  markWhatsNewSeen,
  unseenWhatsNew,
  type WhatsNewEntry,
} from "@/components/ward-management/help/ward-whats-new";
import { readWhatsNewEntries, WHATS_NEW_DIR } from "../scripts/ward-flow/whats-new-list.mjs";

const TOUR_AUTO_DONE = "ward_flow_choice_tour_auto_done";
const newest = () => WHATS_NEW.at(-1) as WhatsNewEntry;
const seenList = () => JSON.parse(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY) ?? "[]") as string[];

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
    expect(seenList()).toEqual(WHATS_NEW.map((entry) => entry.id));
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
    const seen = WHATS_NEW.slice(0, -1).map((entry) => entry.id);
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, JSON.stringify(seen));
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

  it("still shows a change that sorts among ones this device has seen", () => {
    const list = ["2026-11-03-a", "2026-11-03-b", "2026-11-03-c"].map((id) => ({ id, date: "2026-11-03", line: id }));
    const seen = JSON.stringify(["2026-11-03-a", "2026-11-03-c"]);
    expect(unseenWhatsNew(seen, list).map((entry) => entry.id)).toEqual(["2026-11-03-b"]);
    expect(unseenWhatsNew("[not json", list)).toHaveLength(3);
  });

  it("reads an id stored before entry files against the old list order", () => {
    // A fixed list of the lines from before entry files, sorted as entry files are, so neither a newer
    // entry file nor the newest-20 cap dropping old lines changes this answer.
    const before: WhatsNewEntry[] = LEGACY_ORDER.toSorted().map((id) => ({ id, date: id.slice(0, 10), line: id }));
    const ids = (seen: string) => unseenWhatsNew(seen, before).map((entry) => entry.id);
    // Under the old order only the referral line came after this id, though it no longer sorts last.
    expect(ids("2026-11-03-one-alerts-switch")).toEqual(["2026-11-03-simpler-new-referral"]);
    // This id now sorts last, yet four lines came after it in the old order (the card shows four).
    expect(ids("2026-11-03-waiting-and-all-eds")).toEqual([
      "2026-11-03-simpler-new-referral",
      "2026-11-03-one-alerts-switch",
      "2026-11-03-journey-recovery",
      "2026-11-03-integrity-save-confirmation",
    ]);
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
    expect(seenList()).toEqual(WHATS_NEW.map((entry) => entry.id));
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

  it("is the newest 20 entry files, one per change, so parallel pull requests never share lines", () => {
    expect(WHATS_NEW).toEqual(readWhatsNewEntries());
    expect(() => readFileSync("src/components/ward-management/help/whats-new.json")).toThrow();
    const root = mkdtempSync(path.join(tmpdir(), "whats-new-"));
    const folder = path.join(root, WHATS_NEW_DIR);
    mkdirSync(folder, { recursive: true });
    const add = (name: string, body: string) => writeFileSync(path.join(folder, name), body);
    try {
      add("2026-11-04-b.json", '{ "line": "B." }');
      add("2026-11-03-z.json", '{ "line": "Z." }');
      add("2026-11-04-a.json", '{ "line": "A." }');
      add("notes.md", "ignored");
      expect(readWhatsNewEntries(root).map((entry) => entry.id)).toEqual([
        "2026-11-03-z",
        "2026-11-04-a",
        "2026-11-04-b",
      ]);
      expect(readWhatsNewEntries(root, 2).map((entry) => entry.id)).toEqual(["2026-11-04-a", "2026-11-04-b"]);
      add("2026-11-04-c.json", '{ "line": "C.", "id": "x" }');
      expect(() => readWhatsNewEntries(root)).toThrow(/exactly/);
      rmSync(path.join(folder, "2026-11-04-c.json"));
      add("Nov-4.json", '{ "line": "D." }');
      expect(() => readWhatsNewEntries(root)).toThrow(/YYYY-MM-DD/);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});

describe("What's new stays out of the way (WF-25)", () => {
  it("shows once: leaving without Got it does not bring it back", () => {
    window.localStorage.setItem(TOUR_AUTO_DONE, "yes");
    const { unmount } = render(<WardWhatsNew />);
    expect(screen.getByTestId("ward-whats-new")).toBeTruthy();
    unmount();
    render(<WardWhatsNew />);
    expect(screen.queryByTestId("ward-whats-new")).toBeNull();
  });

  it("steps aside while a dialog is open, and comes back when it closes", async () => {
    window.localStorage.setItem(TOUR_AUTO_DONE, "yes");
    render(<WardWhatsNew />);
    expect(screen.getByTestId("ward-whats-new")).toBeTruthy();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    await act(async () => {
      document.body.append(dialog);
    });
    expect(screen.queryByTestId("ward-whats-new")).toBeNull();
    await act(async () => {
      dialog.remove();
    });
    expect(screen.getByTestId("ward-whats-new")).toBeTruthy();
  });
});
