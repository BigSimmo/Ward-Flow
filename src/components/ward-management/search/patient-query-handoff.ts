/**
 * PATIENT QUERY HANDOFF — an in-memory, read-once channel that carries a typed name or record
 * number from the patient search screens to the add-patient form, without ever putting it in the
 * browser's address bar.
 *
 * WHY THIS EXISTS
 * ----------------
 * `patient-typeahead.tsx`'s "Add this person" link and `patient-search.tsx`'s "Add patient" links
 * used to carry the box's typed text as a `?name=` or `?search=` query parameter on the link to
 * `/mockups/ward-flow/people/new`. The search box accepts a name OR a record number, so both kinds
 * of identifying text ended up in the URL — written into browser history and logged by every proxy
 * between the browser and the server, on what this repository documents as routinely a SHARED ward
 * computer.
 *
 * Ward Lead's ruling D-11 (`docs/ward-flow/owner-decisions-2026-09-1x.md` ~685-697) — one of five
 * (D-11 to D-15) explicitly made under a delegation, never the owner's own words, and the file's
 * own banner says a later reader must not quote any of them back as "the owner decided". D-11
 * itself answers a different question — whether a half-written REFERRAL-HISTORY draft should be
 * held so it survives a navigation — and settles it "warn before leaving. Do NOT persist the
 * text," because holding clinical free text in browser STORAGE on a shared ward machine converts
 * a lost-work annoyance into a disclosure. This module extends that same standing default to a
 * typed SEARCH query: `sessionStorage` is still storage the same reasoning forbids, and a URL is
 * worse again because it is written to history and to logs this application does not control.
 * `src/lib/caring-contacts/workspace-address.ts` documents the same fact for a sibling product
 * (ruling [111]: "a query
 * string is logged by every proxy between here and the browser. Nothing about a patient may travel
 * here.") — that module's fix was an allowlist because its overlay state legitimately belongs in a
 * shareable address; a person's typed name never does, on either product, so the fix here is to
 * keep the text out of the address entirely rather than to allowlist it.
 *
 * So the typed text never leaves memory. A module-level variable is a singleton for the lifetime of
 * one browser tab's JS runtime: a Next.js client-side navigation (a `next/link` click) does not
 * re-evaluate this module, so the value written on click is still here when the destination screen
 * reads it — but a full page reload, a new tab, or a bookmark starts this module fresh with nothing
 * pending, which is exactly the surface this channel is meant to have.
 *
 * READ-ONCE, DELIBERATELY. `takeHandedOffPatientQuery` clears the slot it reads. A value left
 * behind after the add-patient form has already consumed it would silently reapply itself the next
 * time somebody reaches that form by some other route (the back button, a second link click) —
 * `AddPatientForm` calls this exactly once, in its initial-state initialiser, so it never observes
 * a value written after it has already mounted.
 */

export type PatientQueryAssignment =
  /** From `patient-typeahead.tsx`'s "Add this person": the typed text is known to be a name search,
   *  so it lands directly in the Given name field. */
  | "given-name"
  /** From `patient-search.tsx`'s "Add patient" links: the search box accepts a name OR a record
   *  number, so the text arrives unassigned and the add-patient screen asks the clinician which
   *  field it belongs in — same behaviour the old `?search=` carried. */
  | "carried";

export type PatientQueryHandoff = {
  readonly text: string;
  readonly assignTo: PatientQueryAssignment;
};

let pending: PatientQueryHandoff | undefined;

/**
 * Records the typed text for the next `AddPatientForm` mount to consume. Call this from a link's
 * `onClick`, never from an `href` — the point is that the text travels through memory, not through
 * anything the browser writes down. An empty (or whitespace-only) `text` clears any pending value
 * instead of recording one, since there is nothing to carry.
 */
export function handOffTypedPatientQuery(text: string, assignTo: PatientQueryAssignment): void {
  const trimmed = text.trim();
  pending = trimmed === "" ? undefined : { text: trimmed, assignTo };
}

/**
 * Consumes and clears whatever is waiting. Returns `undefined` when nothing was handed off, which
 * is the ordinary case for any visit to `/people/new` that did not come from one of the two search
 * links above — the add-patient form must render its plain, empty state for that visit rather than
 * replaying a stale value.
 */
export function takeHandedOffPatientQuery(): PatientQueryHandoff | undefined {
  const value = pending;
  pending = undefined;
  return value;
}

/**
 * Whether a click event is the "open in a new tab/window" gesture — a modifier key held, or a
 * mouse button other than the primary one — rather than an ordinary same-tab navigation.
 *
 * ⚠️ **EVERY CALLER OF `handOffTypedPatientQuery` MUST CHECK THIS FIRST, AND CLEAR RATHER THAN
 * WRITE WHEN IT IS TRUE.** A modified click (ctrl-, cmd-, shift- or middle-click; any non-primary
 * `button`) still fires React's `onClick` in THIS tab, even though the browser opens the link in a
 * DIFFERENT one — so an unconditional write leaves this tab holding a value nobody here is about
 * to consume. Left in place, that value survives this tab's later, unrelated client-side
 * navigations (`pending` is a module-level singleton for the tab's whole JS runtime — see this
 * file's own doc comment) and can prefill a completely different visit to the add-patient form
 * with a typed name or record number from a search the clinician has since cleared or changed.
 * Clearing on a modified click, rather than merely skipping the write, is what closes that gap:
 * the slot must never carry a value this tab did not just navigate on.
 */
export function isNewTabClick(event: {
  readonly button: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}
