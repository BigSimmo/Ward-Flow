/**
 * WF-31: snapshot display prefs on enter; restore on leave. Zero imports — even a dynamic
 * import("@/lib/theme-client") from this module reshuffles the shared phone script chunk when the
 * statistics layout reaches it. Restore writes storage + document the same way the writers do.
 */
type Snap = { theme: "light" | "dark" | "system"; glare: boolean; railOpen: boolean };

const THEME_KEY = "clinical-kb-theme";
const THEME_COOKIE = "clinical-theme";
const GLARE_KEY = "clinical-kb-glare";
const GLARE_ON = "on";
const GLARE_COOKIE = "clinical-glare";
const RAIL_KEY = "ward-flow-rail";
const RAIL_EVENT = "ward-flow-rail-change";
const THEME_EVENT = "clinical-kb-theme-change";
const GLARE_EVENT = "clinical-kb-glare-change";

function snapshot(): Snap {
  let theme: Snap["theme"] = "system";
  let glare = false;
  let railOpen = true;
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark") theme = t;
    glare = window.localStorage.getItem(GLARE_KEY) === GLARE_ON;
    railOpen = window.localStorage.getItem(RAIL_KEY) !== "closed";
  } catch {
    /* storage blocked */
  }
  return { theme, glare, railOpen };
}

function secure() {
  return typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
}

function restore(snap: Snap) {
  try {
    if (snap.theme === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, snap.theme);
  } catch {
    /* storage blocked */
  }
  try {
    document.cookie =
      snap.theme === "system"
        ? `${THEME_COOKIE}=; path=/; max-age=0; SameSite=Lax${secure()}`
        : `${THEME_COOKIE}=${snap.theme}; path=/; max-age=31536000; SameSite=Lax${secure()}`;
  } catch {
    /* cookie blocked */
  }
  const dark =
    snap.theme === "dark" || (snap.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  if (snap.theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", snap.theme);
  root.classList.toggle("dark", dark);
  window.dispatchEvent(new Event(THEME_EVENT));

  try {
    if (snap.glare) window.localStorage.setItem(GLARE_KEY, GLARE_ON);
    else window.localStorage.removeItem(GLARE_KEY);
  } catch {
    /* storage blocked */
  }
  try {
    document.cookie = snap.glare
      ? `${GLARE_COOKIE}=${GLARE_ON}; path=/; max-age=31536000; SameSite=Lax${secure()}`
      : `${GLARE_COOKIE}=; path=/; max-age=0; SameSite=Lax${secure()}`;
  } catch {
    /* cookie blocked */
  }
  if (snap.glare) root.setAttribute("data-mode", "glare");
  else root.removeAttribute("data-mode");
  window.dispatchEvent(new Event(GLARE_EVENT));

  try {
    window.localStorage.setItem(RAIL_KEY, snap.railOpen ? "open" : "closed");
  } catch {
    /* storage blocked */
  }
  root.setAttribute("data-rail", snap.railOpen ? "open" : "closed");
  window.dispatchEvent(new Event(RAIL_EVENT));
}

export function enterStatisticsDisplayPrefScope(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const snap = snapshot();
  return () => restore(snap);
}

export function resetStatisticsDisplayPrefScopeForTests() {}
