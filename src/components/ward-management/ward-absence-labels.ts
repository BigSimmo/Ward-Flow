/**
 * 🔴 **ONE PHRASE FOR AN ID THIS APPLICATION CANNOT RESOLVE, IN ONE PLACE — AND THE HEADING SAID
 * "ONE SENTENCE" UNTIL AN ADVERSARIAL READ CHECKED IT.**
 *
 * ⚠️ **It was false when written.** The Delays screen never imported this module and carried two
 * inline copies of its own complete sentence, and the Officer screen a third wording — on live,
 * routed screens, while this header claimed the estate had one. 🔴 **The claim was accepted on the
 * strength of this comment rather than a grep, which is the exact move the sweep's own commit
 * message says cannot be trusted.**
 *
 * ✅ **Fixed by sharing the PHRASE and leaving each screen its own grammar**, so no rendered
 * sentence changed: Delays says *"This movement names …"* in a detail panel, the Officer screen
 * names the accepted destination, Corridors names the corridor, and the Movements rows put the
 * bare phrase after "From". **One rule, one phrase, and the sentence belongs to the slot** —
 * rewording a clinical sentence to make a consistency claim true would have been the wrong
 * direction of fix.
 *
 * **Ward Lead ruled on 2026-09-11, and the ruling is about BLAME, not phrasing:**
 *
 * > *"No department matches 'ED-017'" tells a coordinator there is no such department. The truth is
 * > THIS MOVEMENT NAMES A DEPARTMENT WE CANNOT FIND. The first blames the network; the second
 * > blames the record. They call for different actions and only one is true.*
 *
 * **The ruling named five sites. Enumerated 2026-09-12 by walking the PATTERN — a stored foreign key
 * failing a lookup — rather than by searching for the sentence the ruling quoted, there were
 * TWELVE.** ⚠️ **A grep for the wording you already know can only confirm the sites you already
 * know; its silence is not absence.** **Ward Lead's own note on being shown the count: the stated
 * population was the width of what had been opened, written as though it described the estate.**
 *
 * 🔴 **AND THE FIX BY HALVES WAS WORSE THAN NO FIX.** Screens rebuilt after the ruling carried the
 * record-blaming wording; screens that predated it kept the network-blaming one. **The Movements
 * screen ended up describing one absence two opposite ways, and a coordinator reading both had no
 * way to know which was true.** **This module exists so that cannot happen again by drift.**
 *
 * ---
 *
 * ⚠️ **THIS IS NOT FOR A ROUTE THAT DOES NOT EXIST, AND THE DIFFERENCE IS NOT A TECHNICALITY.**
 *
 * When the id came from the ADDRESS BAR — `/ward/[unitId]`, `/ed/[edId]`, a team hub — *"No
 * synthetic unit matches this id"* is **TRUE and is the right thing to say**: the person followed a
 * link or typed an address, nothing in the data is wrong, and telling them their record is broken
 * would send them to fix something that is fine. 🔴 **Those pages keep their own wording and are
 * deliberately NOT routed through here.** **Reported to Ward Lead as a finding rather than skipped
 * quietly, because a site that looks like an exception and is actually a different case will be
 * "fixed" by the next person who sweeps.**
 *
 * **The test for which one you are in: did a PERSON supply this id, or did a RECORD?**
 *
 * ---
 *
 * ⚠️ **THE ID STAYS VISIBLE IN EVERY CASE.** A coordinator who meets a dangling reference and cannot
 * say WHICH one has nothing to report, and a sentence that named the fault correctly while dropping
 * the id would satisfy every assertion about blame and still be useless.
 *
 * ⚠️ **`undefined` IS THE ONLY UNRESOLVED VALUE THESE ACCEPT.** They are written against a lookup
 * that returns `undefined` when it fails. **An empty-string name would pass straight through `??`
 * and render a blank**, which is the one outcome worse than either sentence — it says nothing at
 * all. Callers pass `found?.name`, never `found?.name ?? ""`.
 */

/** A department (an ED) named by a record that this application cannot resolve. */
export function departmentLabel(originEdId: string, name: string | undefined): string {
  return name ?? `a department we cannot find: "${originEdId}"`;
}

/** A ward or unit named by a record that this application cannot resolve. */
export function wardLabel(unitId: string, name: string | undefined): string {
  return name ?? `a ward we cannot find: "${unitId}"`;
}

/** A hospital site named by a record — a unit's own `siteCode` — that this application cannot resolve. */
export function siteLabel(siteCode: string, name: string | undefined): string {
  return name ?? `a site we cannot find: "${siteCode}"`;
}
