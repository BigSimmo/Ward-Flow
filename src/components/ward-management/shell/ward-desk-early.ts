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
 * (`WardDeskHold`), and the browser draws the desk's own page once it knows the desk. Only this tab
 * choosing the coordinator's desk clears it; a fresh tab leaves it, so the safe side wins.
 *
 * Reads only the role and place kind, never shown or sent. A blocked storage read changes nothing.
 * The key must match `WARD_ACCESS_STORAGE_KEY` in `ward-access-store.ts`.
 */
export const WARD_DESK_PENDING_ATTRIBUTE = "data-wf-desk-pending";

/** Set while this browser's desk is not the whole-network coordinator's. Its value is only ever "1". */
export const WARD_DESK_HELD_COOKIE = "wardflow-desk-held";

const HELD_COOKIE = `${WARD_DESK_HELD_COOKIE}=1;path=/ward-flow;SameSite=Strict`;
const CLEARED_COOKIE = `${WARD_DESK_HELD_COOKIE}=;path=/ward-flow;SameSite=Strict;max-age=0`;

/** Live audit item 19: every write of the desk cookie is Secure over https. */
export const WARD_DESK_EARLY_SCRIPT = `(function(){try{var d=JSON.parse(sessionStorage.getItem("wardflow:access-desk-v1")||"null"),s=location.protocol==="https:"?";Secure":"";if(d&&typeof d==="object"){if(d.role==="coordinator"&&d.scope&&d.scope.kind==="statewide"){document.cookie="${CLEARED_COOKIE}"+s;}else{document.documentElement.setAttribute("${WARD_DESK_PENDING_ATTRIBUTE}","");document.cookie="${HELD_COOKIE}"+s;}}}catch(e){/* storage blocked - the server's page stands */}})();`;

/**
 * Keeps the cookie in step with the desk this tab has just stored (`ward-access-store.ts`). Sign-out
 * passes `null`, which removes it, so nothing of the desk stays readable (live audit item 19).
 */
export function syncWardDeskHeldCookie(wholeNetwork: boolean | null): void {
  try {
    document.cookie =
      (wholeNetwork === false ? HELD_COOKIE : CLEARED_COOKIE) + (location.protocol === "https:" ? ";Secure" : "");
  } catch {
    // Cookies blocked: the first-load hide above still applies.
  }
}
