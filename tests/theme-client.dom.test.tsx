import { afterEach, describe, expect, it, vi } from "vitest";

import {
  APP_THEME_COLORS,
  GLARE_COOKIE_NAME,
  GLARE_STORAGE_KEY,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
} from "@/lib/theme";
import {
  applyGlareToDocument,
  applyThemeToDocument,
  GLARE_CHANGE_EVENT,
  readStoredGlarePreference,
  readStoredThemePreference,
  resetThemePreferenceForTests,
  setGlarePreference,
  setThemePreference,
  subscribeGlarePreference,
  subscribeThemePreference,
  THEME_CHANGE_EVENT,
} from "@/lib/theme-client";

/**
 * The client half of the one theme switch. Before it the ward set only `data-theme` and the rest of
 * the app set only `.dark`, so the two halves of a page could disagree. These cases pin that every
 * write applies all three outputs together, and that Glare mode is its own preference beside it.
 */

function addThemeColorMeta() {
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  document.head.append(meta);
  return meta;
}

afterEach(() => {
  vi.restoreAllMocks();
  setThemePreference("system");
  setGlarePreference(false);
  window.localStorage.clear();
  document.head.innerHTML = "";
  resetThemePreferenceForTests();
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

describe("the Glare mode preference", () => {
  it("is off by default, with no data-mode on the root", () => {
    expect(readStoredGlarePreference()).toBe(false);
    expect(document.documentElement.hasAttribute("data-mode")).toBe(false);
  });

  it("sets data-mode=glare and persists in its own key and cookie, then clears both when off", () => {
    setGlarePreference(true);
    expect(document.documentElement.getAttribute("data-mode")).toBe("glare");
    expect(window.localStorage.getItem(GLARE_STORAGE_KEY)).toBe("on");
    expect(document.cookie).toContain(`${GLARE_COOKIE_NAME}=on`);
    expect(readStoredGlarePreference()).toBe(true);

    setGlarePreference(false);
    expect(document.documentElement.hasAttribute("data-mode")).toBe(false);
    expect(window.localStorage.getItem(GLARE_STORAGE_KEY)).toBeNull();
    expect(document.cookie).not.toContain(`${GLARE_COOKIE_NAME}=on`);
    expect(readStoredGlarePreference()).toBe(false);
  });

  it("leaves the theme choice alone, and the theme leaves Glare alone", () => {
    setThemePreference("dark");
    setGlarePreference(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    setThemePreference("light");
    expect(document.documentElement.getAttribute("data-mode")).toBe("glare");
    expect(window.localStorage.getItem(GLARE_STORAGE_KEY)).toBe("on");
  });

  it("notifies subscribers on a change", () => {
    const onChange = vi.fn();
    const stop = subscribeGlarePreference(onChange);
    setGlarePreference(true);
    expect(onChange).toHaveBeenCalled();
    stop();
    onChange.mockClear();
    window.dispatchEvent(new Event(GLARE_CHANGE_EVENT));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the choice for the session when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    setGlarePreference(true);
    expect(readStoredGlarePreference()).toBe(true);
    expect(document.documentElement.getAttribute("data-mode")).toBe("glare");
  });

  it("removes only its own data-mode value when re-applied off", () => {
    document.documentElement.setAttribute("data-mode", "other");
    applyGlareToDocument(false);
    expect(document.documentElement.getAttribute("data-mode")).toBe("other");
    document.documentElement.removeAttribute("data-mode");
  });
});
