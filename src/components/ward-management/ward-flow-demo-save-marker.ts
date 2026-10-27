/**
 * WS-13 (workflow speed audit, 26 Oct 2026): whether the stored save is still the session's latest.
 * Holds no record content. Set after each successful write and removed when a write fails (a removal
 * needs no storage room, so it still works when the quota is full). A restore says "Later changes may
 * not have been saved" only when it is missing, so an ordinary reload no longer warns of a loss that
 * did not happen. A save from before this marker existed reads as not current: the cautious side.
 */
const DEMO_SAVE_CURRENT_KEY = "ward-flow:demo-save-current";

export function markDemoSaveCurrent(current: boolean) {
  try {
    if (current) window.sessionStorage.setItem(DEMO_SAVE_CURRENT_KEY, "1");
    else window.sessionStorage.removeItem(DEMO_SAVE_CURRENT_KEY);
  } catch {
    // A marker that cannot be written leaves the cautious notice in place.
  }
}

/** False when a later write failed, or when this cannot be told: the restore notice then shows. */
export function demoSaveIsCurrent(): boolean {
  try {
    return window.sessionStorage.getItem(DEMO_SAVE_CURRENT_KEY) === "1";
  } catch {
    return false;
  }
}
