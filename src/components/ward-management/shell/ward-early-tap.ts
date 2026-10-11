/**
 * Header taps before the app is ready (Josh, 11 Oct 2026: "sometimes issues with clicking").
 *
 * The server draws the Ward Flow header, so its buttons look ready before the page's code has
 * loaded, and a tap in that gap did nothing. The ward layout's inline script runs this listener
 * from the first byte: it remembers the last header button pressed while the header is not yet
 * ready. When the header is ready it calls `replayEarlyHeaderTap`, which presses that button once.
 *
 * A tap is remembered only while React has not yet attached to the page (no `__reactContainer$`
 * key on the document): React never sees such a tap, so pressing it later can never double it.
 * Once React is attached it holds and replays early taps itself.
 */
export const WARD_HEADER_READY_ATTRIBUTE = "data-wf-bar-ready";

const HEADER_BUTTON = '[data-testid="ward-bar"] button[data-testid]';
/** An older tap than this is stale: the reader has moved on. */
const EARLY_TAP_MAX_AGE_MS = 8_000;

export const WARD_EARLY_TAP_SCRIPT = `(function(){var d=document.documentElement;document.addEventListener("click",function(e){if(d.hasAttribute("${WARD_HEADER_READY_ATTRIBUTE}"))return;for(var k in document){if(k.indexOf("__reactContainer$")===0)return;}var t=e.target;var b=t&&t.closest?t.closest('${HEADER_BUTTON}'):null;if(b)window.__wfEarlyTap={id:b.getAttribute("data-testid"),at:Date.now()};},true);})();`;

type EarlyTap = { id: string; at: number };

export function replayEarlyHeaderTap(): void {
  document.documentElement.setAttribute(WARD_HEADER_READY_ATTRIBUTE, "");
  const holder = window as Window & { __wfEarlyTap?: EarlyTap };
  const tap = holder.__wfEarlyTap;
  holder.__wfEarlyTap = undefined;
  if (!tap || Date.now() - tap.at > EARLY_TAP_MAX_AGE_MS) return;
  const button = document.querySelector(`[data-testid="ward-bar"] button[data-testid="${CSS.escape(tap.id)}"]`);
  if (button instanceof HTMLButtonElement && !button.disabled) {
    button.click();
  }
}
