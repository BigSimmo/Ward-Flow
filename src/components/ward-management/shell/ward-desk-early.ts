/**
 * H-0111 (Josh, 27 Oct 2026): no page outside a desk's role shows for an instant on first load.
 *
 * The desk is kept in this tab's session storage (`ward-access-store.ts`), which the server cannot
 * read, so the server and the browser's first pass draw every page for the statewide coordinator.
 * A fresh device and the coordinator's own desk are drawn correctly that way, and keep the server's
 * page straight away. Only when another desk is stored does this script, which runs before the page
 * is drawn, mark the document, and the ward layout hides the page area (not the header or rail)
 * until `WardDeskPendingClear` clears the mark once the app has drawn that desk's page. A first load
 * is never held for anyone else, and pages opened inside the app are never held.
 *
 * Desk walk follow-up (9 Nov 2026): hiding is not enough, because the coordinator's figures were
 * still in the server's page and showed while the page's own part caught up. So a stored desk other
 * than the coordinator's also sets `WARD_DESK_HELD_COOKIE`, a bare "1" with no role or place in it.
 * When the server sees it, the ward layout sends a neutral loading page in place of the page
 * (`WardDeskHold`), and the browser draws the desk's own page once it knows the desk.
 *
 * Count leak (item 1, Josh, 10 Nov 2026, D-137): a fresh device sent no cookie, so the server still
 * drew the coordinator's figures into the first page. The server now holds the page whenever it
 * cannot be sure of the desk: only the bare "0", set when this browser's desk is the whole-network
 * coordinator's, lets the server's page stand. A fresh device sees the short loading page first, a
 * change to H-0111. A fresh tab leaves the cookie as it is, so the safe side wins.
 *
 * Reads only the role and place kind, never shown or sent. A blocked storage read changes nothing.
 * The key must match `WARD_ACCESS_STORAGE_KEY` in `ward-access-store.ts`.
 */
export const WARD_DESK_PENDING_ATTRIBUTE = "data-wf-desk-pending";

/**
 * This browser's desk, as the server may know it: "1" for any desk other than the whole-network
 * coordinator's, "0" for the coordinator's. It never carries a role or place.
 */
export const WARD_DESK_HELD_COOKIE = "wardflow-desk-held";

/** The one value that lets the server draw the coordinator's page (D-137). */
const WARD_DESK_WHOLE_NETWORK_VALUE = "0";

const HELD_COOKIE = `${WARD_DESK_HELD_COOKIE}=1;path=/ward-flow;SameSite=Strict`;
const CLEARED_COOKIE = `${WARD_DESK_HELD_COOKIE}=${WARD_DESK_WHOLE_NETWORK_VALUE};path=/ward-flow;SameSite=Strict`;

/** D-137: the server holds the page unless the request says the desk is the coordinator's. */
export function wardDeskHeldFromCookie(value: string | undefined): boolean {
  return value !== WARD_DESK_WHOLE_NETWORK_VALUE;
}

export const WARD_DESK_EARLY_SCRIPT = `(function(){try{var d=JSON.parse(sessionStorage.getItem("wardflow:access-desk-v1")||"null");if(d&&typeof d==="object"){if(d.role==="coordinator"&&d.scope&&d.scope.kind==="statewide"){document.cookie="${CLEARED_COOKIE}";}else{document.documentElement.setAttribute("${WARD_DESK_PENDING_ATTRIBUTE}","");document.cookie="${HELD_COOKIE}";}}}catch(e){/* storage blocked - the cookie stays as it was */}})();`;

/** Keeps the cookie in step with the desk this tab has just stored (`ward-access-store.ts`). */
export function syncWardDeskHeldCookie(wholeNetwork: boolean): void {
  try {
    document.cookie = wholeNetwork ? CLEARED_COOKIE : HELD_COOKIE;
  } catch {
    // Cookies blocked: the first-load hide above still applies.
  }
}
