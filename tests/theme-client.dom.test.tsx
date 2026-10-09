import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_THEME_COLORS, THEME_COOKIE_NAME, THEME_STORAGE_KEY } from "@/lib/theme";
import {
  applyThemeToDocument,
  readStoredThemePreference,
  resetThemePreferenceForTests,
  setThemePreference,
  subscribeThemePreference,
  THEME_CHANGE_EVENT,
} from "@/lib/theme-client";

/**
 * The client half of the one theme switch (design system v8, section 4). Before v8 the ward set only
 * `data-theme` and the rest of the app set only `.dark`, so the two halves of a page could disagree.
 * These cases pin that every write applies all three outputs together.
 */

function addThemeColorMeta() {
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  document.head.append(meta);
  return meta;
}

afterEach(() => {
  setThemePreference("system");
  window.localStorage.clear();
  document.head.innerHTML = "";
  resetThemePreferenceForTests();
  vi.restoreAllMocks();
});

describe("the one theme switch", () => {
  it("applies data-theme, .dark and theme-color together for a pin", () => {
    const meta = addThemeColorMeta();
    setThemePreference("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(meta.content).toBe(APP_THEME_COLORS.dark);

    setThemePreference("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(meta.content).toBe(APP_THEME_COLORS.light);
  });

  it("persists a pin in storage and the cookie the server layout reads, and clears both for system", () => {
    setThemePreference("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.cookie).toContain(`${THEME_COOKIE_NAME}=dark`);

    setThemePreference("system");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.cookie).not.toContain(`${THEME_COOKIE_NAME}=dark`);
    expect(document.documentElement.hasAttribute("data-theme"), "system must remove the pin").toBe(false);
  });

  it("notifies every subscriber, so two controls can never disagree", () => {
    const onChange = vi.fn();
    const stop = subscribeThemePreference(onChange);
    setThemePreference("light");
    expect(onChange).toHaveBeenCalled();
    stop();
    onChange.mockClear();
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the choice for the session when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    setThemePreference("dark");
    expect(readStoredThemePreference()).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("re-applies idempotently", () => {
    applyThemeToDocument("dark");
    applyThemeToDocument("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
