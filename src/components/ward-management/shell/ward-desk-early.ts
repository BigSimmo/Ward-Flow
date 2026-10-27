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
 * Reads only the role and place kind, never shown or sent. A blocked storage read changes nothing.
 * The key must match `WARD_ACCESS_STORAGE_KEY` in `ward-access-store.ts`.
 */
export const WARD_DESK_PENDING_ATTRIBUTE = "data-wf-desk-pending";

export const WARD_DESK_EARLY_SCRIPT = `(function(){try{var d=JSON.parse(sessionStorage.getItem("wardflow:access-desk-v1")||"null");if(d&&typeof d==="object"&&!(d.role==="coordinator"&&d.scope&&d.scope.kind==="statewide"))document.documentElement.setAttribute("${WARD_DESK_PENDING_ATTRIBUTE}","");}catch(e){/* storage blocked - the server's page stands */}})();`;
