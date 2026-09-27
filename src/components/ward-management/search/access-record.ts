/**
 * THE ACCESS RECORD — WHAT WAS SEARCHED AND WHEN, HELD ONLY FOR THIS SESSION.
 *
 * `docs/ward-flow/plans/2026-09-1x-lane-c-drawing-facts.md` §E and
 * `docs/ward-flow/owner-decisions-2026-09-1x.md` D-4 (Ward Lead, 2026-09-11): the Access record
 * panel's drawing carries a header note that claims, unqualified, that every search is kept.
 * Nothing under `src/` writes a search anywhere durable — the panel's true design is session-only,
 * held in component state and nowhere else — so that claim would be a false assurance about access
 * to a patient's record: a clinician reading it would believe their lookups are logged, and a
 * patient would believe opening their record leaves a trace. Neither is true.
 *
 * This module is that true design. `recordSearch` is a pure function over an array — the caller
 * holds the array in `useState` and nowhere else; this module never touches storage of any kind.
 * `tests/ward-search-access-record.test.ts`'s "touches no storage at all" case is the point of the
 * module, not a formality: read that test's own comment before changing this file.
 *
 * ⚠️ NO PERSISTENCE OF ANY KIND. Never add `localStorage`, `sessionStorage`, IndexedDB, a cookie or
 * a fetch here or at any call site that uses it. A durable record of who looked at whom is a
 * privacy surface nobody has authorised.
 */
/**
 * 🔴 THERE IS NO `role` FIELD, AND ITS ABSENCE IS A RULING RATHER THAN AN OVERSIGHT.
 *
 * The panel carried one until 2026-09-11. Its value came from a source-level constant, because
 * **Ward Flow has no signed-in user** — `ward-chrome-role.ts` says so in terms: *"the role IS the
 * route you are on"*, and it is *"a chrome hint, never a permission"*. On `/search`, which carries
 * neither a ward nor an ED segment, that derivation can only ever return one value. **So the column
 * printed the same word on every row, for every person, forever.**
 *
 * A panel headed *"who looked"* was answering *who* with a constant that names nobody, and `D-2`
 * forbids the fix that would have made it true — no notion of a user, an account or a
 * person-who-logs-in is created.
 *
 * ⚠️ **REMOVED RATHER THAN RELABELLED** (Ward Lead, D-4 addendum). Calling it *the view* would have
 * put the same constant on screen wearing a different word: a column whose value is fixed in source
 * carries no information on any row, whatever it is called.
 *
 * **It returns when the system can actually distinguish who ran a search, and not before.** Until
 * then the panel says what it can — what was searched, and when — and that is a true and useful
 * thing for a coordinator to see. Nothing here is apologising for it.
 */
export type AccessEntry = { words: string; at: number };

/**
 * Adds one entry to the front of the list — newest first, so the most recent search is always the
 * first row a reader sees. Returns a NEW array; `list` is never mutated, and nothing here reads or
 * writes any storage.
 */
export function recordSearch(list: readonly AccessEntry[], entry: AccessEntry): AccessEntry[] {
  return [entry, ...list];
}

/**
 * THE RULED HEADER NOTE — `D-4`, Ward Lead, 2026-09-11. Always visible in the panel header, in
 * every state, true whether or not the panel currently holds rows.
 *
 * The drawing's own header note (`patient-search-third-edition.html`) claims, unqualified, that
 * every search is recorded — false, since this module writes nothing anywhere durable. This
 * sentence carries the two facts the drawing's own EMPTY state already states correctly — kept for
 * this session only, and never sent anywhere — so the panel no longer makes its strongest claim
 * exactly when it starts holding data.
 *
 * ⚠️ **IT SAYS _"what was searched"_, NOT _"who looked"_ — D-4 addendum, 2026-09-11.** The first
 * ruling fixed the DURABILITY half of the claim and left the ATTRIBUTION half standing. There is no
 * *who* in this system to report (see `AccessEntry` above), so the word came out. **The panel now
 * claims exactly the two things it can deliver.**
 *
 * 🔴 `D-4` is Ward Lead's ruling, not the owner's, and is recorded as his to overturn. The owner was
 * asked directly whether this wording is acceptable to him as the clinician and has not answered.
 */
export const ACCESS_RECORD_NOTE = "What was searched, and when. Kept for this session only, and none is sent anywhere.";
