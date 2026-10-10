/**
 * **WHICH ROLE'S CHROME A ROUTE GETS — derived from the path, because nobody is logged in.**
 *
 * 🔴 **WARD FLOW HAS NO SIGNED-IN ROLE, AND DESIGNING AS THOUGH IT DID WOULD HAVE BEEN THE WRONG
 * SHAPE.** `ward-role-switcher.tsx` is a set of `<Link>`s to role homes, not a control that sets an
 * identity — **the role IS the route you are on.** Its own doc comment records why, and
 * `tests/ward-role-switch-architecture.test.ts` pins the consequence: switching role navigates,
 * because FD-23 makes ward-scoped and coordinator-scoped views different *architectures* rather
 * than one view with a flag. Nothing converts one into the other.
 *
 * ⚠️ **So this reads the path and stores nothing.** A chrome that kept its own idea of "who I am"
 * would immediately be a second answer to a question the routing already answers, and the two would
 * drift the first time somebody deep-linked.
 *
 * ⚠️ **AND IT IS A CHROME HINT, NEVER A PERMISSION.** What a role may DO is enforced by the
 * reducer's `EVENT_ROLE` table, which records a `Rejection` for a disallowed event. This function
 * decides which figures are worth showing; it must never be the thing standing between somebody and
 * an action.
 */
export type WardChromeRole = "coordinator" | "ward" | "ed" | "officer" | "community" | "bed_manager" | "executive";

/** Where the ward-scoped routes live, so the mapping is not a guess about URL shapes. */
const WARD_SEGMENTS = ["/ward/", "/board/"];
const ED_SEGMENTS = ["/ed/"];
const OFFICER_SEGMENT = "/transport/officer";
/** The community index (`/community`) and its team detail (`/community/[teamId]`) and statistics
 *  section (`/statistics/community/[teamId]`) all share this substring. */
const COMMUNITY_SEGMENT = "/community";

export function wardChromeRole(pathname: string): WardChromeRole {
  /*
   * Order matters and the ED check is first for a reason: `/statistics/ed/[edId]` contains neither
   * ward segment, but a future `/ward/x/ed/y` would contain both. Checking the narrower thing first
   * makes the answer stable under a route shape nobody has added yet, rather than correct only for
   * the routes that exist today.
   *
   * 🔴 `community` is a REAL arm, not part of the coordinator default (defect fix): before this,
   * `/community` and `/community/[teamId]` fell through to "coordinator", which put the
   * coordinator-owned task inbox on a community screen and let `ward-bar.tsx` dispatch
   * ACK/COMPLETE under a borrowed "coordinator" identity. `bed_manager` and `executive` are members
   * of the union and the label/icon/order maps, but carry no pathname arm today because no route
   * renders either role yet — nothing may silently resolve them to "coordinator" when one lands.
   */
  if (ED_SEGMENTS.some((segment) => pathname.includes(segment))) return "ed";
  if (WARD_SEGMENTS.some((segment) => pathname.includes(segment))) return "ward";
  if (pathname.includes(COMMUNITY_SEGMENT)) return "community";
  if (pathname.endsWith(OFFICER_SEGMENT) || pathname.endsWith(`${OFFICER_SEGMENT}/`)) return "officer";
  return "coordinator";
}

export function noticeIsForWardChrome(
  notice: Notice,
  role: WardChromeRole,
  placeId: string | undefined,
  now: Instant,
): boolean {
  return notice.raisedAt <= now && notice.to.role === role && notice.to.placeId === placeId;
}

/**
 * WHETHER THE VIEWER ON THIS CHROME MAY MARK THIS NOTICE READ — item 48, Q2 (owner answer 48,
 * 2026-09-17). Reuses `noticeIsForWardChrome`'s own role/place match rather than re-deriving it, so
 * there is no third state where a notice is shown in Activity but unmarkable, or markable but
 * hidden from the same viewer — the same "visibility and authority answered by the same check"
 * discipline this file's own header comment already states for the role union above.
 *
 * ⚠️ **A UI HINT, NEVER THE GATE.** Exactly like `noticeIsForWardChrome` and
 * `wardTasksAreActionableForRole`, this decides whether a control is worth SHOWING; the reducer's
 * own addressee check in `case "MARK_NOTICE_READ"` (`ward-flow-reducer.ts`) is what actually
 * refuses a mismatched claim, and continues to do so even if a future caller renders this button
 * without asking first.
 */
export function noticeIsMarkableByChrome(
  notice: Notice,
  role: WardChromeRole,
  placeId: string | undefined,
  now: Instant,
): boolean {
  return notice.readAt === undefined && noticeIsForWardChrome(notice, role, placeId, now);
}

/** The global action inbox is coordinator-owned in EVENT_ROLE. Other route roles may read their
 * own Activity notices, but must not dispatch coordinator task actions under a borrowed identity. */
export function wardTasksAreActionableForRole(role: WardChromeRole): role is "coordinator" {
  return role === "coordinator";
}

/**
 * Whether this route's role is shown the 28 day readmission flag (`ward-readmission-flag.tsx`).
 * Coordinator only (Josh, 9 October 2026); every other role's screens hide it. Like the other
 * helpers here, a display rule read from the route, never a permission.
 */
export function canSeeReadmissionFlag(role: WardChromeRole): boolean {
  return role === "coordinator";
}

/**
 * What the chrome calls this role on screen, and where it says that role is standing.
 *
 * ⚠️ **"Bed coordinator" is the DEFAULT, and the default is the widest view.** A route this function
 * does not recognise gets the whole-network chrome rather than a narrowed one — narrowing on a guess
 * would hide figures from somebody the guess was wrong about, and a coordinator seeing a ward's
 * detail is a smaller failure than a ward being shown nothing.
 */
export const CHROME_ROLE_LABELS: Record<WardChromeRole, string> = {
  coordinator: "Bed coordinator",
  ward: "Nurse in charge",
  ed: "ED clinician",
  officer: "Transport officer",
  community: "Community clinician",
  bed_manager: "Bed manager",
  executive: "Executive",
};
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Notice } from "@/components/ward-management/ward-model";
