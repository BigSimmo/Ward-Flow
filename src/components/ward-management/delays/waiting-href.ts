/**
 * B4: the Waiting list's saved views and the link that opens one. Kept apart from
 * `waiting-views.ts` so the screens that only link in (Home, Movements, Handover, Patients) do not
 * load the board's rules.
 */
export const WAITING_VIEWS = ["needs-me", "form", "handover"] as const;
export type WaitingViewId = (typeof WAITING_VIEWS)[number];

/** The board's page, renamed from Delays in B4 step 3. Links go through `waitingHref`. */
const WAITING_PATH = "/ward-flow/waiting";

/** A link that opens the board on one saved view, or on everyone when no view is named. */
export function waitingHref(view?: WaitingViewId): string {
  return view === undefined ? WAITING_PATH : `${WAITING_PATH}?view=${view}`;
}
