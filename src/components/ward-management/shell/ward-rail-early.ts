/**
 * The rail's shape before the app is ready (13 Oct 2026: the sidebar settled on load).
 *
 * The server cannot read the stored rail preference or the window width, so it always draws the
 * open sidebar. Above 1000px the browser then folded it to the icon rail after hydration when the
 * reader had closed it, or at tablet landscape (1001 to 1200px) where it is always the icon rail,
 * and the whole page slid sideways. The ward layout runs this script straight after the rail's
 * markup, before the first paint, so the rail already carries the `data-rail` and `data-tablet`
 * values the app will give it. At 1000px and below the rail is hidden or drawn by width alone,
 * so the script does nothing there and phone is unchanged.
 *
 * The script also records what it drew in `window.__wfRailEarly`. `WardRail` hydrates with those
 * two attributes (`readWardRailEarlyShape`), so React adopts the page as it is rather than
 * reporting a mismatch, and its next render settles on the live values.
 *
 * The only reader of the stored value besides `ward-rail.tsx`, which owns its writes. A blocked
 * storage read leaves the server's open rail, which is the stored default.
 */
export const RAIL_OPEN_STORAGE_KEY = "ward-flow-rail";

const EARLY_SHAPE_GLOBAL = "__wfRailEarly";

/** What the early script set on the rail. Absent when it left the server's open rail alone. */
export type WardRailEarlyShape = { rail: "closed"; tablet: "landscape" | null };

export const WARD_RAIL_EARLY_SCRIPT = `(function(){var w=window;if(typeof w.matchMedia!=="function"||!w.matchMedia("(min-width: 1001px)").matches)return;var tablet=w.matchMedia("(max-width: 1200px)").matches,closed=false;try{closed=localStorage.getItem("${RAIL_OPEN_STORAGE_KEY}")==="closed";}catch(e){/* storage blocked - the stored default, open, applies */}if(closed)document.documentElement.setAttribute("data-rail","closed");var r=document.querySelector('[data-testid="ward-rail"]');if(!r||!(tablet||closed))return;if(tablet)r.setAttribute("data-tablet","landscape");r.setAttribute("data-rail","closed");w.${EARLY_SHAPE_GLOBAL}={rail:"closed",tablet:tablet?"landscape":null};})();`;

/** The shape the early script drew, or null on the server and when it changed nothing. */
export function readWardRailEarlyShape(): WardRailEarlyShape | null {
  if (typeof window === "undefined") return null;
  const shape = (window as unknown as Record<string, unknown>)[EARLY_SHAPE_GLOBAL];
  return shape && typeof shape === "object" ? (shape as WardRailEarlyShape) : null;
}
