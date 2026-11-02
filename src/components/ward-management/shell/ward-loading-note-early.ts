/**
 * Q274 (pre-launch review E2, 2 Nov 2026): if the page's code never arrives (patchy Wi-Fi, or a
 * release swapping files mid-load), the "Loading, not live yet" note stayed forever and nothing
 * worked. The error panel and the offline page cannot help, because both need that code.
 *
 * This inline script runs from the first byte. After `WARD_LOADING_SLOW_MS` it marks the document
 * `data-wf-load-slow` if the header is still not ready, and the note's CSS swaps to "Still loading.
 * Check the connection." with a Reload button (ward-flow-layout.module.css); this script also
 * handles that button's click, since the page's own code is what is missing. It only sets an
 * attribute on <html> and listens on the document, so it never edits a node React will hydrate.
 */
export const WARD_LOADING_SLOW_MS = 15_000;
export const WARD_LOADING_SLOW_ATTRIBUTE = "data-wf-load-slow";
/** The note's Reload button (app/ward-flow/layout.tsx); a click anywhere on it reloads the page. */
export const WARD_LOADING_RELOAD_ATTRIBUTE = "data-wf-loading-reload";

export const WARD_LOADING_NOTE_EARLY_SCRIPT = `(function(){var d=document.documentElement;document.addEventListener("click",function(e){var t=e.target;if(t&&t.closest&&t.closest("[${WARD_LOADING_RELOAD_ATTRIBUTE}]"))location.reload();});setTimeout(function(){if(d.hasAttribute("data-wf-bar-ready"))return;d.setAttribute("${WARD_LOADING_SLOW_ATTRIBUTE}","");},${WARD_LOADING_SLOW_MS});})();`;
