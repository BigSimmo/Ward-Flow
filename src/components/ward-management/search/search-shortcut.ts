import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { hasOpenSheet } from "@/components/wf/sheet-focus";

/**
 * THE ONE SHORTCUT, EVERYWHERE: "/" or Ctrl/Cmd K focuses the header search. Matches
 * `universal-search-command-surface.tsx`'s own global shortcut exactly (same keys, same guard
 * against hijacking a keystroke meant for another field), so a coordinator keeps one habit.
 *
 * Shared by the header search and the plain field a phone draws before it loads
 * (`ward-global-search-lazy.tsx`), so both answer the same keys. True when the key should focus it.
 */
export function isGlobalSearchShortcut(event: KeyboardEvent): boolean {
  const slashShortcut =
    areCharacterShortcutsEnabled() && event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
  const commandShortcut = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey;
  if (!slashShortcut && !commandShortcut) return false;
  // An open sheet keeps its own keys: the phone referral's "/" opens its patient step. Search
  // stays live over that sheet (shell, `headerLiveOverSheet`) for a tap, not for the shortcut.
  if (event.defaultPrevented || hasOpenSheet()) return false;
  if (slashShortcut && document.querySelector('[data-testid="ward-patient-typeahead-input"]')) return false;
  const target = event.target as HTMLElement | null;
  return !(
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  );
}
