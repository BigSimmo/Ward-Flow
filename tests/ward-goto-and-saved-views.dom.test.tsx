import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GO_TO_KEY_WAIT,
  goToPageForShortcut,
  resetGoToShortcut,
} from "@/components/ward-management/shell/ward-goto-shortcuts";
import {
  readSavedViews,
  savableView,
  SAVED_VIEW_LIMIT,
  toggleSavedView,
} from "@/components/ward-management/shell/ward-saved-views";
import { savedViewMatches } from "@/components/ward-management/ward-global-search-my-views";

function key(value: string, extra: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: value, cancelable: true, ...extra });
}

describe("go-to keys (G then a letter)", () => {
  beforeEach(() => {
    resetGoToShortcut();
    window.localStorage.clear();
  });

  it("opens the page for the letter after G", () => {
    const navigate = vi.fn();
    expect(goToPageForShortcut(key("g"), () => true, navigate, "/ward-flow/command", 1_000)).toBe(true);
    const letter = key("e");
    expect(goToPageForShortcut(letter, () => true, navigate, "/ward-flow/command", 1_500)).toBe(true);
    expect(navigate).toHaveBeenCalledWith("/ward-flow/ed");
    expect(letter.defaultPrevented).toBe(true);
  });

  it("sends H to this desk's own Home", () => {
    const navigate = vi.fn();
    goToPageForShortcut(key("g"), () => true, navigate, "/ward-flow/wards/home", 0);
    goToPageForShortcut(key("h"), () => true, navigate, "/ward-flow/wards/home", 10);
    expect(navigate).toHaveBeenCalledWith("/ward-flow/wards/home");
  });

  it("leaves the letter alone when G was too long ago, the page is closed to this login, or shortcuts are off", () => {
    const navigate = vi.fn();
    goToPageForShortcut(key("g"), () => true, navigate, undefined, 0);
    expect(goToPageForShortcut(key("e"), () => true, navigate, undefined, GO_TO_KEY_WAIT + 1)).toBe(false);
    goToPageForShortcut(key("g"), () => false, navigate, undefined, 0);
    expect(goToPageForShortcut(key("s"), () => false, navigate, undefined, 5)).toBe(false);
    window.localStorage.setItem("ward-flow-character-shortcuts", "off");
    expect(goToPageForShortcut(key("g"), () => true, navigate, undefined, 0)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("ignores G with a modifier", () => {
    const navigate = vi.fn();
    expect(goToPageForShortcut(key("g", { ctrlKey: true }), () => true, navigate, undefined, 0)).toBe(false);
    expect(goToPageForShortcut(key("e"), () => true, navigate, undefined, 1)).toBe(false);
  });
});

describe("My views", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("saves only the app's main screens, never a patient's page", () => {
    expect(savableView("/ward-flow/people/P-123", "")).toBeNull();
    expect(savableView("/ward-flow/waiting", "")).not.toBeNull();
  });

  it("drops free-text parts of the address and keeps filters in a fixed order", () => {
    const view = savableView("/ward-flow/waiting", "?view=form&q=Smith&ward=W1&name=John");
    expect(view?.href).toBe("/ward-flow/waiting?view=form&ward=W1");
    expect(view?.title).toMatch(/filtered$/u);
    expect(view?.href).not.toMatch(/Smith|John/u);
  });

  it("drops every address part that points at one record, keeping only list filters", () => {
    const referral = savableView("/ward-flow/referrals", "?referral=R-12&tab=open");
    expect(referral?.href).toBe("/ward-flow/referrals?tab=open");
    const forms = savableView("/ward-flow/legal-forms", "?movement=M-1&record=1&admission=A-2&view=seclusion");
    expect(forms?.href).toBe("/ward-flow/legal-forms?view=seclusion");
    const waiting = savableView(
      "/ward-flow/waiting",
      "?patientId=P-9&alert=X&job=J&open=1&selected=2&show=severe&ed=E1&wait=12h",
    );
    expect(waiting?.href).toBe("/ward-flow/waiting?ed=E1&show=severe&wait=12h");
    expect(savableView("/ward-flow/referrals", "?referral=R-12")).toEqual({
      title: "Referrals",
      href: "/ward-flow/referrals",
    });
    expect(savableView("/ward-flow/waiting", "?ward=a%20b%20c")?.href).toBe("/ward-flow/waiting");
  });

  it("toggles a view on and off, numbers repeats and keeps at most the limit", () => {
    expect(toggleSavedView({ title: "Waiting", href: "/ward-flow/waiting" })).toBe(true);
    expect(toggleSavedView({ title: "Waiting", href: "/ward-flow/waiting?view=form" })).toBe(true);
    expect(readSavedViews().map((view) => view.title)).toEqual(["Waiting (2)", "Waiting"]);
    expect(toggleSavedView({ title: "Waiting", href: "/ward-flow/waiting" })).toBe(false);
    expect(readSavedViews()).toHaveLength(1);
    expect(toggleSavedView({ title: "Waiting", href: "/ward-flow/waiting?view=form" })).toBe(false);
    expect(readSavedViews()).toHaveLength(0);
    for (let index = 0; index < SAVED_VIEW_LIMIT + 3; index += 1)
      toggleSavedView({ title: "ED", href: `/ward-flow/ed?ed=${index}` });
    expect(readSavedViews()).toHaveLength(SAVED_VIEW_LIMIT);
  });

  it("numbers a repeat with the first number no saved view holds", () => {
    toggleSavedView({ title: "Waiting", href: "/ward-flow/waiting" });
    toggleSavedView({ title: "Waiting", href: "/ward-flow/waiting?show=severe" });
    toggleSavedView({ title: "Waiting", href: "/ward-flow/waiting?wait=8h" });
    expect(readSavedViews().map((view) => view.title)).toEqual(["Waiting (3)", "Waiting (2)", "Waiting"]);
    toggleSavedView({ title: "Waiting", href: "/ward-flow/waiting?show=severe" });
    toggleSavedView({ title: "Waiting", href: "/ward-flow/waiting?wait=12h" });
    expect(readSavedViews().map((view) => view.title)).toEqual(["Waiting (2)", "Waiting (3)", "Waiting"]);
  });

  it("ignores a damaged stored list", () => {
    window.localStorage.setItem("ward-flow-saved-views", "{not json");
    expect(readSavedViews()).toEqual([]);
    window.localStorage.setItem(
      "ward-flow-saved-views",
      JSON.stringify([{ id: 1 }, { id: "a", title: "x", href: "https://x" }]),
    );
    expect(readSavedViews()).toEqual([]);
  });
});

describe("My views in search", () => {
  it("matches typed words that start a word of the title", () => {
    expect(savedViewMatches("Waiting, filtered", "wait")).toBe(true);
    expect(savedViewMatches("Waiting, filtered", "wait filt")).toBe(true);
    expect(savedViewMatches("Waiting (2)", "waiting")).toBe(true);
    expect(savedViewMatches("Waiting", "aiting")).toBe(false);
    expect(savedViewMatches("Capacity", "ed")).toBe(false);
  });

  it("lists every saved view for the My views words, but never for one letter", () => {
    expect(savedViewMatches("Capacity", "my views")).toBe(true);
    expect(savedViewMatches("Capacity", "saved")).toBe(true);
    expect(savedViewMatches("Capacity", "my")).toBe(true);
    expect(savedViewMatches("Capacity", "s")).toBe(false);
    expect(savedViewMatches("Capacity", "e")).toBe(false);
    expect(savedViewMatches("Capacity", "")).toBe(false);
    expect(savedViewMatches("Capacity", "my wards")).toBe(false);
  });
});
