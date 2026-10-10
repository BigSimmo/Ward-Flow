export type ResolvedTheme = "light" | "dark";

/**
 * User-facing appearance choice. "system" follows the OS `prefers-color-scheme`
 * while "light"/"dark" pin the theme regardless of the OS. Only "light" and
 * "dark" are persisted; "system" is represented by the absence of a stored
 * value so the OS preference keeps flowing through on later visits.
 */
export type ThemePreference = ResolvedTheme | "system";

export const DEFAULT_THEME: ResolvedTheme = "dark";

/* Must equal the resolved `--background` for each root-mounted v2 theme in
   ckb-v2-tokens.css. These are painted by the browser (and the pre-hydration
   script) before any CSS is available, so a drift here shows up as a flash of
   the wrong page colour and a mismatched browser chrome bar. Re-check both
   whenever the v2 --background moves. */
export const APP_THEME_COLORS = {
  light: "#ffffff",
  dark: "#0b0e11",
} as const satisfies Record<ResolvedTheme, string>;

/** localStorage key for an explicit light/dark pin. */
export const THEME_STORAGE_KEY = "clinical-kb-theme";

/**
 * Cookie mirror of an explicit light/dark pin so the server layout can paint
 * the correct `<html>` class and `data-theme` before hydration. Cleared for "system".
 */
export const THEME_COOKIE_NAME = "clinical-theme";

/**
 * Storage key the ward shell used before the two theme switches were joined. The pre-paint script
 * moves a stored ward choice into `THEME_STORAGE_KEY` once, then deletes it, so nobody loses their
 * pin. Nothing else may read or write it.
 */
export const LEGACY_WARD_APPEARANCE_KEY = "ward-flow-appearance";

/**
 * Runs before paint and is the first half of the one theme switch (`./theme-client` is the other).
 * It resolves the pin (stored choice, else the legacy ward choice, else the cookie, else the OS) and
 * applies all three outputs together: `data-theme` on <html> when pinned, the legacy `.dark` class
 * for the older token layers, and the browser `theme-color`. In Auto it keeps `.dark` and
 * `theme-color` in step when the OS changes, so no React hook needs to be mounted for that. An
 * explicit `data-theme` means a pin, so the OS listener leaves it alone.
 *
 * Every catch swallows deliberately, and each says so inline. This runs before React mounts, so
 * there is no logger or toast to report to, and every failure here means the same thing: no
 * explicit pin was readable, so the next fallback applies. Keep the inline notes to one short
 * clause — this string ships in every page's `<head>`.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){var K="${THEME_STORAGE_KEY}",L="${LEGACY_WARD_APPEARANCE_KEY}",t=null;try{t=localStorage.getItem(K);var w=localStorage.getItem(L);if(t!=="light"&&t!=="dark"&&(w==="light"||w==="dark")){t=w;localStorage.setItem(K,w);try{document.cookie="${THEME_COOKIE_NAME}="+w+"; path=/; max-age=31536000; SameSite=Lax";}catch(e){/* cookie blocked - storage still holds the pin */}}if(w!==null)localStorage.removeItem(L);}catch(e){/* storage blocked (private/partitioned) - fall through to the cookie, then the OS preference */}if(t!=="light"&&t!=="dark"){t=null;try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE_NAME}=(light|dark)(?:;|$)/);if(m)t=m[1];}catch(e){/* cookie access blocked (sandboxed frame) - the OS preference below applies */}}var r=document.documentElement,q=null;try{q=window.matchMedia("(prefers-color-scheme: dark)");}catch(e){/* no matchMedia - treat the OS as light */}function paint(d){r.classList.toggle("dark",d);var c=d?"${APP_THEME_COLORS.dark}":"${APP_THEME_COLORS.light}";document.querySelectorAll('meta[name="theme-color"]').forEach(function(x){x.setAttribute("content",c);});}if(r.setAttribute){if(t)r.setAttribute("data-theme",t);else r.removeAttribute("data-theme");}paint(t?t==="dark":!!(q&&q.matches));try{q.addEventListener("change",function(){if(!r.getAttribute("data-theme"))paint(q.matches);});}catch(e){/* old browser - Auto follows the OS on the next load */}})();`;

/**
 * Glare mode: a separate on/off preference for ward PCs by bright windows. On sets
 * `data-mode="glare"` on <html>, which the v9 token layer styles. Off is the absence of a stored
 * value. It is independent of the light/dark choice.
 */
export const GLARE_STORAGE_KEY = "clinical-kb-glare";

/** Cookie mirror of Glare mode so the server layout paints `data-mode` before hydration. */
export const GLARE_COOKIE_NAME = "clinical-glare";

/** The value stored (and mirrored to the cookie) while Glare mode is on. */
export const GLARE_ON_VALUE = "on";

/** Reads Glare mode from a raw `document.cookie` string. */
export function readGlareCookie(cookieSource: string | null | undefined): boolean {
  if (!cookieSource) return false;
  return new RegExp(`(?:^|;\\s*)${GLARE_COOKIE_NAME}=${GLARE_ON_VALUE}(?:;|$)`).test(cookieSource);
}

/**
 * Runs before paint, straight after `THEME_BOOTSTRAP_SCRIPT`, so a Glare choice never flashes in.
 * Stored value first, then the cookie. Both catches swallow deliberately: a blocked read means Glare
 * mode is off, which is the default.
 */
export const GLARE_BOOTSTRAP_SCRIPT = `(function(){var g=null;try{g=localStorage.getItem("${GLARE_STORAGE_KEY}");}catch(e){/* storage blocked - try the cookie */}if(g!=="${GLARE_ON_VALUE}"){try{if(/(?:^|; )${GLARE_COOKIE_NAME}=${GLARE_ON_VALUE}(?:;|$)/.test(document.cookie))g="${GLARE_ON_VALUE}";}catch(e){/* cookie blocked - Glare stays off */}}var r=document.documentElement;if(r.setAttribute){if(g==="${GLARE_ON_VALUE}"){r.setAttribute("data-mode","glare");r.setAttribute("data-theme","light");r.classList.remove("dark");document.querySelectorAll('meta[name="theme-color"]').forEach(function(x){x.setAttribute("content","${APP_THEME_COLORS.light}");});}else if(r.getAttribute&&r.getAttribute("data-mode")==="glare")r.removeAttribute("data-mode");}})();`;

export function resolveThemePreference(storedTheme: string | null | undefined, prefersDark: boolean): ResolvedTheme {
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
  return prefersDark ? "dark" : "light";
}

/**
 * Maps a raw stored value to the appearance choice shown in settings. Anything
 * that is not an explicit "light"/"dark" pin (null, "system", or a stale value)
 * reads back as "system" so the control mirrors what the app actually renders.
 */
export function readThemePreference(storedTheme: string | null | undefined): ThemePreference {
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";
}

export function nextTheme(currentTheme: ResolvedTheme): ResolvedTheme {
  return currentTheme === "dark" ? "light" : "dark";
}

/** Read an explicit light/dark pin from `document.cookie`, if present. */
export function readThemeCookie(cookieSource: string | null | undefined): ResolvedTheme | null {
  if (!cookieSource) return null;
  const match = cookieSource.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE_NAME}=(light|dark)(?:;|$)`));
  return match?.[1] === "light" || match?.[1] === "dark" ? match[1] : null;
}
