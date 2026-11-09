import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GO_TO_KEY_WAIT,
  goToPageForShortcut,
  resetGoToShortcut,
} from "@/components/ward-management/shell/ward-goto-shortcuts";
import {
  readSavedViews,
  removeSavedView,
  savableView,
  SAVED_VIEW_LIMIT,
  toggleSavedView,
} from "@/components/ward-management/shell/ward-saved-views";

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

  it("toggles a view on and off, numbers repeats and keeps at most the limit", () => {
    expect(toggleSavedView({ title: "Waiting", href: "/ward-flow/waiting" })).toBe(true);
    expect(toggleSavedView({ title: "Waiting", href: "/ward-flow/waiting?view=form" })).toBe(true);
    expect(readSavedViews().map((view) => view.title)).toEqual(["Waiting (2)", "Waiting"]);
    expect(toggleSavedView({ title: "Waiting", href: "/ward-flow/waiting" })).toBe(false);
    expect(readSavedViews()).toHaveLength(1);
    removeSavedView(readSavedViews()[0]!.id);
    expect(readSavedViews()).toHaveLength(0);
    for (let index = 0; index < SAVED_VIEW_LIMIT + 3; index += 1)
      toggleSavedView({ title: "ED", href: `/ward-flow/ed?ed=${index}` });
    expect(readSavedViews()).toHaveLength(SAVED_VIEW_LIMIT);
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
