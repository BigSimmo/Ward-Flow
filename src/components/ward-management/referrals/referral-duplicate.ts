import type { Referral } from "../ward-model";
import type { PatientId } from "../ward-patients";
import { referralState } from "../ward-referrals";

/**
 * WHAT IS ALREADY OPEN FOR THIS PERSON — SAID BEFORE A SECOND REFERRAL IS RAISED.
 *
 * Lane C task 15. A coordinator raising a referral from a person's record cannot see, on that
 * screen, that somebody raised one an hour ago. This states what exists.
 *
 * ⚠️ **IT NEVER GUESSES AT IDENTITY, AND THAT IS THE FIRST RULE.** This is not a "did you mean" and
 * not a fuzzy match on a name or a record number. It answers only for the `patientId` it is handed —
 * a pointer that something upstream already resolved — so it can be wrong only in the way that
 * pointer is wrong. A duplicate-detector that matched on names would be a new way to conflate two
 * people, on the screen where conflating two people is the worst available outcome.
 *
 * 🔴 **`movements` IS NOT A PARAMETER — AND MY FIRST REASON FOR THAT WAS WRONG.**
 *
 * The task plan's signature took `movements: Movement[]` as well, so the sentence could also say
 * that this person is already in a bed. I wrote here, and said in the commit that landed it, that
 * **"`Movement` carries no link to a person"**. ⚠️ **That is false, and it is corrected here rather
 * than quietly deleted, because it travelled into a fold message.**
 *
 * `Movement` carries no DIRECT `patientId` — that much was right. But it declares
 * **`referralId?: string`**, and that join is *enforced rather than intended*: `RAISE_REFERRAL` is
 * its only writer and **refuses an id that does not resolve to a referral already in state**, so a
 * manufactured value cannot reach it. `referralForMovement` (`ward-derivations.ts`) reads it. With
 * `Referral.patientId` (owner ruling 2026-09-02) that is a real two-hop join from a movement to a
 * person — and `search/record-preview.tsx` already uses exactly it.
 *
 * ⚠️ **Do not mistake `Admission.referralId` for the same thing.** Its own doc calls it *"the join
 *
 * 🔴 CORRECTED 2026-09-11: EVERY FACTUAL CLAUSE ABOUT `Admission.referralId` ABOVE IS NOW FALSE.
 * Struck in place rather than deleted, because the reading that made it true is what a reader
 * will otherwise re-derive.
 *
 *     seeded Admission.referralId, non-null      10      every one RESOLVES
 *     real Referral ids                          24      dangling: ZERO
 *     admissions carrying literal null          257      an honest absence, not a broken join
 *
 * Repaired 2026-09-10 at a6e5208b85 - "seeded referralId links what is true and nulls the rest,
 * invents nothing". ⚠️ The manufacturing by string substitution is GONE, not reduced.
 *
 * 🔴 AND THIS FILE IS THE SHARPEST INSTANCE OF ITS OWN LESSON. Fourteen lines above, the
 * same JSDoc correctly RETRACTS a false claim about `Movement.referralId` - "that is false, and
 * it is corrected here rather than quietly deleted, because it travelled into a fold message".
 * ⚠️ The retraction mechanism existed in this exact comment and was never applied to the
 * neighbouring sentence. A RETRACTION DOES NOT SWEEP THE FILE IT LANDS IN.
 * back to the front door"* and it **joins to nothing**: the seeded values are manufactured from the
 * admission's id by string substitution and overlap the real referral ids in **zero** places. One
 * of these two fields is real and one is `fields-with-no-producer`; they look identical.
 *
 * **THE CONCLUSION SURVIVED THE CORRECTION AND THE REASON CHANGED COMPLETELY.** `movements` stays
 * out not because the half cannot be built, but because **it is a different disclosure and nobody
 * has ruled on it.** D-19 permits one boolean about open REFERRALS; whether this screen may also
 * say a person is currently in a bed is a question for the owner, and D-17 has since closed the
 * neighbouring cross-reference on the Patient screen. Taking a parameter this function must not use
 * would be worse than narrowing: a caller passing it would reasonably believe it was covered.
 */

/**
 * 🔴 ONE SENTENCE, A BOOLEAN, AND I BUILT TWO FIRST — D-19 CONDITION 1.
 *
 * The first version distinguished the two states that are not declined, because they ask the reader
 * for different things: *queued* means nobody has answered yet and a second referral may well be
 * reasonable, while *accepted* means a destination has said yes and a second one is a genuine
 * duplicate. I flagged that as an unruled wording change. **D-19 ruled it, and against me.**
 *
 * The ruling permits *"a place-free, ward-free, time-free **boolean**"*, and its allowlist entry
 * says the sentence reports **that one is open and nothing else**. Two sentences are not a boolean:
 * they are a tri-state, and the extra state is a fact about how far along this person's pathway is.
 *
 * ⚠️ **MY REASONING WAS ABOUT USEFULNESS AND THE RULING IS ABOUT DISCLOSURE, AND DISCLOSURE WINS.**
 * Everything I argued about the two states remains true — it would be more useful. It is also more
 * than this screen is permitted to say about a person, and "it would help the reader" is exactly
 * the argument FD-23's own module predicts will be made against it: *"every instinct says a
 * patient's screen shows everything known about that patient."* The distinction goes.
 *
 * 🔴 **AND NEVER A COUNT.** D-19 is explicit that a number is itself a disclosure — *"three open"*
 * narrows a person's history far more than *"one is open"*. The sentence is indefinite (*"A
 * referral"*), never *"2 referrals"*, never *"another"*, never a plural. `referralState` is
 * consulted only to decide whether ANY qualifies; how many did is discarded and never returned.
 */
/**
 * 🔴 THE SENTENCE NAMES NO DESTINATION, AND THAT IS FD-23, NOT BREVITY.
 *
 * Owner ruling 2026-08-30: **a ward cannot see where else a patient has been referred; the
 * coordinator may see everything.** `ward-referral-visibility.ts` calls it *"the single most likely
 * rule in that document to be undone by somebody being helpful — every instinct says a patient's
 * screen shows everything known about that patient."*
 *
 * ⚠️ **The helpful edit this exists to stop is "…already open at Ward 4B".** It reads as an
 * improvement, it would compile, and it would put the one fact FD-23 forbids onto a screen
 * reachable from a patient's record. `tests/ward-referral-duplicate.test.ts` fails any sentence
 * carrying a unit name, a destination word, a digit or a plural.
 */
const ALREADY_OPEN = "A referral for this person is already open.";

/** Exported as a list of ONE so the guard asserts over the sentences this module can emit, whatever
 *  that set becomes, rather than over the single string somebody remembered to check. A property
 *  checked on one of two strings is checked on neither, and that was a live risk here: this module
 *  held two until D-19 collapsed them. */
export const DUPLICATE_SENTENCES = [ALREADY_OPEN] as const;

/**
 * The sentence to show, or `undefined` when there is nothing to say.
 *
 * ⚠️ **`undefined` RATHER THAN AN EMPTY STRING.** An empty string renders as an empty element and
 * reads on screen as a sentence that failed to load; the absence of a duplicate is not a thing to
 * report, so there is nothing to render at all.
 */
export function duplicateSentence(input: { patientId: PatientId; referrals: readonly Referral[] }): string | undefined {
  /*
   * ⚠️ `===`, NEVER `!==` ANYWHERE IN THIS PREDICATE. `patientId` is OPTIONAL on a referral —
   * legitimately so, because a referral raised outside the patient flow has nobody on file yet —
   * and most referrals in the seed carry none. A predicate written as `referral.patientId !== id`
   * is true for every one of those, so the sentence would fire for a person who has no referral at
   * all, on every screen, and the demo would look like it had detected something.
   */
  const theirs = input.referrals.filter((referral) => referral.patientId === input.patientId);

  /*
   * ⚠️ `.some`, NOT `.filter().length` — AND THAT IS D-19 CONDITION 1, NOT A STYLE PREFERENCE.
   * `.some` stops at the first match and yields a boolean; a count would exist, in a variable,
   * one keystroke from being rendered. D-19 is explicit that a number is itself a disclosure:
   * "three open" narrows a person's history far more than "one is open". The count is never
   * computed, so it cannot be leaked by a later edit that only looks like formatting.
   */
  const open = theirs.some((referral) => {
    const state = referralState(referral);
    // Both non-declined states collapse into one answer. Naming WHICH would report how far along
    // this person's pathway is, which is more than "one is open" — see the D-19 note above.
    return state === "accepted" || state === "queued";
  });
  if (open) return ALREADY_OPEN;

  // Every referral this person has is declined — which is not an open referral and must not be
  // reported as one. A declined referral is precisely the case where raising another is correct.
  return undefined;
}
