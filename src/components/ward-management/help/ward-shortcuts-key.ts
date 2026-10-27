import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { hasOpenSheet } from "@/components/wf/sheet-focus";

/**
 * "?" opens the keyboard shortcuts sheet on any screen (P120, Josh 27 Oct 2026: "yes, add the ?
 * shortcut sheet"). It is a single-key shortcut, so Settings' Single-key shortcuts switch turns it
 * off, and it never takes a keystroke meant for a field or an open sheet. Handover and Referrals
 * keep their own "?" sheet: their handlers call preventDefault, which this checks after them.
 */
export function isShortcutsSheetKey(event: KeyboardEvent): boolean {
  if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey) return false;
  if (event.defaultPrevented || hasOpenSheet() || !areCharacterShortcutsEnabled()) return false;
  const target = event.target as HTMLElement | null;
  return !(
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  );
}

/** Calls `onOpen` when "?" should open the sheet. Checked a tick later, after the page's own keys. */
export function subscribeShortcutsKey(onOpen: () => void): () => void {
  function handler(event: KeyboardEvent) {
    if (event.key !== "?") return;
    window.setTimeout(() => {
      if (isShortcutsSheetKey(event)) onOpen();
    }, 0);
  }
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}
