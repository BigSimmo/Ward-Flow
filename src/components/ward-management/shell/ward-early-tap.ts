/**
 * Header taps before the app is ready (Josh, 11 Oct 2026: "sometimes issues with clicking").
 *
 * The server draws the Ward Flow header, so its buttons look ready before the page's code has
 * loaded, and a tap in that gap did nothing. The ward layout's inline script runs this listener
 * from the first byte: it remembers the last header button pressed while the header is not yet
 * ready. When the header is ready it calls `replayEarlyHeaderTap`, which presses that button once,
 * unless the tap already took effect:
 * - a button with `aria-expanded` is pressed only if that value has not changed since the tap;
 * - a button that opens a dialog is pressed only if no dialog is open;
 * - any other button is pressed only if React had not yet attached when it was tapped (no
 *   `__reactContainer$` key on the document), because React never saw that tap.
 * Two or more early taps on a button that opens or toggles something are not replayed, because a
 * second press could undo the first. Any other button is pressed at most once.
 */
const WARD_HEADER_READY_ATTRIBUTE = "data-wf-bar-ready";

const HEADER_BUTTON = '[data-testid="ward-bar"] button[data-testid]';
/** An older tap than this is stale: the reader has moved on. */
const EARLY_TAP_MAX_AGE_MS = 8_000;
/** React replays some early taps itself just after the header is ready; let that land first. */
const SETTLE_MS = 150;

export const WARD_EARLY_TAP_SCRIPT = `(function(){var d=document.documentElement;document.addEventListener("click",function(e){if(d.hasAttribute("${WARD_HEADER_READY_ATTRIBUTE}"))return;var t=e.target;var b=t&&t.closest?t.closest('${HEADER_BUTTON}'):null;if(!b)return;var r=false;for(var k in document){if(k.indexOf("__reactContainer$")===0){r=true;break;}}var id=b.getAttribute("data-testid");var p=window.__wfEarlyTap;window.__wfEarlyTap={id:id,at:Date.now(),expanded:b.getAttribute("aria-expanded"),react:r,count:p&&p.id===id?p.count+1:1};},true);})();`;

type EarlyTap = { id: string; at: number; expanded: string | null; react: boolean; count: number };

function dialogIsOpen(): boolean {
  return Array.from(document.querySelectorAll('[role="dialog"]')).some((dialog) => dialog.getClientRects().length > 0);
}

function isToggle(button: HTMLButtonElement): boolean {
  return button.getAttribute("aria-expanded") !== null || button.getAttribute("aria-haspopup") === "dialog";
}

function tapTookEffect(button: HTMLButtonElement, tap: EarlyTap): boolean {
  const expanded = button.getAttribute("aria-expanded");
  if (expanded !== null) return expanded !== tap.expanded;
  if (button.getAttribute("aria-haspopup") === "dialog") return dialogIsOpen();
  return tap.react;
}

export function replayEarlyHeaderTap(): () => void {
  document.documentElement.setAttribute(WARD_HEADER_READY_ATTRIBUTE, "");
  const holder = window as Window & { __wfEarlyTap?: EarlyTap };
  const tap = holder.__wfEarlyTap;
  if (!tap || Date.now() - tap.at > EARLY_TAP_MAX_AGE_MS) {
    holder.__wfEarlyTap = undefined;
    return () => {};
  }
  // Taken only when the timer fires, so a mount that is undone at once (React's development
  // double mount) leaves the tap for the mount that stays.
  const timer = window.setTimeout(() => {
    holder.__wfEarlyTap = undefined;
    const button = document.querySelector(`[data-testid="ward-bar"] button[data-testid="${CSS.escape(tap.id)}"]`);
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    // Repeated taps on a toggle cannot be told apart from taps React already replayed.
    if (tap.count > 1 && isToggle(button)) return;
    if (!tapTookEffect(button, tap)) button.click();
  }, SETTLE_MS);
  return () => window.clearTimeout(timer);
}
