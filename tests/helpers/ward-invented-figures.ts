/**
 * 🔴 **THE OWNER'S RULING, AS A PREDICATE.** 2026-09-09, in his words: *"the number should always
 * carry that it's invented"* (`docs/ward-flow/owner-decisions-2026-09-09.md` §2, `f22aac45a9`).
 *
 * Every item inside an "Invented figures" group must be **false-free read ALONE** — quoted,
 * screen-read, copied into a message, or reached after the heading has scrolled away. **A heading is
 * context, and context does not travel with the sentence.**
 *
 * ---
 *
 * ⚠️ **THIS EXISTS BECAUSE MY FIRST IMPLEMENTATION OF THAT RULING WAS INVERTED, AND IT CERTIFIED
 * EXACTLY THE CLAIM THE RULING FORBIDS.** It asked whether the sentence contained any of seven TOPIC
 * WORDS — `synthetic`, `invented`, `not measured`, `never a measurement`, `made up`, `random walk`,
 * `not real`. Flagged by Ward Builder Four, re-measured here against my own committed predicate:
 *
 *     "The ward names are invented; there were 28 referrals"      ADMITTED
 *     "Unlike the synthetic patient names, these are current"     ADMITTED
 *     "These figures are NOT invented — they are current"         ADMITTED
 *     "Nothing here is synthetic any more; counts are live"       ADMITTED
 *     "This referral count is not made up: it came from live"     ADMITTED
 *
 * **Seven of eight, and every one of the four negations.** A footnote item asserting that an invented
 * figure is REAL satisfied the guard **by containing the word it denies** — on the very component
 * whose defect produced the ruling. It also reddened three honest items, so it was wrong in both
 * directions at once.
 *
 * ---
 *
 * **THE METHOD: CLAIMS, NOT TOPIC WORDS.** Each accepted spelling is a contiguous full claim, so a
 * negation cannot contain it — *"are NOT invented"* does not contain *"are invented"*, and the
 * negator is rejected for free.
 *
 * ⚠️ **Deliberately NOT a list of negators.** Enumerating the ways English says "not" is the same
 * fragment-list weakness one level along, and it is unbounded. The claim list is bounded because the
 * page may only say a small number of true things about a fabricated number.
 *
 * ⚠️ **AND NOT A COPY OF ANOTHER CHAT'S REGEX.** Ward Builder Four measured that their repaired
 * predicate reddens one of this project's honest items — *"The bed occupancy is a random walk, not
 * measured"* — because `random walk` and `not measured` are statistics vocabulary their claim list
 * does not carry. **The method transfers; the list does not.** A substitution that reddens correct
 * prose on day one gets the guard switched off, which is the failure this whole programme circles.
 */

/**
 * Full claims a page may truthfully make about a fabricated number. Extend by adding another CLAIM,
 * never a bare topic word: a topic word is true of the sentence that denies it.
 */
const PROVENANCE_CLAIMS: readonly string[] = [
  "is invented",
  "are invented",
  "was invented",
  "were invented",
  "is synthetic",
  "are synthetic",
  "was synthetic",
  "were synthetic",
  "is fabricated",
  "are fabricated",
  "is made up",
  "are made up",
  "is dummy data",
  "are dummy data",
  "is a random walk",
  "are a random walk",
  "is not measured",
  "are not measured",
  "was not measured",
  "were not measured",
  "never a measurement",
  "not a measurement",
  "never measured",
  "is not real",
  "are not real",
];

/**
 * A clause has to carry provenance only if it MENTIONS A FIGURE.
 *
 * ⚠️ A trailing clause carrying no quantity cannot state one falsely, and demanding provenance from
 * it would redden ordinary prose — *"Both trends are invented. They are reseeded on every render."*
 * is honest, and a rule requiring every clause to claim would fight it. **That is the guard-reddens-
 * correct-work failure this branch spent two days removing, so it is designed out rather than
 * discovered later.**
 *
 * 🔴 **WHAT THIS DELIBERATELY DOES NOT SEE, MEASURED BY WARD LEAD 2026-09-10 AND NAMED HERE SO
 * NOBODY HAS TO INFER IT.** A clause asserting CURRENCY with no quantity attached carries no figure
 * word, so it is skipped:
 *
 *     PASSES   "The trends are invented. They are current."
 *     PASSES   "Every bed figure is invented. The occupancy is live."
 *
 * **The rule is still right and is deliberately not being widened** — an every-clause rule scores
 * identically on the corpus and reddens honest prose on day one, which is how a guard gets switched
 * off. **But the gap is real and it has already shipped once:** the Command mockup's Activity panel
 * renders a green dot and *"Live, reconciled"* over invented figures, and nothing in this estate
 * would have caught it. **A claim of LIVENESS is a different claim from a figure stated as fact, and
 * this predicate does not govern it.**
 *
 * ⚠️ **A limit a reader has to infer is a limit the next person will quote past.** Do not cite this
 * file as covering currency claims.
 */
const MENTIONS_A_QUANTITY =
  // SHAPE, and preferred: a digit, or a cardinal number word. Number words are a CLOSED class in
  // English, so this is a shape rather than a vocabulary — "the wait is eleven hours" is examined
  // even though "wait" is on no list. Added 2026-09-10 on Ward Builder Four's measurement.
  /[0-9]|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen)\b/u;

/**
 * ⚠️ **THIS PART IS A LIST, LABELLED AS ONE RATHER THAN LEFT LOOKING LIKE A RULE.** Ward Lead's
 * instruction: make it shape-shaped if you can, and **if you cannot, say in the file that it is a
 * list.** The shape above covers every quantity carrying a numeral or a number word. It does NOT
 * cover a clause naming a figure with no number in it — *"counts are live"* — and no shape
 * distinguishes that from ordinary prose, because the giveaway is the NOUN.
 *
 * 🔴 **A list standing where a shape should be is the bare-word defect one level along, and this is
 * the dangerous kind: an unlisted noun leaves the clause UNEXAMINED, which reads identically to
 * compliant.** Every noun absent here is a hole. Kept because dropping it regresses a measured case;
 * named because an unlabelled whitelist is how the next reader mistakes coverage for completeness.
 */
const FIGURE_NOUNS =
  /\b(count|counts|figure|figures|number|numbers|total|totals|trend|trends|data|referrals|acceptances)\b/u;

/**
 * 🔴 **A RETRACTION CANCELS THE CLAIM, AND WITHOUT THIS THE CATCH WAS AN ACCIDENT.** Measured by
 * Ward Builder Four, reproduced by Ward Lead:
 *
 *     REJECTED  "These totals used to be synthetic."       <- only because it happens not to contain
 *                                                             a listed claim. An ACCIDENT, not coverage.
 *     PASSED    "The bed counts were invented until recently."
 *
 * **The next honest phrasing lands on whichever side chance puts it**, which is not a property a
 * guard may have. This regex is Ward Builder Four's, transferred VERBATIM — unlike their CLAIM
 * vocabulary, which reddens this project's honest "random walk, not measured" item. **The method
 * transfers and so does this; the claim list does not.**
 */
const RETRACTED = /\b(?:any\s?more|no longer|until recently|used to be|has since|now live|now real)\b/iu;

function makesAClaim(text: string): boolean {
  return PROVENANCE_CLAIMS.some((claim) => text.includes(claim));
}

function statesAQuantity(clause: string): boolean {
  return MENTIONS_A_QUANTITY.test(clause) || FIGURE_NOUNS.test(clause);
}

/**
 * Does this footnote item state its own provenance, in its own sentence, for every figure it names?
 *
 * ⚠️ **`;` and `.` are clause boundaries; `:` deliberately is NOT.** A semicolon joins two
 * independent statements, so *"The ward names are invented; there were 28 referrals"* carries the
 * full claim and still states a figure as fact in its second half — measured, and it is the one
 * shape a whole-item check cannot see. A colon introduces an elaboration of the same statement, and
 * splitting on it reddens a real compliant item: *"The 12 teams shown here are invented: the
 * vocabulary a referral can name supplies them."*
 */
export function statesItsOwnProvenance(item: string): boolean {
  const text = item.toLowerCase();
  if (!makesAClaim(text)) return false;
  // A retracted claim is not a claim. Checked on the WHOLE item rather than per clause: "invented"
  // in one half and "no longer" in the other is exactly the shape being refused.
  if (RETRACTED.test(text)) return false;
  return text
    .split(/[;.]/u)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0)
    .every((clause) => !statesAQuantity(clause) || makesAClaim(clause));
}

/**
 * The failure message, kept beside the predicate so the two cannot drift apart, and written to say
 * what to DO rather than merely that something is wrong.
 */
export function provenanceFailure(item: string): string {
  return (
    `an item under "Invented figures" does not state, in its own words, that the figure it names is ` +
    `invented — so the sentence is false when it is read on its own, which is how a figure travels. ` +
    `Say it as a claim ("… is synthetic", "… are invented", "… is a random walk, not measured"), not ` +
    `as a topic word: a bare word is equally present in the sentence that DENIES it. The item was: ` +
    `"${item}"`
  );
}
