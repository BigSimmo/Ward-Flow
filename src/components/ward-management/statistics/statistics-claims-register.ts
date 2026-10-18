/**
 * THE CLAIMS REGISTER — the statements the statistics and community screens make about the data
 * model, each either paired with the line of real source that makes it true, or listed in
 * `UNEVIDENCED_CLAIMS` with the reason no line can be cited for it.
 *
 * ⚠️ **IT IS A SWEEP OF `REGISTERED_SURFACES`, NOT A GUARANTEE THAT NOTHING ON THEM IS UNRECORDED,
 * AND THE OPENING LINE CLAIMED OTHERWISE UNTIL 2026-09-01.** It read "EVERY statement … paired with
 * the line of real source that makes it true" — an unearned absolute in the strongest position in
 * the file, in the file whose entire subject is that an overstated guarantee is worse than an
 * absent one. Two things falsify it at once: `UNEVIDENCED_CLAIMS` below is a list of statements
 * these screens make that are deliberately NOT paired with any line, and a statement inside a
 * registered surface can be carried by neither list — a false sentence on
 * `statistics-overview-screen.tsx`, a file named in `REGISTERED_SURFACES`, was found in exactly
 * that state on the same day. Exclusion class 6 below already said so; the title line now agrees
 * with the body instead of overstating it.
 *
 * ⚠️ **WHY THIS EXISTS.** On 2026-09-01 seven statements these screens make about the model were
 * found FALSE. Every one passed the entire test suite. Every one was found by a human reading, or
 * by somebody asking a question — not one by a gate. `ReferralAddressing` was said to "carry no
 * unit at all" while carrying `acceptedUnitId`; "nothing marks the moment preparation started" was
 * written while `SET_BED_PREPARATION` stamps `confirmedAt`; `Admission` was said to keep five
 * instants when it keeps seven; follow-up was said to have "no field for it" while
 * `Admission.followUp` exists and is seeded. The arithmetic on these pages has been right all day.
 * The explanations have not.
 *
 * That matters more here than it would anywhere else. These pages refuse to show figures they
 * cannot support and explain why. A reader has no way to check the explanation and every reason to
 * trust it, so **a false explanation is worse than a missing figure.**
 *
 * ⚠️ **THE MECHANISM.** Each claim is paired with an exact substring of a REAL source file, read
 * from disk at test time by `tests/ward-statistics-claims.test.ts`. The substring must appear in
 * that named file **exactly once**. A claim whose evidence has moved, been renamed, been deleted or
 * become ambiguous goes red NAMING THE CLAIM, not the string.
 *
 * The evidence is never a copy pasted in here for safekeeping. A copy cannot go stale, which is
 * precisely what would defeat the whole mechanism: the register is a set of POINTERS, and a pointer
 * into a file that has moved on is exactly the failure worth catching.
 *
 * ⚠️ **WHITESPACE IS THE ONLY THING NORMALISED.** Every run of whitespace — in the file and in the
 * citation — collapses to a single space before matching, so that Prettier re-wrapping a JSX
 * paragraph or a doc comment is not a false red. Nothing else is normalised: no case folding, no
 * punctuation stripping, no near-matching. A renamed field, a changed type, a deleted line and a
 * second copy of the same declaration all still fail.
 *
 * ⚠️ **THE CLAIM IS NOT RESTATED HERE — THE REGISTER CITES THE SCREEN.** Of the two ways round,
 * this module could hold the page's sentences and have the screens render from it, or it could
 * point at where each sentence already lives. It points. The reason is that the sentences are JSX
 * with `<code>` and `<strong>` inside them, entity escapes, and in two cases a conditional branch;
 * pulling them in here would either flatten them into strings the DOM tests could no longer pin, or
 * make this a component module instead of a readable list. So `claim` below is a one-line summary
 * IN THE REGISTER'S OWN WORDS — deliberately not the rendered sentence — and `rendered` is a short
 * locator copied from the screen file, which the test asserts appears there exactly once too. The
 * locator is a fragment of the screen rather than a second copy of the claim, and being pinned
 * exactly-once it cannot drift out of agreement silently either. Both ends are checked: the screen
 * still says it, and the source still supports it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS MECHANISM CANNOT CATCH. Be specific here rather than apologetic — a guard that
 * overstates its own reach is the same defect one level up, and this project shipped exactly that
 * defect today.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 *  1. **A claim that was wrong the day it was written, and cited correspondingly wrongly.** If
 *     somebody writes "`ReferralAddressing` carries no unit" and cites the `Movement` type body as
 *     evidence, both halves agree with each other and the test is green. The register checks that
 *     evidence still says what it said; it cannot check that the claim FOLLOWS from the evidence.
 *     That inference is a reading, and only a reader does it. **The register makes a claim decay
 *     loudly. It does not make a claim true.**
 *
 *  2. **Any claim of ABSENCE.** A substring can only witness something that exists. "Nothing in the
 *     reducer stops a caller flagging a discharge that has not happened yet", "there is no role
 *     check on this route", "no instant on `Admission` marks entry to `waitlisted`" — none of these
 *     has a line to cite, because the fact is that no line is there. Adding the very field a claim
 *     denies exists therefore breaks nothing here. Those claims are listed in
 *     `UNEVIDENCED_CLAIMS` below with the reason, so the gap is countable rather than invisible;
 *     several of them are guarded by other tests, named there.
 *
 *  3. **Claims about the SEED FIXTURE — and this register no longer carries any.** A fixture is not
 *     a contract: the citation would have to be a data file, the count changes with the data, and
 *     `statistics-derivations.ts` records that this exact class of sentence has falsified itself
 *     silently four times on one paragraph. Listing such a claim in `UNEVIDENCED_CLAIMS` makes the
 *     risk countable but leaves it live on the page, so on 2026-09-01 the owner took the other
 *     route: the two that were here — one on the ED screen about how many seeded referrals carry a
 *     `triagedAt`, one on the community index about how many pages the dynamic route serves — were
 *     **removed from the prose instead of recorded as gaps**, and their entries deleted with them.
 *     The rule the pages now follow: describe what the derivation can and cannot establish, never
 *     what the seed happens to contain, and where a quantity is genuinely needed RENDER it from
 *     live state rather than typing it. A count that is rendered is fine; a count that is typed is
 *     the defect. Anything of this shape arriving here in future belongs in that rewrite, not in
 *     `UNEVIDENCED_CLAIMS`.
 *
 *  4. **Whether the claim is still ON THE PAGE.** `rendered` pins that the locator exists in the
 *     screen file — not that the sentence around it still says what `claim` summarises. Deleting a
 *     whole paragraph, locator and all, goes red. Rewriting the sentence around a surviving
 *     `data-testid` does not.
 *
 *  5. **A CITATION THAT CANNOT FAIL — this WAS the largest gap, and since 2026-09-01 it is closed
 *     by a mechanism rather than by care.** Every check here used to ask only whether the cited
 *     bytes are still present. It never asked the question that matters: **would the claim's
 *     falsity change those bytes?** An audit put all the entries below to exactly that test and
 *     TWELVE failed it — including one where THIS FILE asserted in prose that a citation was
 *     "cited whole" when it covered neither end of the body it named. Unguarded while appearing
 *     guarded is worse than unguarded, because the coverage number counts it.
 *
 *     ⚠️ **THE FIX: EVERY CLAIM SHIPS WITH ITS OWN FALSIFYING EDIT, AND THE TEST APPLIES IT.**
 *     `falsifiedBy` records a change to `sourceFile` that would make the claim FALSE.
 *     `tests/ward-statistics-claims.test.ts` applies it IN MEMORY and asserts the evidence
 *     substring is then ABSENT. Nothing is written to disk, no suite runs, no build happens — the
 *     existing check was already a substring test over file contents, so this is one string
 *     replacement and a second `includes()`, and doing it for every claim costs microseconds. That
 *     is why it is worth doing here and would not be worth doing against a real test suite.
 *
 *     What it buys is that **an unfalsifiable claim becomes impossible to register.** For a comment
 *     citation, a slice cited for an "only", or a type declaration cited for a computation, there
 *     is no edit that removes the cited bytes AND makes the claim false — and the author finds that
 *     out at registration rather than four months later.
 *
 *     ⚠️ **A CITATION CAN BE PRESENT, UNIQUE, AND RIGHT BY ACCIDENT.** The property being guarded
 *     is not "it gives the right answer today" — it is "it would stop giving the right answer if
 *     the claim stopped being true". Those come apart. A comment citation can be perfectly correct
 *     right now and the guard will still reject it, and that is the guard working, not the guard
 *     being pedantic: the comment's presence is unconnected to the fact it is standing in for, so
 *     it will go on being green after the fact changes and go red if somebody merely tidies it.
 *     The same defect exists outside this feature — `tests/route-reachability.test.ts` has been
 *     satisfied by a module's own note describing a link, with the real link mutated away.
 *
 *     ⚠️ **THE RESIDUAL, STATED RATHER THAN HIDDEN.** An author can record a WEAK falsifying edit:
 *     one that removes the cited bytes for a reason unrelated to the claim (retype a field to
 *     `never`, delete the line, rename it). Nothing closes that mechanically. It is much narrower
 *     than what it replaces, because it now takes deliberately writing a misleading edit rather
 *     than merely picking a convenient string — and `falsifiedBy.change` is where the author says
 *     in words what change to the world the edit stands for, so a reader can judge it. Where an
 *     edit only falsifies PART of a claim (the positive half of an "only", say), `change` says so.
 *
 *     ⚠️ **The reversal worth recording, because it inverts the obvious heuristic.** The citations
 *     that quote an ENTIRE TYPE BODY look loose and are the STRONGEST in the register:
 *     `COMMUNITY_TEAM_BODY` breaks if a field is added, removed or reordered, which is every change
 *     that would make its "and nothing else" false. Being large is not being loose — that one is
 *     large BECAUSE it pins an absence. The defect was in the short, tidy, specific-looking
 *     citation. Length was never the property that mattered; falsifiability was.
 *
 *     ⚠️ **AND THE PROSE ABOUT A CITATION IS NOT THE CITATION.** `WARD_DESTINATION_ARM` carried a
 *     doc comment saying the arm was "cited whole… only the whole arm can witness the never" while
 *     the string started at `sex:` and stopped at `secureBedNeeded:` — omitting `kind` and
 *     `involuntaryBedNeeded` and touching neither end. Nothing could have caught that except a
 *     reader or the falsifying-edit test, and the falsifying-edit test now does.
 *
 *  6. **Prose anywhere else.** This register covers the files listed in `REGISTERED_SURFACES`. A
 *     new statistics screen is not swept until somebody adds it, and nothing here notices that
 *     nobody did. The one thing that partly covers this: the test asserts every registered surface
 *     file exists, so a screen that is renamed or deleted fails rather than quietly dropping out.
 */

import { OTHER_SURFACE_CLAIMS } from "./statistics-claims-other-surfaces";
import {
  COMPARE_SCREEN,
  ED_SCREEN,
  type ModelClaim,
  STATISTICS_SCREEN,
  WARD_STATS_SCREEN,
} from "./statistics-claims-shared";
import { STATISTICS_SCREEN_CLAIMS } from "./statistics-claims-statistics-screen";

export type { ModelClaim } from "./statistics-claims-shared";

/** The surfaces this register claims to have swept. Repository-relative paths. */
export const REGISTERED_SURFACES: readonly string[] = [
  "src/components/ward-management/statistics/statistics-screen.tsx",
  "src/components/ward-management/statistics/statistics-compare-screen.tsx",
  "src/components/ward-management/statistics/statistics-ward-screen.tsx",
  "src/components/ward-management/statistics/statistics-ed-screen.tsx",
  "src/components/ward-management/statistics/statistics-section-frame.tsx",
  "src/components/ward-management/statistics/statistics-disclaimers.tsx",
  "src/components/ward-management/statistics/statistics-derivations.ts",
  "src/components/ward-management/community/community-index.tsx",
];

/**
 * Every pinned claim. The entries live in `statistics-claims-statistics-screen.ts` (for
 * `statistics-screen.tsx`) and `statistics-claims-other-surfaces.ts` (every other surface), in that order.
 */
export const MODEL_CLAIMS: readonly ModelClaim[] = [...STATISTICS_SCREEN_CLAIMS, ...OTHER_SURFACE_CLAIMS];

/**
 * A claim these surfaces make that this mechanism CANNOT pin, and why.
 *
 * ⚠️ **This list is the honest half of the register and is not decoration.** A guard that quietly
 * omits what it cannot see reads as complete coverage, which is the same defect the register exists
 * to close, moved one level up. Every entry here is a real sentence on a real page that a reader
 * will believe and that nothing here re-checks.
 */
export type UnevidencedClaim = {
  id: string;
  renderedIn: string;
  claim: string;
  /** Why no substring can witness it, and what guards it instead if anything does. */
  reason: string;
};

export const UNEVIDENCED_CLAIMS: readonly UnevidencedClaim[] = [
  {
    id: "statistics-disclaimers/access/there-is-no-role-check-on-this-route",
    renderedIn: "src/components/ward-management/statistics/statistics-disclaimers.tsx",
    claim: "No route-level role gate exists anywhere in these mockups.",
    reason:
      "An absence. The claim is that no file contains a gate, and a substring can only witness a line that " +
      "exists. Pinning it would need a scan of every route file for an auth wrapper, which is a different " +
      "mechanism from this one and is not built.",
  },
  {
    id: "statistics-disclaimers/synthetic/every-instant-is-invented",
    renderedIn: "src/components/ward-management/statistics/statistics-disclaimers.tsx",
    claim: "Every patient, bed, referral and instant this prototype holds is invented.",
    reason:
      "A provenance claim about the whole fixture, not a claim about the model. No line of source states it, " +
      "and a line that did would be prose citing prose.",
  },
  {
    id: "statistics-screen/bed-readiness/nothing-in-the-model-enforces-it",
    renderedIn: STATISTICS_SCREEN,
    claim: "Nothing in the reducer stops a caller flagging a bed nobody has left yet as being prepared.",
    reason:
      "An absence — the claim is that SET_BED_PREPARATION has no state guard. The two guards it DOES have are " +
      "pinned above, and so is the fact that it stores the caller's value unchanged, but a guard that is not " +
      "there has no line to cite. Adding a state guard tomorrow would falsify the page and break nothing here.",
  },
  {
    /**
     * ⚠️ **THE ENTRY THAT DECIDES A HEADING, AND THE ONLY THING THAT WILL TELL WHOEVER FILLS THIS
     * ABSENCE.** The figure is headed "Referrals where every ward asked SO FAR has refused". The
     * qualifier is not caution — it is the exact reach of the data, and it is true only because of
     * something the model LACKS. Fill the absence and the heading becomes wrong in the safe-sounding
     * direction: it would go on saying "so far" about a figure that had become the stronger claim,
     * or worse, somebody would notice the number had changed and not know why.
     *
     * A closure or exhaustion marker is a reasonable thing to add. Whoever adds it will be doing
     * good work in the reducer and will have no reason on earth to open a statistics heading. This
     * line is the pointer they will not otherwise get.
     */
    id: "statistics-screen/refused-so-far/no-exhaustion-marker-exists-on-a-movement",
    renderedIn: STATISTICS_SCREEN,
    claim:
      "Nothing on a `Movement` records that the referral network has been exhausted — no closure flag, no " +
      "cap-reached marker, no 'nobody left to ask' state — which is why the heading says 'so far'.",
    reason:
      "An absence, and a load-bearing one. A substring can only witness a field that exists, and the point is " +
      "that no field does; the mechanical halves that ARE citable are pinned in MODEL_CLAIMS above (a decline " +
      "leaves the movement at a referrable stage, and the counted condition is two array lengths). ⚠️ IF A " +
      "CLOSURE OR EXHAUSTION MARKER IS EVER ADDED TO `Movement`, THIS FIGURE'S HEADING MUST CHANGE FROM 'so " +
      "far' TO 'every', its count becomes a strict subset of what it counts today, and the note explaining why " +
      "the qualifier is there must be rewritten or removed. Nothing else in this repository will say so.",
  },
  {
    id: "statistics-screen/not-offered/nothing-anywhere-records-an-offer",
    renderedIn: STATISTICS_SCREEN,
    claim:
      "No field anywhere in the model records that a bed was offered to, or held back from, a particular " +
      "person or request — no instant, no boolean, nothing.",
    reason:
      "An absence, and the reason that figure is not built rather than approximated. Measured by exact search " +
      "rather than assumed, but a search finding nothing has no line to cite. What IS pinned in MODEL_CLAIMS " +
      "above is the positive half: the two aggregate counts a unit does hold, and the fact that the nearest " +
      "derived figure is computed from those two alone. A per-bed or per-offer record arriving tomorrow would " +
      "break neither of those citations, so the day this absence is filled is the day this block should be " +
      "replaced by the figure the owner asked for.",
  },
  {
    id: "statistics-screen/referral-to-bed/a-matching-id-is-not-the-same-wait",
    renderedIn: STATISTICS_SCREEN,
    claim: "A matching referral id does not establish that two records are the two ends of one wait.",
    reason:
      "An inference about what the data can support, not a fact about a field. There is no line to cite because " +
      "the point is that no line links them.",
  },
  {
    id: "statistics-compare-screen/chooser/the-list-keeps-the-recorded-order",
    renderedIn: COMPARE_SCREEN,
    claim: "The unit list is in the order the prototype records units in, and is not sorted or ranked.",
    reason:
      "An absence: the claim is that the screen calls no sort. Guarded instead by the DOM tests in " +
      "tests/ward-statistics-sections.dom.test.tsx, which assert the rendered order against the input order.",
  },
  {
    id: "statistics-ward-screen/blocked/no-instant-marks-entry-to-waitlisted",
    renderedIn: WARD_STATS_SCREEN,
    claim: "No instant on `Admission` marks the moment somebody entered `waitlisted`.",
    reason:
      "An absence, and the one that produced the five-instants-when-there-are-seven defect. The page deliberately " +
      "no longer enumerates the instants, precisely because an enumeration is the thing that goes stale; that " +
      "restraint also removes the only substring a citation could have used.",
  },
  {
    id: "statistics-ed-screen/attributable/triage-can-precede-the-referral",
    renderedIn: ED_SCREEN,
    claim: "Where both instants exist, the triage can precede the referral being raised.",
    reason:
      "A possibility claim. `triagedAt?: Instant;` is pinned above and carries no ordering constraint, but the " +
      "absence of a constraint is again an absence: no line declares an ordering, and a line that is not there " +
      "cannot be cited. The fixture example that used to support this sentence was removed from the page on " +
      "2026-09-01 rather than recorded here — see exclusion class 3 in this file's doc comment.",
  },
  {
    /**
     * ⚠️ **MOVED HERE FROM `MODEL_CLAIMS` ON 2026-09-01, AND THAT IS A REPAIR RATHER THAN A
     * RETREAT.** It cited the doc comment on the ED destination arm — "`FD-16` records that their
     * request arrives verbally, by phone or conversation, and" — a fragment that opens with a
     * backtick and so never even reached `isEntirelyComment`'s code-token test. Two things were
     * wrong with it at once: it is prose restating the claim, and the claim is an ABSENCE (ED
     * medical staff have no account, no route, no event), which exclusion class 2 in this file's
     * doc comment already says cannot be pinned by a substring at all. The comment it cited says of
     * itself "This comment IS the carrier", which is exactly true and exactly why it is not
     * evidence. **A claim recorded here as unguarded is worth more than one guarded by something
     * that cannot fail**, because the coverage number stops counting it.
     */
    id: "statistics-ed-screen/unrecordable/ed-requests-arrive-verbally",
    renderedIn: ED_SCREEN,
    claim:
      "Emergency-department medical staff are not users of this system: their request arrives verbally and " +
      "psychiatry raise the referral.",
    reason:
      "An absence, twice over. The workflow fact — a verbal request, then psychiatry raising the referral " +
      "against themselves — is the owner's described process (FD-16), recorded in a doc comment on the ED " +
      "destination arm and nowhere else; no line of code carries it, because what makes it true is that no ED " +
      "account, ED route or ED-raised event EXISTS. Citing that comment made this claim look guarded while the " +
      "only edit that could break the citation was deleting the comment, which is the one change that does not " +
      "make the claim false. If ED staff are ever given a way into this system, this page's block must go — and " +
      "nothing here will say so.",
  },
  {
    id: "statistics-ed-screen/near-miss/did-not-proceed-usually-means-admission-was-not-needed",
    renderedIn: ED_SCREEN,
    claim: "A `did_not_proceed` closure typically records that an examination found admission was not needed.",
    reason:
      "A clinical reading of what an enum member means in practice. The member itself is pinned above; what it " +
      "usually means is not a fact any line of source states, and this page should not be the first to state it " +
      "as one.",
  },
];
