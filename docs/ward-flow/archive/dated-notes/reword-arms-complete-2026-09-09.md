# The reword arms, RUN — complete for one range, 2026-09-09

**Ward Builder Two (2026-09-08/09 session).** Worktree `D:/Worktrees/Database/ward-refusals-visible`,
branch `ward/reword-arms-20260909`. Supersedes `reword-arms-run-2026-09-08.md`, which stopped at 9.

**Every site in my range now has both arms run on the REAL components.** Not a text-level simulation:
each result comes from editing a real sentence in a real screen, running the real test, and restoring.

---

## 🔴 THE UNIT, because four numbers are in circulation and none of them said what they counted

**121 call sites across 23 files.** Defined as: occurrences of `expectSays(`, `expectCaption(` or
`expectNeverSaysAgain(` in `tests/ward-*.test.ts` and `tests/ward-*.test.tsx`, **with comments
blanked first** (a mention inside a docblock is not a call site), excluding the helper's own
definitions in `tests/helpers/ward-caption.ts`.

    121  all call sites, 23 files
     −3  INERT — inside `describe.skip` in ward-morning-page (the owner's 2026-09-06 retirement).
         They are green, they are counted, and they never execute.
     −61 outside my range (ward-statistics-*, ward-ed-*, ward-pull-vocabulary)
    ————
     57  MY RANGE.   11 done 2026-09-08.   46 done today.   1 not independently measurable (below).

**Why the other figures differ, so they can be reconciled rather than argued:** `grep -c "expectSays("`
gives **109/22** — it cannot see `expectCaption` (4 sites) or `expectNeverSaysAgain` (11), and does not
blank comments. The audit's **95** was measured on 2026-09-05 and the population has grown since. The
**119** in the 09-08 report was that day's count. **All four are right about different things.**

> ⚠️ Nobody should quote any number for this work without saying which of those it is.

---

## Result

    56 of 57 measured.  1 not independently measurable.
    46 DEFECTIVE (82%)  ·  10 sound and now PROVEN sound  ·  all 46 fixed and re-proved on both arms

Every fix was re-run against the original mutation afterwards. A widening that also killed the
deletion arm would trade a guard that fires on correct work for one that cannot fire at all, and
that check is the only thing that catches it.

## The two defects, which present identically and need opposite fixes

**TOO NARROW — reddens on honest work.** The screen is reworded faithfully and the test goes red.
This is how guards get deleted, and the honest ones go with them in the same tidy-up.

- `["not a live statewide", "statewide"]` went RED on **"state-wide"**. A hyphen.
- `["named this team", "names this team"]` — one verb in two tenses, RED on the noun form.
- `["does not mean"]` — a single idiom, RED on "is not proof", which says the same thing.

**TOO BROAD — cannot detect its own subject being removed.** One listed spelling is guaranteed
present for a reason unrelated to the claim, so the other never has to hold.

- `["left"]` — the fixed prefix of every departure line, including the ordinary one.
- `["1 ", "bed pulled"]` — "1 " supplied by a different count two clauses earlier.
- `["UM100002", ...]` — the record number **the test itself typed**, echoed back by the component.
- `["urgent", "urgency"]` — the bare word survived in the _next sentence_ after the guarded clause.

⚠️ **A site can carry both at once.** `["this prototype"]` was disclaimer boilerplate (loosely tied to
its claim) _and_ a single literal (red on an honest reword). **Widening on sight would have fixed the
narrowness and made the looseness worse.**

---

## 🔴 The four findings that are not about brittleness

**1. A guard that BLESSED the reversal of its own clinical caveat.** The community table carries a
caveat that it does **not** show who is currently under a team's care — nothing in the model records a
team closing anybody. Its guard read `["does not say", "still with"]`. Those words appear in the
caveat **and in its exact opposite**. I put _"This table shows the people still with this team today,
and who remain under its care"_ on the screen — a false clinical claim — and **37/37 passed.** A
second, identical case sat in the same paragraph. **This is not a guard that fails to protect; it is
one that supplies false assurance.**

**2. An absence rendered as a fabricated figure, undetected.** The unrecorded-departure line exists so
an absence is never printed as a duration — the test is named _"an absence, never a zero"_. Because
`"left"` satisfied it, I rendered _"Left this ward 3 weeks ago"_ for a departure whose time nothing
holds, and **37/37 passed.** The sibling bans on `"0 days"` and `"today"` missed it too.

**3. A guard that was a TAUTOLOGY over its own locator.** The handover test found its paragraph with
`getByText(/fill right now/iu)` and then asserted `["fill right now"]` on it. **If the locator
succeeded the phrase was present.** It could not fail at all. The real protection was a literal regex
— the most brittle thing available — with a tolerant helper underneath taking the credit. **A
text-level arm cannot see this**: the text is real, the spellings match, the predicate is sound. The
defect lives between the query and the predicate. Fixed by making the locator structural, not by
touching the spellings.

**4. ALL THREE BANS ARE DEFEATED BY PARAPHRASE — measured, first time in this programme.**
`expectNeverSaysAgain` had never been through any arm. Both arms now run:

    the retired phrase put back VERBATIM   -> RED on all three. They work for the wording they retired.
    the SAME FALSE CLAIM, PARAPHRASED      -> GREEN on all three. Not one fired.

### 🔴 SECOND CORRECTION, 2026-09-10 — THE CORRECTION BELOW DID NOT SWEEP THE CLASS IT NAMED

**The section below says I measured these bans' predicates and called them guards, and names ban 312
as the instance. There was a fourth ban in this range it never reached** — `ward-referral-screens`,
which read a single banner. Found only because Ward Lead restated the ban rule at me while I was
working in a different range, and I went back to check my own.

    "Those people are here because this prototype holds no travel time for their home region."
    rendered in a NEW element on the same board   ->   105 of 105 PASSED

That is the retired single-cause explanation, back on screen verbatim, one element from the ban that
exists to forbid it — and it was **false for every patient this prototype places from an emergency
department**. It reads the whole board now, with a measured floor, and both arms are proved.

⚠️ **THE LESSON IS ABOUT CORRECTIONS, NOT ABOUT BANS.** A correction is scoped to the thing it was
written about. **Writing "I measured the predicate and called it the guard" did not make me go and
re-check every other guard I had said that about** — it closed the instance and left the class open,
in a document whose whole subject is that closing an instance is not closing a class. The only thing
that reopened it was a peer restating the rule against a different file.

⚠️ **And the first probe of it was unattributable and is not the evidence above.** Appending the
retired phrase to the existing sentence reddened three tests that pin that sentence verbatim, with no
ban named at all — a red I could not attribute, which is its own documented trap in this report's
method section. Re-run in an element nothing pins.

**Every ban in both ranges is now page- or board-scoped, and none depends on a sibling ban's list for
its cover.**

### 🔴 CORRECTION TO THIS SECTION, SAME DAY — I MEASURED THE PREDICATE AND CALLED IT THE GUARD

**The paragraph above was published saying all three bans were "measured, both arms". That was true
of their PREDICATES and false of the guards.** Ward Builder Three pointed out the asymmetry from a
different angle; measured here immediately afterwards:

    ban 312 read ONE ELEMENT, not the page. I put the retired phrase "no such field" into a
    NEIGHBOURING element on the same page.  37/37 PASSED — a withdrawn false claim back on the
    screen, and the ban that exists to catch it looking somewhere else.

**The standing ruling — "narrow what is READ, never lengthen the spelling list" — is right for a
POSITIVE claim and WRONG for a BAN, and the two run in opposite directions:**

|                    | wide query                                  | narrow query                   |
| ------------------ | ------------------------------------------- | ------------------------------ |
| **positive claim** | a BYSTANDER satisfies it — the defect       | correct                        |
| **ban**            | correct — the phrase anywhere is the defect | the phrase elsewhere is UNSEEN |

⚠️ **Narrowing a ban weakens it while looking exactly like the sanctioned repair, and passes every
arm.** Applying the ruling uniformly across bans would have made all three worse.

**What makes a page-wide ban safe is an anti-vacuity floor** — `expect(page.length).toBeGreaterThan(500)`
— because a page that rendered nothing passes every ban trivially. One sibling ban in the file already
carried one; the other two did not. Both now do. ⚠️ **The floors were first labelled ADOPTED, NOT PROVED. They are now MEASURED, and the measurement
changes what they may be claimed to do.** Ward Builder Three suggested proving one by rendering with
an empty dataset rather than by mutating. Done — the emptiest LEGITIMATE render of that screen (a real
team, zero admissions, zero referrals) is **9,380 characters, nineteen times the floor of 500**.

> **So the floor cannot detect a PARTIAL render. It is a tripwire against a TOTAL one — a throw, or a
> component returning nothing — and it is sound for precisely that and nothing more.**

Left at 500 deliberately. Raising it toward 9,380 would make it redden on honest content shrinkage,
which is the very defect this branch spent the day removing. **The useful output was not a stronger
floor; it was knowing the floor's reach — 19x of headroom means every real regression passes it.**

> **This is the same distinction I had written up an hour earlier for the tautology finding — a guard
> is PREDICATE PLUS QUERY — and I applied it there and not here. A green result on the half I tested
> read as a result about the whole guard. That is the exact error this document is about, committed
> inside the document.**

⚠️ **Deliberately NOT fixed by widening the spelling lists, and the restraint is still the finding.** A ban forbids, so every spelling
added is a new way to redden honest copy — this page legitimately says _"does not mean everybody is
being followed up"_ three lines from a ban on _"nobody is missing follow-up"_. A fourth paraphrase
would walk through anyway; an unbounded set cannot be enumerated. **Treat these as tripwires on a
known wording, never as evidence the claim is absent.** Where a claim can be checked against the
MODEL instead, that retires a ban properly — two of the three look eligible, and that is an owner
decision, not a test-file one.

---

## ⚠️ THE PATTERN THAT BEARS ON WHETHER TO CONTINUE THIS PROGRAMME AT ALL

**Five times, the assertion that caught a real regression was an UNCONVERTED verbatim pin** — the
old style this conversion is replacing — sitting beside a converted guard that missed it.

And converting one guard can buy **nothing**: on `ward-governance` all three were widened, re-proved,
and the file still reddened on the identical reword, because two unconverted pins held the same
sentence. **The benefit is capped by the pins left standing, and the population count cannot show it,
because it only counts conversions.**

> A verbatim pin cannot be satisfied by a bystander word. A concept list can. That is the trade the
> conversion makes, and until today nobody had priced it.

---

## Method — every clause earned by a failure

1. **One mutation per assertion.** Sites in one `it()` are sequential: the first failure aborts and
   later assertions **never execute** while the file goes red and reads as proof of all of them.
   ⚠️ **This bit in both directions.** It hid a break I thought I had proved, and — worse — it hid a
   site I recorded as _sound_ because it stayed silent in a batch. **A false "sound" closes the
   question; a false "measured" only delays it.**
2. **Read WHICH subject the failure named, never the colour.**
3. **Test a candidate spelling against the BROKEN text, never against the reword that suggested it.**
   A spelling drawn from the reword always matches the reword. My first fix for one site passed a
   green suite and was still unfailable — the word I chose appeared in three other sentences of the
   same paragraph.
4. **Restore by writing the captured original back, then prove it with an empty `git diff` AND a
   green run.** Matching bytes are not proof the run was clean.
5. **Confirm the mutant reached the text under test.** One mutation of mine never rendered in the
   target test — a null result that is not evidence about the guard.

⚠️ **My own instrument under-reported once**, scraping only `expectSays`'s failure wording, so an
`expectCaption` failure appeared as a test that failed with no subject named — a guard that had fired
recorded as silent. Widened to all three helpers' shapes. **An instrument that under-reports failures
is the same defect class as the guards being audited.**

---

## The one site not independently measurable

`ward-screen:434` asserts the same concept, on the same element, from the same sentence as
`ward-screen:411`, later in the same test — 411 before an add-then-end cycle, 434 after. **Any content
mutation reaches both, and 411 aborts the test first.** Its distinct value is temporal (the list
returns to empty), not textual, and that is carried by the surrounding assertions. **Recorded as
structurally covered, NOT as measured** — those are different, and conflating them is the habit this
whole exercise exists to break.

## Not done, so it is not assumed

- **The other 61 sites** (`ward-statistics-*`, `ward-ed-*`) are untouched and unmeasured by me.
  ⚠️ Statistics ownership was unresolved as of today and two chats were pointed at it; I declined it.
- **`ward-pull-vocabulary` stays unconverted** and must — its pins hold the WORD on the screen after
  the hold→pull rename, and converting them would gut it.
- **No structural reword was tried.** Every reword changed words inside an existing element. A
  redesign that MOVES an element is still unexercised — and finding #3 shows that is exactly where a
  text-level arm is blind. **That gap is inherited, not closed.**
- **Nothing was opened in a browser.** Every result is a property of a jsdom render.
- **The 26 other "dead alternate" candidates** flagged by the 2026-09-05 pass were not swept. One site
  here carried a spelling that could never match its own sentence — `"not an area"` against
  _"not a picture of an area"_. A dead alternate reads as redundancy that is not there.
