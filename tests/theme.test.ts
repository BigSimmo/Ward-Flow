import { describe, expect, it, vi } from "vitest";
import {
  APP_THEME_COLORS,
  LEGACY_WARD_APPEARANCE_KEY,
  nextTheme,
  readThemeCookie,
  readThemePreference,
  resolveThemePreference,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
} from "../src/lib/theme";

describe("theme helpers", () => {
  it("uses stored explicit theme before system preference", () => {
    expect(resolveThemePreference("dark", false)).toBe("dark");
    expect(resolveThemePreference("light", true)).toBe("light");
  });

  it("falls back to system preference when no stored theme exists", () => {
    expect(resolveThemePreference(null, true)).toBe("dark");
    expect(resolveThemePreference(undefined, false)).toBe("light");
  });

  it("toggles between light and dark", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });

  it("keeps installed-app browser chrome aligned with both application themes", () => {
    // A deliberate tripwire on the exact values: these paint before any
    // stylesheet loads, so an accidental edit here is a flash of the wrong page
    // colour. The pin is only half the story — it went stale when --background
    // moved and this assertion did not, so the light value tracking
    // the root-mounted v2 layer is enforced in tests/design-token-contract.test.ts.
    expect(APP_THEME_COLORS).toEqual({ light: "#ffffff", dark: "#0b0e11" });
  });

  it("still applies the OS dark theme when localStorage is blocked", () => {
    const classes = new Set(["ckb-v2"]);
    const toggle = vi.fn((name: string, force: boolean) => {
      if (force) classes.add(name);
      else classes.delete(name);
    });
    const setAttribute = vi.fn();
    const run = new Function("localStorage", "window", "document", THEME_BOOTSTRAP_SCRIPT);

    run(
      {
        getItem() {
          throw new DOMException("Blocked", "SecurityError");
        },
      },
      { matchMedia: () => ({ matches: true }) },
      {
        documentElement: { classList: { toggle } },
        querySelectorAll: () => [{ setAttribute }],
      },
    );

    expect(toggle).toHaveBeenCalledWith("dark", true);
    expect(classes).toEqual(new Set(["ckb-v2", "dark"]));
    expect(setAttribute).toHaveBeenCalledWith("content", APP_THEME_COLORS.dark);
  });

  it("reads the appearance preference from the stored value", () => {
    expect(readThemePreference("light")).toBe("light");
    expect(readThemePreference("dark")).toBe("dark");
    // No pin and stale/system values both resolve to "system" so the OS
    // preference keeps flowing through the resolved theme.
    expect(readThemePreference(null)).toBe("system");
    expect(readThemePreference(undefined)).toBe("system");
    expect(readThemePreference("system")).toBe("system");
    expect(readThemePreference("sepia")).toBe("system");
  });

  it("exports stable storage and cookie keys shared with layout + useTheme", () => {
    expect(THEME_STORAGE_KEY).toBe("clinical-kb-theme");
    expect(THEME_COOKIE_NAME).toBe("clinical-theme");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_COOKIE_NAME);
  });

  it("parses an explicit theme pin from the cookie string", () => {
    expect(readThemeCookie(`${THEME_COOKIE_NAME}=dark`)).toBe("dark");
    expect(readThemeCookie(`a=1; ${THEME_COOKIE_NAME}=light; b=2`)).toBe("light");
    expect(readThemeCookie(`${THEME_COOKIE_NAME}=system`)).toBeNull();
    expect(readThemeCookie("")).toBeNull();
  });

  it("falls back to the theme cookie when localStorage has no pin", () => {
    const toggle = vi.fn();
    const setAttribute = vi.fn();
    const run = new Function("localStorage", "window", "document", THEME_BOOTSTRAP_SCRIPT);

    run(
      {
        getItem() {
          return null;
        },
      },
      { matchMedia: () => ({ matches: false }) },
      {
        cookie: `${THEME_COOKIE_NAME}=dark`,
        documentElement: { classList: { toggle } },
        querySelectorAll: () => [{ setAttribute }],
      },
    );

    expect(toggle).toHaveBeenCalledWith("dark", true);
    expect(setAttribute).toHaveBeenCalledWith("content", APP_THEME_COLORS.dark);
  });

  /** A fake <html> and storage, enough to run the pre-paint script end to end. */
  function fakePage({ store = {} as Record<string, string>, prefersDark = false } = {}) {
    const attributes = new Map<string, string>();
    const classes = new Set<string>();
    const listeners: Array<() => void> = [];
    const metas = [
      {
        content: "",
        setAttribute(_: string, value: string) {
          this.content = value;
        },
      },
    ];
    const media = { matches: prefersDark, addEventListener: (_: string, fn: () => void) => listeners.push(fn) };
    const page = {
      store,
      attributes,
      classes,
      metas,
      media,
      fireOsChange(dark: boolean) {
        media.matches = dark;
        listeners.forEach((fn) => fn());
      },
      run() {
        new Function("localStorage", "window", "document", THEME_BOOTSTRAP_SCRIPT)(
          {
            getItem: (key: string) => store[key] ?? null,
            setItem: (key: string, value: string) => (store[key] = value),
            removeItem: (key: string) => delete store[key],
          },
          { matchMedia: () => media },
          {
            cookie: "",
            documentElement: {
              classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) },
              setAttribute: (name: string, value: string) => attributes.set(name, value),
              removeAttribute: (name: string) => attributes.delete(name),
              getAttribute: (name: string) => attributes.get(name) ?? null,
            },
            querySelectorAll: () => metas,
          },
        );
      },
    };
    return page;
  }

  it("pins data-theme, .dark and theme-color together before paint (one switch, design system v8)", () => {
    const page = fakePage({ store: { [THEME_STORAGE_KEY]: "light" }, prefersDark: true });
    page.run();
    expect(page.attributes.get("data-theme")).toBe("light");
    expect(page.classes.has("dark")).toBe(false);
    expect(page.metas[0].content).toBe(APP_THEME_COLORS.light);
  });

  it("follows the OS with no data-theme when nothing is pinned, and keeps following it", () => {
    const page = fakePage({ prefersDark: false });
    page.run();
    expect(page.attributes.has("data-theme")).toBe(false);
    expect(page.classes.has("dark")).toBe(false);
    page.fireOsChange(true);
    expect(page.classes.has("dark"), "Auto did not follow the OS change").toBe(true);
    expect(page.metas[0].content).toBe(APP_THEME_COLORS.dark);
  });

  it("leaves a pin alone when the OS changes", () => {
    const page = fakePage({ store: { [THEME_STORAGE_KEY]: "light" } });
    page.run();
    page.fireOsChange(true);
    expect(page.classes.has("dark")).toBe(false);
    expect(page.attributes.get("data-theme")).toBe("light");
  });

  it("moves a ward pin made before v8 into the one key, once, and deletes the old key", () => {
    const page = fakePage({ store: { [LEGACY_WARD_APPEARANCE_KEY]: "dark" } });
    page.run();
    expect(page.store[THEME_STORAGE_KEY]).toBe("dark");
    expect(page.store[LEGACY_WARD_APPEARANCE_KEY]).toBeUndefined();
    expect(page.attributes.get("data-theme")).toBe("dark");
    expect(page.classes.has("dark")).toBe(true);
  });

  it("lets the app key win over a stale ward key", () => {
    const page = fakePage({ store: { [THEME_STORAGE_KEY]: "light", [LEGACY_WARD_APPEARANCE_KEY]: "dark" } });
    page.run();
    expect(page.attributes.get("data-theme")).toBe("light");
  });
});
