/**
 * G3 (Josh, Notion "Diagnosed Issues", 3 Nov 2026, "yes to all recommendations"): page tips can be
 * turned off for this device, from the tip card itself or from Settings, and back on from Settings.
 * Kept in its own file so Settings does not load the tip card. The `ward_flow_choice_` prefix keeps
 * the choice at sign-out. Unreadable storage reads as on, as the tips' own once-per-page mark then
 * fails closed and shows nothing.
 */
export const HELP_TIPS_OFF_KEY = "ward_flow_choice_help_tips_off";
const CHANGED_EVENT = "ward-flow-help-tips-changed";

export function helpTipsOff(): boolean {
  try {
    return window.localStorage.getItem(HELP_TIPS_OFF_KEY) === "yes";
  } catch {
    return false;
  }
}

/** Says whether the choice was saved. */
export function setHelpTipsOff(off: boolean): boolean {
  try {
    if (off) window.localStorage.setItem(HELP_TIPS_OFF_KEY, "yes");
    else window.localStorage.removeItem(HELP_TIPS_OFF_KEY);
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
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
