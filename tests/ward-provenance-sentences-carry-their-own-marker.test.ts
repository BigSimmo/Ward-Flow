import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **EVERY SENTENCE UNDER A PROVENANCE HEADING MUST DISCLOSE PROVENANCE BY ITSELF.**
 *
 * Owner ruling, 2026-09-09 (`docs/ward-flow/owner-decisions-2026-09-09.md` §2, reading A):
 * *"the number should always carry that it's invented"*, applied everywhere — **a sentence whose
 * job is to disclose provenance must be true read alone: quoted, screen-read, copied into a
 * message, or reached after the heading has scrolled away. A heading is context, and context does
 * not travel with the sentence.**
 *
 * **The measured defect that produced the ruling.** `StatFootnote` renders a heading *"Invented
 * figures"* over free-prose items. An item was replaced with *"There were 28 referrals this
 * period."* — an invented number stated as measured fact — and every guard stayed green. **The
 * claim was true of the LIST and false of the ENTRY.**
 *
 * ⚠️ **WHY THIS FILE EXISTS WHEN `ward-prototype-disclosure.test.ts` ALREADY GUARDS DISCLOSURE.**
 * That guard is sound and is not weakened here: it walks every ward route, floors itself against
 * vacuity, refuses to be satisfied by a comment, and asserts `disclosesWithin(...)` — **does this
 * SCREEN render a `prototypeBadge` banner.** Presence, per screen. It cannot see the content of a
 * sentence. Measured 2026-09-09: removing the marker from `hub-screen`'s *"What is invented"* block
 * and stating the bed figures as current fact left **22 hub tests and 219 tests across 22
 * governance and disclosure files all green.** The same relationship the heading had to its items,
 * one level up — **true of the SCREEN, false of the SENTENCE.**
 *
 * 🔴 **WHAT THIS GUARD DELIBERATELY DOES NOT COVER, AND WHY IT WOULD BE WORSE IF IT DID.**
 * The obvious wider rule — *every sentence in every provenance BANNER must carry a marker* — was
 * built and measured first: **44 of 58 banner sentences flagged, and almost all were correct.**
 * Banners mix provenance with safety and scope statements (*"This board is not a medical device."*,
 * *"It places nobody: a coordinator decides every placement."*) whose job is not disclosure at all.
 * A guard that reddens on those gets widened until it means nothing, which is the failure this
 * repository keeps recording. **So the population here is the one where "its job is to disclose
 * provenance" is decidable from the source: a sentence sitting under a heading that names
 * provenance.** Banner prose is left to `ward-prototype-disclosure.test.ts`, which checks the
 * banner is present, and to a reader.
 *
 * **THE HONEST LIMIT, stated so nobody quotes this file as more than it is:** a disclosure sentence
 * that carries no provenance heading above it is invisible here. That is not a gap that can be
 * closed by widening this rule — it needs a way to tell a disclosure sentence from a safety one,
 * and text alone does not provide it.
 *
 * 🔴 **AND THE SIZE OF THAT LIMIT, MEASURED, BECAUSE IT IS LARGER THAN THE PROSE ABOVE IMPLIES.**
 * Independently measured 2026-09-10 (Ward Lead, then re-derived here rather than relayed):
 *
 *     .tsx files under this root                       76
 *     files whose rendered prose discloses provenance   45   (by a deliberately loose reading)
 *     provenance HEADINGS anywhere in the tree           3
 *     files this guard actually reaches                  2   hub/hub-screen.tsx,
 *                                                            ward-management-modes.tsx
 *
 * **This codebase discloses provenance in a BANNER, not under a heading — so the population this
 * guard can decide about is two files out of seventy-six.** Every strengthening in this file — the
 * claim shapes, the relative floor, the widened paragraph scan — applies inside those two, and
 * **none of them moves that number.** A reader who takes a green run here as "the ward screens
 * disclose their invented figures correctly" has read it as roughly thirty-eight times more than it
 * says. Ward Lead measured 51 disclosing files where this note says 45; the two counts use
 * different readings of "discloses" and the difference is not load-bearing — **the 3 headings and
 * the 2 files reached were obtained identically from both chairs.**
 *
 * ⚠️ **THE FOURTEEN OTHER SCREENS ARE UNEXAMINED, NOT COMPLIANT.** They have never been read
 * against the owner's ruling. *Unexamined*, *compliant-and-guarded*, *compliant-but-unguarded* and
 * *defective* are four different states that are identical in a count, and only this sentence
 * separates them here. Do not let a green run on this file collapse them.
 */

const ROOT = "src/components/ward-management";

/** A heading that announces the block beneath it is about what is not real. */
const PROVENANCE_HEADING = /invented|synthetic|placeholder|prototype boundary/iu;

/**
 * 🔴 **EVERY ALTERNATIVE IS A CLAIM, NOT A TOPIC WORD — AND THAT DISTINCTION IS THE WHOLE GUARD.**
 *
 * This began as a flat list of words (`invented|synthetic|placeholder|prototype|no real|…`).
 * Measured 2026-09-10 against thirteen sentences it had never seen: **eight got through.** The
 * mechanic is `some(spelling => text.includes(spelling))`, so **the weakest alternative sets the
 * whole predicate's strength** — the rule the `expectSays` sites taught a day earlier
 * (`docs/ward-flow/reword-arms-ed-and-morning-2026-09-09.md`), which did not transfer because it
 * was filed as a lesson about *that helper*.
 *
 * **A topic word names a SUBJECT, so a bystander clause carries it for free:**
 *
 *     "This prototype shows that four beds are ready to admit right now."   passed on `prototype`
 *     "Unlike the synthetic patient names, these bed counts are current."   passed on `synthetic`
 *
 * ⚠️ **And a substring test has no polarity, so every negation of the keyword was a free pass:**
 *
 *     "These figures are NOT invented — they are the current state of the network."   passed
 *     "This is NO LONGER a prototype, and the eleven-hour figure is measured."        passed
 *
 * **Those sentences assert the exact thing the owner's ruling forbids — that an invented figure is
 * measured — and satisfied the guard BY CONTAINING THE WORD THEY DENY.** Not a loose setting: an
 * inverted one.
 *
 * **The fix is the shape, not the length.** Every alternative below binds the disclosing word to
 * its verb (`are invented`) or to its noun (`invented figures`), so a negator must land INSIDE the
 * phrase and breaks the match. ⚠️ **A list of negators — `not`, `no longer`, `isn't`, `ceased to
 * be` — would have been the same fragment weakness one level along, and unbounded.** The one place
 * a list is unavoidable is `RETRACTED` below, and it is labelled as one.
 *
 * **`prototype` is gone.** It was the sole support of no real sentence and admitted three of the
 * eight defects. So were `synthetic`, `placeholder` and `no real` as bare words; they return here
 * only inside claims.
 *
 * ⚠️ **THE TOLERANCE ARGUMENT DIED WITH THE MEASUREMENT, so do not re-open it from memory.** The
 * word list was defended as tolerance for honest rewording, and the narrowing was priced at 6→11
 * honest sentences reddened. **Claim shapes cost neither: 0 of 5 real sentences and 0 of 9 honest
 * rewords redden, and 0 of 18 defects pass.** More tolerant AND stronger, because the tolerance
 * was never coming from the bare words — it is coming from the verb list.
 *
 * **Widen by adding a whole CLAIM after reading a real sentence.** Never a bare word, and never to
 * make a red go away.
 */
const MARKER =
  /\b(?:is|are|was|were|been|being)\s+(?:all\s+|every\s+)?(?:invented|synthetic|fictional|fabricated|made up|imaginary|a placeholder|placeholders|dummy|illustrative|a sample|sample data)\b|(?<!\b(?:not|never|hardly|barely|no|nor)\s)\b(?:invented|synthetic|fictional|fabricated|placeholder|dummy|sample)\s+(?:figures?|numbers?|names?|entr(?:y|ies)|dates?|values?|counts?|data|records?|trails?|times?)\b|\bno\s+live\s+(?:systems?|integrations?)\b|\bnothing\s+(?:here|on it|below|in it|on this screen|on this page)\s+is\s+(?:a\s+)?(?:real|clinical|live)\b|\bnobody\s+(?:here|below|on this screen|on this page)\s+is\s+(?:a\s+)?real\b|\b(?:is|are|was|were)\s+not\s+(?:a\s+)?(?:real|live|clinical|actual|measured)\b|\bno\s+real\s+(?:hospital|team|patient|ward|service|person|clinician)/iu;

/**
 * A disclosure withdrawn in the same breath — *"synthetic **any more**"*, *"invented **until
 * recently**"*. The negator sits AFTER the claim, where binding it to the verb cannot reach it.
 *
 * 🔴 **THIS ONE IS A LIST, NOT A SHAPE, AND SO IT IS INCOMPLETE BY CONSTRUCTION.** It is written
 * here rather than hidden inside `MARKER` so nobody mistakes it for the structural half. Its
 * coverage is exactly the phrases enumerated and is pinned by the self-test below; a sentence that
 * retracts its disclosure some other way still passes. **If you find one, add it AND add its
 * self-test case** — an addition here without a case is a widening nobody can see.
 */
const RETRACTED = /\b(?:any\s?more|no longer|until recently|used to be|has since|now live|now real)\b/iu;

/**
 * ⚠️ **A SEMICOLON ENDS A SENTENCE AND THE SPLITTER DID NOT KNOW IT**, which is how
 * *"The ward names are invented; there were 28 referrals this period."* passed a claim-shaped
 * predicate — the claim was true of the first clause and the figure sat in the second.
 *
 * **A colon is deliberately NOT a boundary.** Measured: splitting on `:` reddens real sentence 2 in
 * `hub-screen.tsx`, whose second half is honest continuation rather than a fresh claim. The cost of
 * that decision is a real hole — *"The names are invented: there were 28 referrals."* passes — and
 * it is stated rather than left for someone to find.
 *
 * 🔴 **AND THE COLON HAS TWO SIBLINGS THIS COMMENT ORIGINALLY OMITTED — an `and`, and a comma.**
 * Both hide a bystander inside a single clause, and both pass:
 *
 *     "The referral count is invented and the wait time is 11 hours."
 *     "Every name is synthetic, and four beds are free right now."
 *
 * ⚠️ **They are recorded as a LIMIT rather than fixed, and the reason is measured, not assumed.**
 * Splitting on `and` or `,` shreds honest prose: the real first sentence in `hub-screen.tsx` is
 * *"Every bed figure — ready to admit, vacant but not yet cleared, and out of service — is invented
 * for this prototype"*, which carries two commas and an `and` **inside one claim** and would break
 * into fragments that each fail. **A guard that reddens correct work gets widened until it means
 * nothing**, so chasing these would cost more than they take.
 *
 * **The same three are shared by `tests/helpers/ward-invented-figures.ts`**, arrived at
 * independently for the statistics screens. **A residual shared by two independent implementations
 * is a property of the APPROACH — sentence-level text analysis cannot see a bystander inside one
 * clause — not a bug in either**, and reporting it against whichever was measured second is how a
 * sound design gets churned.
 *
 * 🔴 **HOW THE OMISSION HAPPENED, because it is the more useful half.** The colon was found by
 * hitting it while choosing a splitter; nobody then went looking for its siblings, and this comment
 * stated one hole as though it were the set. **A LIMITS SECTION IS A POPULATION LIKE ANY OTHER AND
 * THIS ONE WAS NEVER FLOORED** — in the file that argues at length for stating limits. Before
 * adding a limit here, ask what else is in its class.
 *
 * Every clause is checked, **with no minimum length**. The 25-character floor filters the
 * POPULATION (whole sentences), and applying it to clauses too let *"four beds are free."* escape
 * unexamined at 19 characters.
 */
function discloses(sentence: string): boolean {
  const clauses = sentence
    .split(/(?<=[.!?;])\s+/u)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
  return clauses.every((clause) => MARKER.test(clause) && !RETRACTED.test(clause));
}

function tsxFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFilesUnder(path));
    else if (entry.name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/**
 * ⚠️ Comments are not rendered, and a guard that reads them measures the wrong artefact — the
 * sibling redirect-stub guard carries the same stripping for the same reason. A block comment
 * quoting a non-compliant sentence must not fail this, and one quoting a compliant sentence must
 * not satisfy it. The self-test below pins both directions.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/^\s*\/\/.*$/gmu, " ");
}

function renderedText(fragment: string): string {
  return fragment
    .replace(/\{[^{}]*\}/gu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&rsquo;|&apos;/gu, "'")
    .replace(/&ldquo;|&rdquo;|&quot;/gu, '"')
    .replace(/&mdash;/gu, "—")
    .replace(/&nbsp;/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * The paragraph the heading introduces — not everything until the next heading, which swallows
 * unrelated code and was the first version's largest source of false positives.
 *
 * 🔴 **MEASURED HOLE, NOT A SUSPECTED ONE (Ward Lead, three mutation arms, 2026-09-10).** This
 * file's author labelled "the paragraph scoping catches every disclosure sentence" as an unverified
 * belief. It was verified, and **it is false.**
 *
 *   A · a bare figure INSIDE the first `<p>`      → RED, naming that sentence and no other.
 *   B · the same figure in a SECOND `<p>` under   → **GREEN, 4 of 4.** Invisible. Only the first
 *       the same heading                            paragraph is ever read.
 *   C · the block's prose wrapped in `<span>`     → RED — but on the FLOOR, not on the rule.
 *       instead of `<p>`
 *
 * ⚠️ **Arm C is the one to read twice, because it looks like the floor working and is not.**
 * `paragraphAfter` returned `null`, the block stopped being scanned, `blocks` fell 3 → 2, and the
 * floor `>= 3` went red. That is ARITHMETIC, not detection: the floor noticed a count crossing a
 * constant, not a block going dark. **Add a fourth provenance block and the identical mutation
 * takes 4 → 3 and passes in silence.** A constant floor catches only the LAST unit that stops being
 * measured. **Closed 2026-09-10** by the relative invariant in the describe block below — every
 * heading found must yield a scanned block, and a dark one is named. The constant floor on the
 * heading walk itself remains, and remains exactly the shape this indicts.
 *
 * 🔴 **ARM B IS CLOSED HERE, AND THE REASON IT WAS LEFT OPEN DID NOT SURVIVE MEASUREMENT.** It was
 * declined on the grounds that widening re-opens the false positives this function exists to close
 * — *44 of 58 banner sentences flagged, almost all correct.* **Those are two different widenings
 * over two different populations.** The rejected rule was BADGE-anchored: every sentence in every
 * `prototypeBadge` banner, which is why it swept up *"This board is not a medical device"* and
 * *"It places nobody"*, whose job is not disclosure at all. This one is HEADING-anchored and stays
 * inside the population this file already defends as decidable. **The 44/58 never priced it.**
 *
 * **What it actually costs, measured over the real corpus before the change was made:**
 *
 *     provenance headings found         3
 *     blocks scanned, first <p> only    3    sentences  5
 *     blocks scanned, ALL <p> in region 3    sentences  5
 *     ADDITIONAL sentences scanned      0    new failures  0
 *
 * Every provenance block in this codebase is a single paragraph, so the first-`<p>` restriction was
 * buying no false-positive protection at all — it was only creating the blind spot.
 *
 * ⚠️ **THE LIMIT OF THAT NUMBER, stated so it is not quoted as more:** it prices the widening
 * against TODAY's corpus and cannot price it against prose nobody has written. A genuine safety
 * sentence written under a provenance heading would redden here, and that is a legitimate argument
 * to have when it exists — not a reason to keep a hole through which the exact defect this guard
 * was built for can be written into a second paragraph and stay invisible for ever.
 *
 * The region still ends at the next heading or `</section>`, which is what stops it swallowing
 * unrelated code — that half of the original reasoning was sound and is kept.
 */
function paragraphsAfter(rest: string): string[] {
  const stop = rest.search(/<h[1-6][\s>]|<\/section>/u);
  const region = stop < 0 ? rest : rest.slice(0, stop);
  const paragraphs: string[] = [];
  const blocks = /<p[\s>][\s\S]*?<\/p>/giu;
  for (let match = blocks.exec(region); match; match = blocks.exec(region)) paragraphs.push(match[0]);
  return paragraphs;
}

/**
 * 🔴 **A PARAGRAPH DECLARES ITS OWN SUBJECT, AND A HEADING IS NOT A CONTRACT ABOUT EVERY SENTENCE
 * BENEATH IT.** Ward Lead's ruling, 2026-09-11, on seven sentences this guard flagged when its
 * population first reached a two-sided provenance section.
 *
 * **The section that produced the ruling has three paragraphs, each opening with its own lead-in:**
 *
 *     "Every figure here is invented"    → an invention disclosure.      IN the population.
 *     "What is real"                     → the OPPOSITE claim.           EXCLUDED.
 *     "Two populations, kept apart"      → structural explanation.       EXCLUDED.
 *
 * ⚠️ **THE SECOND ONE IS THE REASON THIS RULE EXISTS AND IT IS NOT A CONVENIENCE.** Every
 * alternative in `MARKER` asserts that something IS INVENTED. *"What is real: the 8 emergency
 * departments, the hospital sites and the ward names, from the repository's own tables"* would have
 * to claim those departments are invented in order to pass. **They are not. The guard was demanding
 * a sentence that is FALSE**, and no amount of new wording fixes that — *"these are invented"* and
 * *"these are real"* are two different claims, and a guard for the first cannot learn the second
 * without passing any screen that discloses only what is real and never what is not.
 *
 * 🔴 **THE LOOPHOLE THIS OPENS, STATED RATHER THAN LEFT TO BE FOUND: an invented figure hidden
 * inside a paragraph labelled "What is real" is invisible here.** It is closed from the other end,
 * by `EVERY SECTION MUST CARRY AT LEAST ONE INCLUDED PARAGRAPH` below — a section cannot excuse
 * itself wholesale by labelling every paragraph — but a MIXED paragraph still gets through. That is
 * a real hole and it is the price of not demanding a false sentence.
 *
 * ⚠️ **A paragraph with NO lead-in at all is IN the population.** The default has to be inclusion,
 * or omitting the lead-in becomes the way out.
 */
const PARAGRAPH_SUBJECT = /^\s*<p[^>]*>\s*<strong>([^<]{0,80})<\/strong>/u;

/** The lead-ins whose paragraphs are disclosing invention, and so must carry a marker per sentence. */
const INVENTION_SUBJECT = /invented|synthetic|fictional|fabricated|placeholder|made up|not real/iu;

function paragraphSubject(paragraph: string): string | undefined {
  return PARAGRAPH_SUBJECT.exec(paragraph)?.[1]?.trim();
}

type Sentence = { readonly file: string; readonly heading: string; readonly text: string };

function provenanceSentences(
  sources = tsxFilesUnder(ROOT).map((file) => ({ file, source: readFileSync(file, "utf8") })),
): {
  headings: string[];
  dark: string[];
  blocks: number;
  sentences: Sentence[];
  skipped: string[];
  sectionsWithNothingIncluded: string[];
} {
  const sentences: Sentence[] = [];
  const found: string[] = [];
  const dark: string[] = [];
  const skipped: string[] = [];
  const sectionsWithNothingIncluded: string[] = [];
  for (const { file, source: rawSource } of sources) {
    const source = withoutComments(rawSource);
    const relative = file.split(sep).join("/").replace(`${ROOT}/`, "");
    /**
     * 🔴 **`WardPanel title="…"` IS A HEADING, AND THIS GUARD COULD NOT SEE ONE UNTIL 2026-09-11.**
     * The primitive renders an `<h2>` — but from `ward-panel.tsx`, so a screen declaring a section
     * through it has no heading tag in its own source. **The artefact this guard searched was not
     * the artefact that renders**, and the Delays screen's *"What is invented and what is real"*
     * section would have been guarded by a file that never opened it.
     *
     * ⚠️ **MEASURED BEFORE WIDENING, because a widened guard that reddens on correct work gets
     * widened again until it means nothing — the 44-of-58 failure this file's own header records.**
     * **Of the 56 `WardPanel` titles in this tree, exactly ONE announces provenance.** So this adds
     * one file to the reach and flags nothing that already shipped.
     *
     * 🔴 **IT WAS BUILT, WITHDRAWN, AND ONLY THEN LANDED, AND THE ORDER IS THE POINT.** The first
     * attempt reddened on a true sentence — see `PARAGRAPH_SUBJECT` — and the fix for that is a
     * ruling about which paragraphs the rule is ABOUT, not a new word in `MARKER`. **Widening the
     * SPELLINGS of a claim already accepted is a repair; widening the SET OF CLAIMS accepted
     * destroys the guard. Both get called "widening the marker" and they are opposites.**
     */
    const headings = /<h[1-6][^>]*>([^<]{0,80})<\/h[1-6]>|<WardPanel\s+title="([^"]{0,80})"[^>]*>/giu;
    for (let match = headings.exec(source); match; match = headings.exec(source)) {
      const heading = (match[1] ?? match[2] ?? "").trim();
      if (!PROVENANCE_HEADING.test(heading)) continue;
      found.push(`${relative} · "${heading}"`);
      /**
       * 🔴 **THE REGION IS BOUNDED AT THE SECTION'S CLOSE, AND IT WAS NOT UNTIL 2026-09-11.**
       * `paragraphsAfter` scanned to END OF FILE, so a provenance heading inherited every
       * paragraph below it — including prose belonging to helper components defined 500 lines
       * later in the same file, which is where the Delays screen's own sub-components live.
       * **Measured 2026-09-11 by the widening recorded above, which was then withdrawn: four of
       * eleven flagged sentences belonged to other components entirely**, one a fragment of mangled
       * JSX. ✅ **The fix is kept even though the widening is not** — the defect is real in the
       * scanner, and it will be waiting for whoever widens the population next.
       *
       * ⚠️ **It was invisible before because the two files this guard already reached end at
       * their heading's section.** A bug that cannot occur in the whole population a guard walks
       * is indistinguishable from no bug — and widening the population is exactly what exposes it.
       * **Prose belonging to the section next door, blamed on this one.**
       */
      const region = source.slice(match.index + match[0].length);
      const close = region.search(/<\/WardPanel>|<\/section>/u);
      const bodies = paragraphsAfter(close === -1 ? region : region.slice(0, close));
      if (bodies.length === 0) {
        dark.push(`${relative} · "${heading}"`);
        continue;
      }
      let included = 0;
      for (const body of bodies) {
        const subject = paragraphSubject(body);
        if (subject !== undefined && !INVENTION_SUBJECT.test(subject)) {
          skipped.push(`${relative} · "${heading}" · paragraph "${subject}"`);
          continue;
        }
        included += 1;
        for (const raw of renderedText(body).split(/(?<=[.!?])\s+/u)) {
          const text = raw.trim();
          if (text.length < 25) continue;
          sentences.push({ file: relative, heading, text });
        }
      }
      if (included === 0) sectionsWithNothingIncluded.push(`${relative} · "${heading}"`);
    }
  }
  return { headings: found, dark, blocks: found.length - dark.length, sentences, skipped, sectionsWithNothingIncluded };
}

describe("a sentence under a provenance heading discloses provenance by itself", () => {
  const { headings, dark, blocks, sentences } = provenanceSentences();

  /**
   * 🔴 **A CONSTANT FLOOR CATCHES ONLY THE LAST UNIT THAT STOPS BEING MEASURED.** Ward Lead proved
   * it on this file, 2026-09-10, and the finding generalises past it: wrapping a block's prose in
   * `<span>` instead of `<p>` made `paragraphAfter` return null, `blocks` fell 3 → 2, and a floor of
   * `>= 3` went red. **That looks like the floor working and is not.** It is a count crossing a
   * constant. Add a fourth provenance block and the identical mutation takes 4 → 3 and passes in
   * silence.
   *
   * **So the invariant is relative, and it has something stable to be relative TO:** headings are
   * counted UPSTREAM of `paragraphAfter` and cannot go dark from a `<p>` change. Every heading the
   * walk finds must yield a scanned block, and a block that goes dark is NAMED — at any population
   * size, which is the property the constant never had.
   */
  it("scans every provenance heading it finds — a block that goes dark is named, not absorbed", () => {
    expect(
      dark,
      "these provenance headings were found but no paragraph was scanned under them, so their prose " +
        "is invisible to every assertion below. Prose moved out of a <p> (into a <span>, a component " +
        "call, or past the 400-character window) is the usual cause. This is NOT satisfied by " +
        "lowering a floor: fix the scan or state why the block is exempt.",
    ).toEqual([]);
    expect(blocks, "internal: scanned blocks should equal headings found minus dark ones").toBe(
      headings.length - dark.length,
    );
  });

  /**
   * ⚠️ **The outermost population still needs a constant, and this is the one place that cannot be
   * made relative — there is nothing upstream of the heading walk to compare it against.** So it is
   * a floor of exactly the shape Ward Lead's finding indicts, kept because the alternative is no
   * floor at all. **Do not read the relative check above as closing the floor problem generally.**
   * Every other anti-vacuity floor in this programme is still a constant, and this one still only
   * catches the last heading to disappear.
   */
  it("finds the provenance headings at all, so the assertions below are not vacuous", () => {
    expect(
      headings.length,
      "no provenance headings found — the heading walk itself is measuring nothing",
    ).toBeGreaterThanOrEqual(2);
    expect(headings).toContain('hub/hub-screen.tsx · "What is invented"');
    expect(headings).toContain('statistics/statistics-ed-screen.tsx · "Every figure here is invented"');
    expect(
      sentences.length,
      "provenance headings found but no prose under them — the paragraph scan is broken",
    ).toBeGreaterThanOrEqual(4);
  });

  /**
   * ⚠️ The control that separates this guard from one that cannot fail. It must reject a
   * non-compliant sentence and accept a compliant one — testing the PREDICATE directly, because a
   * green run over the real corpus proves only that the corpus is currently clean.
   */
  it("rejects a figure stated as fact and accepts the same figure disclosed", () => {
    expect(discloses("There were 28 referrals this period.")).toBe(false);
    expect(discloses("28 referrals is synthetic.")).toBe(true);
    expect(discloses("Every bed figure is drawn from the current state of the network this morning.")).toBe(false);
    expect(discloses("Every bed figure is invented for this prototype.")).toBe(true);
  });

  /**
   * 🔴 **THE CASES THE FOUR ABOVE COULD NOT SEE.** Four strings — two accepted, two rejected — is
   * the MINIMUM that looks like calibration, and the predicate agreed with all four while admitting
   * eight of thirteen sentences it had never met. Each group below is a defect that was measured
   * live, not imagined; deleting a group is deleting the proof that its shape is closed.
   */
  it("is not satisfied by a marker word in a clause about something else", () => {
    for (const bystander of [
      "This prototype shows that four beds are ready to admit right now.",
      "In the prototype, the average wait was eleven hours across the last seven days.",
      "There is no real difference between the two wards, and 28 referrals arrived.",
      "The placeholder logo aside, three teams have capacity today.",
      "Unlike the synthetic patient names, these bed counts are current.",
      "The ward names are invented; there were 28 referrals this period.",
      "Every figure here is invented; four beds are free.",
    ]) {
      expect(discloses(bystander), `a bystander clause satisfied the guard: ${bystander}`).toBe(false);
    }
  });

  /**
   * ⚠️ The inverted case, and the reason the word list had to go. Each of these asserts that the
   * figure is REAL — the exact claim the owner's ruling forbids — and the old predicate accepted
   * every one of them because the sentence contains the word it denies.
   */
  it("is not satisfied by a sentence that denies or withdraws the disclosure", () => {
    for (const denial of [
      "These figures are not invented — they are the current state of the network.",
      "This is no longer a prototype, and the eleven-hour figure is measured.",
      "Nothing here is synthetic any more; every bed count is live.",
      "These are not invented figures — they are live counts.",
      "The bed counts were invented until recently.",
      "These names used to be placeholders.",
    ]) {
      expect(discloses(denial), `a sentence denying its own disclosure satisfied the guard: ${denial}`).toBe(false);
    }
  });

  /**
   * The other direction, and it is not decoration. A guard that reddens honest work gets widened
   * until it means nothing — so these pin that the claim shapes did not buy their strength by
   * becoming brittle. **Every one of these passed the old word list too**; the shape change cost
   * nothing here, which is why the tolerance argument for bare words does not survive.
   */
  it("accepts the ways a person would really reword a disclosure", () => {
    for (const honest of [
      "The 28 referrals shown here are synthetic and were made up for the demonstration.",
      "The figures below are fictional.",
      "Every date in this trail is fabricated.",
      "The numbers are dummy data.",
      "This total is a sample value, not a measurement.",
      "The bed counts are illustrative only and do not come from any hospital system.",
      "The occupancy shown is not a real measurement of any ward.",
      "Nothing below is a real clinical record.",
      "This count is a placeholder until real data is connected.",
    ]) {
      expect(discloses(honest), `an honest disclosure was reddened: ${honest}`).toBe(true);
    }
  });

  /**
   * ① of Ward Lead's three-part ruling, 2026-09-11: **these are SPELLINGS of claims `MARKER` already
   * accepts, not new claims.** It knew *"nothing **here** is a clinical record"* and *"**no real**
   * person"*, and reddened on *"nothing **on this screen** is"* and *"**Nobody here is** a real
   * person"* — the same assertions, worded the way somebody actually writes them.
   *
   * ⚠️ **The negative cases below are half the point.** A spelling addition that also accepts a
   * denial has widened the SET OF CLAIMS, which is the opposite operation.
   */
  it("knows the other spellings of the claims it already accepts, and still refuses their denials", () => {
    for (const honest of [
      "Nobody here is a real person and nothing on this screen is a clinical record.",
      "Nobody on this screen is a real patient.",
      "Nothing on this page is a live clinical record.",
    ]) {
      expect(discloses(honest), `an honest disclosure was reddened: ${honest}`).toBe(true);
    }
    for (const dishonest of [
      "Everybody here is a real person.",
      "Nothing on this screen is out of date.",
      "Nobody on this screen is waiting longer than four hours.",
    ]) {
      expect(discloses(dishonest), `a sentence that discloses nothing was accepted: ${dishonest}`).toBe(false);
    }
  });

  /**
   * ② and ③ of the same ruling — **the population, not the rule.** A paragraph whose lead-in
   * announces a subject other than invention is not disclosing provenance and is excluded; one with
   * no lead-in at all stays IN, so omitting it cannot become the way out.
   */
  it("excludes a paragraph that announces a different subject, and never excludes one with no lead-in", () => {
    expect(paragraphSubject("<p><strong>What is real</strong>: the 8 departments.</p>")).toBe("What is real");
    expect(paragraphSubject("<p>There were 28 referrals this period.</p>")).toBeUndefined();

    expect(INVENTION_SUBJECT.test("Every figure here is invented")).toBe(true);
    expect(INVENTION_SUBJECT.test("What is real")).toBe(false);
    expect(INVENTION_SUBJECT.test("Two populations, kept apart")).toBe(false);
  });

  /**
   * 🔴 **THE OTHER END OF THE LOOPHOLE.** Excluding paragraphs by their declared subject means a
   * section could excuse itself entirely by labelling every paragraph *"What is real"*. **It cannot:
   * every provenance section must carry at least one paragraph the rule actually applies to.**
   *
   * ⚠️ This does NOT close the mixed-paragraph hole — an invented figure hidden inside a "what is
   * real" paragraph still gets through, and that is recorded at `PARAGRAPH_SUBJECT` rather than
   * quietly left. It closes the wholesale one.
   */
  it("refuses a provenance section in which no paragraph is about invention at all", () => {
    const { sectionsWithNothingIncluded } = provenanceSentences();
    expect(
      sectionsWithNothingIncluded,
      "a provenance heading whose every paragraph declares some other subject discloses nothing at all",
    ).toEqual([]);
    const witness = provenanceSentences([
      {
        file: `${ROOT}/witness.tsx`,
        source: "<section><h3>Prototype boundary</h3><p><strong>What is real</strong>: the departments.</p></section>",
      },
    ]);
    expect(witness.headings).toHaveLength(1);
    expect(witness.skipped).toHaveLength(1);
    expect(witness.sectionsWithNothingIncluded).toHaveLength(1);
  });

  /** A comment must neither satisfy this guard nor fail it — the artefact is what renders. */
  it("reads rendered prose only, never comments", () => {
    const withComment = withoutComments("/* <h3>What is invented</h3><p>There were 28 referrals.</p> */ const x = 1;");
    expect(withComment).not.toContain("28 referrals");
  });

  it("every sentence under a provenance heading says so in itself", () => {
    const bare = sentences.filter((sentence) => !discloses(sentence.text));
    expect(
      bare.map((s) => `${s.file} · under "${s.heading}" · ${s.text}`),
      "these sentences sit under a heading that says the data is not real, and do not say so " +
        "themselves. Read alone — quoted, screen-read, or after the heading has scrolled away — each " +
        "states an invented figure as fact. Owner ruling 2026-09-09 §2: the sentence carries the " +
        "marker, not the heading above it.\n\n" +
        "⚠️ IF YOUR SENTENCE IS HONEST AND THIS IS STILL RED, THE GUARD IS ASKING YOU TO SAY IT IN " +
        "THE SENTENCE, NOT TELLING YOU THAT YOU ARE WRONG. Bind the disclosing word to its verb or " +
        'its noun — "the figures ARE INVENTED", "those INVENTED FIGURES" — rather than leaving ' +
        "it loose in the clause, and check each half of a semicolon separately. If your wording is " +
        "genuinely new, add the whole CLAIM to MARKER on purpose, with a self-test case beside it. " +
        "Never add a bare word: a bare word is what let eight invented figures through as fact.",
    ).toEqual([]);
  });
});
