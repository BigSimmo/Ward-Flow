/**
 * G3 (Josh, Notion "Diagnosed Issues", 3 Nov 2026, "yes to all recommendations"): page tips can be
 * turned off for this device, from the tip card itself or from Settings, and back on from Settings.
 * Kept in its own file so Settings does not load the tip card. The `ward_flow_choice_` prefix keeps
 * the choice at sign-out. Unreadable storage reads as on, as the tips' own once-per-page mark then
 * fails closed and shows nothing.
 *
 * Eight suggestions Q3 (Josh, 4 Nov 2026, "Yes to all recommendations"): on the demo site, page
 * tips start off. The tour is still offered once, and Settings turns tips on. A device that has
 * never chosen reads the default; "no" records a choice to keep them on. A signed-in shared build
 * keeps tips on by default and remembers the choice on the account (`ward-help-account-memory.ts`).
 */
export const HELP_TIPS_OFF_KEY = "ward_flow_choice_help_tips_off";
export const HELP_TIPS_CHANGED_EVENT = "ward-flow-help-tips-changed";
const CHANGED_EVENT = HELP_TIPS_CHANGED_EVENT;

/** Tips start off on the demo site (a production build without the shared workspace). */
export function helpTipsOffByDefault(): boolean {
  return process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_WARD_SHARED_ENABLED !== "true";
}

/** The device's own choice: true off, false on, null never chosen. */
export function helpTipsChoice(): boolean | null {
  try {
    const value = window.localStorage.getItem(HELP_TIPS_OFF_KEY);
    return value === "yes" ? true : value === "no" ? false : null;
  } catch {
    return null;
  }
}

export function helpTipsOff(): boolean {
  return helpTipsChoice() ?? helpTipsOffByDefault();
}

/**
 * Says whether the choice was saved. `fromAccount` marks a choice read back from the account, so it
 * is not sent back to it.
 */
export function setHelpTipsOff(off: boolean, fromAccount = false): boolean {
  try {
    window.localStorage.setItem(HELP_TIPS_OFF_KEY, off ? "yes" : "no");
  } catch {
    return false;
  }
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { fromAccount } }));
  return true;
}

export function subscribeHelpTipsOff(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === HELP_TIPS_OFF_KEY) onChange();
  };
  window.addEventListener(CHANGED_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
