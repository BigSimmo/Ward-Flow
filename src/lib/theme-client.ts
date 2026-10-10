/**
 * The one theme switch, client half. Every surface that reads or
 * changes the appearance goes through here: the app's `useTheme()`, the ward Tools, rail, Settings
 * and Community controls, and the sign-in screen. `THEME_BOOTSTRAP_SCRIPT` in `./theme` is the
 * pre-paint half and applies the same three outputs.
 *
 * One preference, persisted once (`THEME_STORAGE_KEY` plus the cookie the server layout reads), and
 * three outputs applied together every time: `data-theme` on <html> (pinned only), the legacy `.dark`
 * class for the older token layers, and both `theme-color` meta tags, so the token layers that follow
 * `data-theme` and the legacy layers that follow `.dark` can no longer disagree.
 *
 * Glare mode lives here too, as its own on/off preference (`GLARE_STORAGE_KEY` plus a cookie) with
 * its own single writer, `setGlarePreference`. `GLARE_BOOTSTRAP_SCRIPT` is its pre-paint half.
 */
import {
  APP_THEME_COLORS,
  GLARE_COOKIE_NAME,
  GLARE_ON_VALUE,
  GLARE_STORAGE_KEY,
  readGlareCookie,
  readThemeCookie,
  readThemePreference,
  resolveThemePreference,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

export const THEME_CHANGE_EVENT = "clinical-kb-theme-change";

const DARK_QUERY = "(prefers-color-scheme: dark)";

// Session fallback when storage throws (private mode, blocked site data). Null means storage is the
// source of truth.
let inMemoryPreference: ThemePreference | null = null;

function readCookie(): ResolvedTheme | null {
  try {
    return readThemeCookie(document.cookie);
  } catch {
    return null;
  }
}

/** The stored appearance choice: a light or dark pin, or "system" to follow the OS. */
export function readStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  if (inMemoryPreference !== null) return inMemoryPreference;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage blocked: the cookie below is the only persisted record left.
  }
  return readThemePreference(readCookie());
}

function prefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

/** The theme actually showing: the pin, or the OS when the choice is "system". */
export function readResolvedTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  const preference = readStoredThemePreference();
  return resolveThemePreference(preference === "system" ? null : preference, prefersDark());
}

/**
 * Apply a choice to <html> and the browser chrome. Idempotent, so any caller may re-run it. Glare mode
 * is a light canvas only, so while it is on the page paints light whatever the stored choice; the
 * choice itself is kept and comes back when Glare goes off.
 */
export function applyThemeToDocument(preference: ThemePreference): ResolvedTheme {
  const root = document.documentElement;
  const glare = root.getAttribute("data-mode") === "glare";
  const resolved = glare ? "light" : resolveThemePreference(preference === "system" ? null : preference, prefersDark());
  if (glare) root.setAttribute("data-theme", "light");
  else if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
  root.classList.toggle("dark", resolved === "dark");
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = APP_THEME_COLORS[resolved];
  }
  return resolved;
}

function writeCookie(preference: ThemePreference) {
  try {
    document.cookie =
      preference === "system"
        ? `${THEME_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
        : `${THEME_COOKIE_NAME}=${preference}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // Cookie write blocked: storage or the in-memory fallback still carries the choice.
  }
}

/** The only writer of the appearance preference. Persists, applies and tells every listener. */
export function setThemePreference(preference: ThemePreference): ResolvedTheme {
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    inMemoryPreference = null;
  } catch {
    // Storage blocked: keep the choice for this session so it still applies and reads back.
    inMemoryPreference = preference;
  }
  writeCookie(preference);
  const resolved = applyThemeToDocument(preference);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  return resolved;
}

/** Notifies on a choice made in this tab or another, and on an OS change while in "system". */
export function subscribeThemePreference(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  let media: MediaQueryList | null = null;
  try {
    media = window.matchMedia(DARK_QUERY);
  } catch {
    media = null;
  }
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  media?.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    media?.removeEventListener("change", onChange);
  };
}

export const GLARE_CHANGE_EVENT = "clinical-kb-glare-change";

// Session fallback for Glare mode when storage throws. Null means storage is the source of truth.
let inMemoryGlare: boolean | null = null;

/** Whether Glare mode is on: the stored choice, else the cookie, else off. */
export function readStoredGlarePreference(): boolean {
  if (typeof window === "undefined") return false;
  if (inMemoryGlare !== null) return inMemoryGlare;
  try {
    if (window.localStorage.getItem(GLARE_STORAGE_KEY) === GLARE_ON_VALUE) return true;
  } catch {
    // Storage blocked: the cookie below is the only persisted record left.
  }
  try {
    return readGlareCookie(document.cookie);
  } catch {
    return false;
  }
}

/** Apply Glare mode to <html>. Idempotent, so any caller may re-run it. */
export function applyGlareToDocument(on: boolean) {
  const root = document.documentElement;
  if (on) root.setAttribute("data-mode", "glare");
  else if (root.getAttribute("data-mode") === "glare") root.removeAttribute("data-mode");
  // Glare forces a light canvas, and turning it off brings the stored theme back.
  applyThemeToDocument(readStoredThemePreference());
}

/** The only writer of the Glare preference. Persists, applies and tells every listener. */
export function setGlarePreference(on: boolean) {
  try {
    if (on) window.localStorage.setItem(GLARE_STORAGE_KEY, GLARE_ON_VALUE);
    else window.localStorage.removeItem(GLARE_STORAGE_KEY);
    inMemoryGlare = null;
  } catch {
    // Storage blocked: keep the choice for this session so it still applies and reads back.
    inMemoryGlare = on;
  }
  try {
    document.cookie = on
      ? `${GLARE_COOKIE_NAME}=${GLARE_ON_VALUE}; path=/; max-age=31536000; SameSite=Lax`
      : `${GLARE_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // Cookie write blocked: storage or the in-memory fallback still carries the choice.
  }
  applyGlareToDocument(on);
  window.dispatchEvent(new Event(GLARE_CHANGE_EVENT));
}

/** Notifies on a Glare choice made in this tab or another. */
export function subscribeGlarePreference(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onChange);
  window.addEventListener(GLARE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(GLARE_CHANGE_EVENT, onChange);
  };
}

/** Test seam: forget the session fallbacks between tests. */
export function resetThemePreferenceForTests() {
  inMemoryPreference = null;
  inMemoryGlare = null;
}
