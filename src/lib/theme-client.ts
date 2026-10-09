/**
 * The one theme switch, client half (design system v8, section 4). Every surface that reads or
 * changes the appearance goes through here: the app's `useTheme()`, the ward Tools, rail, Settings
 * and Community controls, and the sign-in screen. `THEME_BOOTSTRAP_SCRIPT` in `./theme` is the
 * pre-paint half and applies the same three outputs.
 *
 * One preference, persisted once (`THEME_STORAGE_KEY` plus the cookie the server layout reads), and
 * three outputs applied together every time: `data-theme` on <html> (pinned only), the legacy `.dark`
 * class for the older token layers, and both `theme-color` meta tags. v8 colour tokens resolve from
 * `color-scheme`, which follows `data-theme`, so they and the legacy layers can no longer disagree.
 */
import {
  APP_THEME_COLORS,
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

/** Apply a choice to <html> and the browser chrome. Idempotent, so any caller may re-run it. */
export function applyThemeToDocument(preference: ThemePreference): ResolvedTheme {
  const root = document.documentElement;
  const resolved = resolveThemePreference(preference === "system" ? null : preference, prefersDark());
  if (preference === "system") root.removeAttribute("data-theme");
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

/** Test seam: forget the session fallback between tests. */
export function resetThemePreferenceForTests() {
  inMemoryPreference = null;
}
