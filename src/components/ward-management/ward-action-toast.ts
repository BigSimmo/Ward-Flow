/**
 * Walk-through WT-10 (26 Oct 2026): a screen's own action toast showed a refusal with the same
 * success tick as a recorded step. A plain string is a recorded step. `{ warning }` is a refusal or
 * a step that did not go through, and the screen shows it with the warning glyph and tone.
 */
export type ActionToast = string | { warning: string };

/** The words of a toast, whichever kind it is. */
export function actionToastText(toast: ActionToast): string {
  return typeof toast === "string" ? toast : toast.warning;
}

/** True when the toast reports a refusal or a step that did not go through. */
export function isWarningToast(toast: ActionToast | null): boolean {
  return toast !== null && typeof toast !== "string";
}
