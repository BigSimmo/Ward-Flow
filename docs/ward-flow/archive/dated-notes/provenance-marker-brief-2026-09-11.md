# The provenance-marker brief

**What this is for.** Every figure in Ward Flow is invented. The owner's ruling (2026-09-09 §2) is
that **the number carries that it is invented** — not the page, not the heading, not a banner
somewhere above it. This brief says what a screen must do to satisfy that, and what proof counts.

**Why it exists.** Several screens carry a task shaped _"every figure carries the marker where it is
read"_, and until now there was no brief saying what that means. 🔴 **A screen built against a
done-when nobody can evaluate produces work nobody can reject — and it does so faster than anyone can
stop it.**

**Status.** Draft for adversarial pass. 🔴 **This brief defines how we prove a marker is correct. It
must not be the one artefact nobody attacks.** §7 is the attack surface, written by its own author,
and it is the first section a reviewer should read.

---

## 1 · The finding this brief is built on

**Every marker failure measured on this programme is one shape: a screen holding the figure in one
place and its provenance in another.**

| case                                         | shape                                                                                      | outcome                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------- |
| Patient search (Lane C, closed)              | a correct refusal; a sibling live region announced _"Nobody matches."_                     | **two sources, they drifted**   |
| Search hub (closed)                          | ten invented team names rendered clean under a banner saying the network was real          | **two sources, they drifted**   |
| Community statistics (open)                  | a panel refuses to call a figure a measurement; the panel 29px below prints it bare        | **two sources, they drifted**   |
| `StatFootnote` (closed, produced the ruling) | heading _"Invented figures"_ over an item reading _"There were 28 referrals this period."_ | **two sources, they drifted**   |
| Search hub, the fix                          | the `" (placeholder)"` suffix travels **inside the value**                                 | 🟢 **one source, cannot drift** |

🔴 **The fix that worked did not add a guard. It changed the data shape.** From
`hub-derivations.ts:120`:

> _"the suffix is the mechanism by which it says so **at the point of the claim**, on every screen
> that renders the name, **without a second disclosure that can drift out of step with the first**."_

⚠️ **And note what that sentence buys: it is true on screens nobody has written yet.** A guard
protects the screens it reaches. A value that carries its own provenance protects every screen that
renders it, including future ones.

---

## 2 · The rule

**A rendered figure that is invented must carry its provenance in the same value the reader
receives.**

Three things follow, and each is a rejection criterion:

1. **Not in a second element.** A caption below, a footnote, a banner above, a heading over a list —
   each is a second source and each can drift. **They are permitted as well, never instead.**
2. **Not in a layer the reader may not get.** A visual badge does not reach a screen-reader user; an
   `aria-label` does not reach a sighted one; neither survives the figure being copied into a
   message. 🔴 **"Where it is read" means every layer it is read in.**
3. **Not conditional on the reader having arrived from somewhere.** A marker that depends on the
   heading still being on screen fails the moment the page scrolls.

### 2.1 What is NOT in scope

- **Safety and scope statements.** _"This board is not a medical device."_ _"It places nobody: a
  coordinator decides every placement."_ ⚠️ **These are not provenance and must not be swept into it.**
  The badge-anchored rule that tried was measured at **44 of 58 banner sentences flagged, almost all
  correct** — a guard that reddens correct work gets widened until it means nothing.
- **A whole-screen limit.** _"What this page cannot see"_ is the best absence artefact in this
  repository and it does a **different job**: it says what is outside the page's reach. 🔴 **A
  per-figure claim still wants its marker on the figure. Those are two jobs and the panel only does
  one.**
- **Absence states.** Six of them, kept distinct elsewhere. A figure that does not exist is not a
  figure that is invented.

---

## 3 · How to satisfy it

**In order of preference. Reach for the second only when the first is impossible, and say why.**

### 3.1 Structural — the marker is part of the value

The figure and its provenance are one thing, constructed together, impossible to render apart.

```ts
type Figure = { readonly value: number; readonly provenance: "invented" };
```

🔴 **The test of a structural marker: can a caller render the number without the provenance?** If the
answer is yes — because the field is optional, because a template reads `.value`, because a helper
strips it — **it is not structural, it is a convention, and conventions are what drifted in every row
of §1.**

**Precedent that works:** `" (placeholder)"` appended at source in `hub-derivations.ts`, rendered
verbatim, **never stripped**.

### 3.2 Compositional — one component renders both, and nothing else renders the figure

A single component owns the pairing; the raw number is not exported to anywhere that could render it
alone.

⚠️ **This is weaker than it looks and the weakness is measurable:** it holds only while nothing else
can reach the number. **The rejection criterion is a reachability check, not a review.**

### 3.3 Textual — prose that carries the marker in the sentence

**Last resort.** This is what the existing guard checks, and §4 is why it is last.

---

## 4 · 🔴 Why a text guard cannot be the proof, with the measurements

The repository has one: `tests/ward-provenance-sentences-carry-their-own-marker.test.ts`, 443 lines.
**It is well built, its author documented its limits honestly, and it still cannot carry this.**

| limit                   | measured                                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **population**          | reaches **2 files of 76**. Fourteen screens are **unexamined, not compliant**.                                                                                                                      |
| **anchor**              | only prose under a heading matching `/invented\|synthetic\|placeholder\|prototype boundary/i`. A visible figure two lines away is not walked.                                                       |
| **floor**               | sentences under **25 characters are dropped before testing**. _"There were 28 referrals."_ is **24** — the guard's own canonical defect, four words shorter, never examined.                        |
| **self-test blindness** | the calibration cases call the predicate **directly**, bypassing the population filter. 🔴 **The predicate is proved strong over strings the corpus filter would never hand it.**                   |
| **polarity**            | a substring test has none. _"These figures are not invented"_ once **passed** by containing the word it denies. Fixed by matching whole claims; **the class is live for every future alternative.** |
| **layer**               | reads source text, so it cannot distinguish rendered prose from a live region's content — it only ever sees the source either way.                                                                  |

⚠️ **The owner ruled on 2026-09-10 to leave that guard's reach at 2 and that ruling stands.** **This
brief does not propose widening it.** It proposes not depending on it.

🔴 **And never widen `MARKER` with a bare word.** A bare word names a subject, so a bystander clause
carries it for free: _"This prototype shows that four beds are ready to admit right now."_ passed on
`prototype`. **Whole claims only, each with a self-test case proving the negation still fails.**

---

## 5 · The done-when

**A screen satisfies this brief when all five hold. Each names what would falsify it.**

1. **Every invented figure the screen renders is reachable only through a value carrying its own
   provenance (§3.1), or through one component that renders both (§3.2).**
   _Falsified by:_ a call site that renders the number alone. **Proved by a reachability check over
   the exports, not by reading the screen.**

2. **The marker reaches every layer the figure reaches.** Visible text, accessible name, live-region
   announcement, and the text produced by any copy or export action.
   _Falsified by:_ a figure present in one layer and a marker absent from it. 🔴 **The export action
   is in scope: _Export the figures_ is this family's primary, and a CSV of bare numbers is the
   figure leaving the building without its marker.**

3. **No sibling on the screen contradicts it.** While a figure is marked invented, nothing else
   mounted may present the same figure as measured.
   _Falsified by:_ two components making incompatible claims about one subject. ⚠️ **This is the §U
   check and it is NOT a static read — it needs the screen rendered.**

4. **The proof is not satisfiable by prose.** No comment, no heading, no banner sentence may turn the
   check green.
   _Falsified by:_ adding a comment quoting a compliant sentence and watching the check pass. **Run
   that mutation; it is two minutes.**

5. **The population is proved, not assumed.** The check states how many figures it examined and how
   many exist, and goes red when a figure stops being examined.
   _Falsified by:_ a figure that leaves the population without anything going red.

### 5.1 🔴 The anti-vacuity invariant must be RELATIVE

**A constant floor catches only the last unit to stop being measured.** Measured on the existing
guard: wrapping a block's prose in `<span>` made its paragraph scan return nothing, the block count
fell 3 → 2, and a floor of `>= 3` went red — **which looks like the floor working and is arithmetic.
Add a fourth block and the identical mutation takes 4 → 3 and passes in silence.**

**So:** every figure the walk finds must yield an examined figure, and one that goes dark is **named**
— at any population size.

---

## 5.2 · 🔴 How this relates to §8.7's check array — asked by Ward Lead, and the answer is that they are not competitors

**The worry is fair on its face:** a check array is a **second place** by construction — the figure
renders on the screen, the check reports in the shell — **and §1 says every marker failure on this
programme is a two-place drift.** **So does §8.7 reintroduce the defect this brief exists to close?**

**No, and the reason is that they carry different KINDS of claim.**

|                              | **provenance**                                              | **reconciliation**                                                                                  |
| ---------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| what it asserts              | this figure is invented                                     | these figures agree with each other                                                                 |
| whose property is it         | **one value's**                                             | **a RELATION between values**                                                                       |
| can it live inside the value | **yes — §3.1**                                              | 🔴 **no. No single figure knows about the others**                                                  |
| how it fails                 | **DRIFT** — the marker stays behind when the figure travels | **VACUITY** — the sentence claims agreement that was never computed                                 |
| what stops it                | put it in the value                                         | derive it from the checks every render, and never let _nothing checked_ read as _everything agreed_ |

🔴 **So §8.7 is not a rival to §3.1. It is the correct home for the half §3.1 cannot carry.** ⚠️ **A
relation cannot be stored in one of its operands.** **Insisting it travel inside the value would not be
stricter; it would be impossible, and an impossible rule gets quietly dropped.**

### 5.2.1 What §8.7 already gets right, measured at `6b150a8b2a`

**`reconciliationSentence()` is pure and derived on every call — never a stored string.** And the
vacuity hole is **already closed**:

```ts
if (checks.length === 0) return "No reconciliation is available for this page yet.";
```

> _"🔴 AN EMPTY ARRAY IS NOT 'EVERY CHECK PASSED'. It is the fact that nothing was reconciled at all,
> and this sentence must never present the two as identical."_

⚠️ **And its own measurement: nothing under `src/` builds a check array yet, `layout.tsx` passes `[]`
on every ward route, so that sentence is currently the ONLY one the component produces in the running
app.** **The agreeing branch was unreachable-in-production reassurance rendered as visible text on
every screen.**

⚠️ **I read the pre-fix version first, off a branch base two commits behind, and was one step from
reporting a closed defect as live.** **Measuring a guard against a stale tree reports the absence of a
fix that exists.**

### 5.2.2 🔴 The one thing §8.7 does NOT solve, and this brief must say so

**An empty array no longer reads as agreement. A NON-EMPTY array that does not cover the page still
does.**

**Three checks passing says three things agree. It says nothing about the fourth figure — and the
sentence it produces, _"Invented figures, reconciled with each other"_, is a claim about the page.**

🔴 **That is §5.5's population problem one level up: the predicate is sound and the population is
unproven.** ⚠️ **And it is the more dangerous half, because a populated check array looks like
diligence in a way an empty one does not.**

**So a screen adopting §8.7 owes a population proof as well as its checks:** every figure the screen
renders is either covered by a check or is named as not covered. **Falsified by:** a figure that
enters the page without entering the check array, with nothing going red.

### 5.2.3 And the sentence carries BOTH claims at once

_"**Invented figures**, reconciled with each other"_ is a provenance claim and a consistency claim in
one line. ⚠️ **Its provenance half is a second source relative to the figures it describes — exactly
what §2.1 forbids as a substitute.** ✅ **It is permitted as well: the rail says the page's figures are
invented, and §3.1 still requires each figure to say so itself.** 🔴 **A screen that relies on the rail
sentence for provenance has put its marker in a component it does not own, one that renders a different
sentence entirely when no checks are supplied.**

---

## 6 · What a reviewer must reject

Written as a list because every one of these has shipped here at least once.

- **A catcher that is green, named in the brief, and independent of the task.** §4.1 Task 3's named
  catcher exercises five figures the task does not touch. 🔴 **A brief with no nameable catcher is a
  defective brief; one with a name nobody checks is worse, because nobody goes looking.**
- **A done-when that pins a retired wording.** Green would certify the defect.
- **A done-when that introduces the vocabulary it thinks it is enforcing** — _"Available is the only
  word for a free bed"_ on a screen whose word is **Ready**.
- **A "keep" with nothing to keep.** Preserving nothing is indistinguishable from doing the task, and
  the builder reports it done, honestly.
- **A marker added to the caption instead of the figure.** This is the whole brief. It will look like
  compliance and it is §1 again.
- **A guard whose predicate is proved and whose population is not.**

---

## 7 · 🔴 Attack this section first — the author's own case against this brief

1. **§3.1's cost — I attacked this myself and the attack changed the answer.**

   **My first proxy** (`{x.length}`, `{x.count}`, `{fn()}`) gave **26 call sites across the four
   screens** — 6, 6, 12, 2. ⚠️ **That is obviously an under-count: the ED screen does not render two
   figures.** **A generous upper bound** (every JSX interpolation less `className`, `key`, `href`,
   `aria`, comments) gives **343** — 116, 86, 43, 98 — and most of those are strings and
   conditionals, not figures.

   🟢 **SETTLED BY AN AST PARSE, NOT A REGEX. THE ANSWER IS 71 MARKER CALL SITES.**

   | file                              | call sites                                           |
   | --------------------------------- | ---------------------------------------------------- |
   | `statistics-screen.tsx`           | 25                                                   |
   | `statistics-ward-screen.tsx`      | 20                                                   |
   | `statistics-ed-screen.tsx`        | 15                                                   |
   | `statistics-community-screen.tsx` | 11                                                   |
   | **total**                         | **71** — 69 if two configured constants are excluded |

   Counted with the TypeScript compiler API over every `JsxExpression` node, then hand-classified.
   ⚠️ **Comment-proof by construction: a container holding only a comment parses with
   `expression === undefined` and never enters the candidate set** — which is exactly the trap that
   made both greps useless. **Four sites spot-checked against the source by hand and all four matched.**

   ✅ **So §3.1 is adoptable. 71 marker call sites is a day of edits, not a rewrite.** **The instinct that said "hundreds
   of figures, therefore hundreds of edits" was wrong, and the reason is that the cost falls per CALL
   SITE, not per rendered figure:** **9 of the 71 marker call sites sit inside a `.map()`**, and the community
   comparison table alone renders three figures for every team in the network **from three call
   sites**. **Everywhere else it is 1:1.**

   ⚠️ **Two judgement calls the counter flagged rather than buried, and a reviewer may take either:**
   `PARALLEL_REFERRAL_CAP` and `COMMUNITY_TEAM_PAGES.length` are rendered as numbers a reader sees but
   are configured constants rather than derived data — **excluding them gives 69**. And one site
   renders a duration only inside an SVG `<title>` tooltip, which is a figure by the letter of §2 and
   arguably decorative. **Neither changes the order of magnitude, which is the thing the decision
   turned on.**

2. **§5.2's export clause may be unbuildable as written.** A CSV row carrying _"28 (invented)"_ in
   every cell may be unusable as a spreadsheet. 🔴 **I do not know the right answer and have not
   proposed one — a header row is a second source and fails §2.1, and per-cell may fail usability.
   This is an open question, not a solved one, and it is the clause most likely to be quietly
   dropped.**
3. **§5.3 needs a rendered screen and this programme's sweeps are static.** ⚠️ **A static check will
   report "no contradiction" when it means "none that co-mount unconditionally in source".** **If §5.3
   is proved statically, this brief has reproduced the exact failure it was written to stop.**
4. **The §1 table is five cases and four are closed.** **A pattern drawn from repaired defects may be
   a pattern about what gets repaired, not about what occurs.**
5. **This brief is prose, and §5.4 says the proof must not be satisfiable by prose.** ⚠️ **It does not
   exempt itself: nothing here goes red if a screen ignores it.** **Until §5's five criteria exist as
   a runnable check, this document has exactly the standing of the banner in §1 — a claim in a second
   place, which the screen may drift away from.**

---

## 8 · Sources

Every claim is measured; these are where.

- `tests/ward-provenance-sentences-carry-their-own-marker.test.ts` — the guard, its limits section,
  the 2-of-76 measurement, the 25-character floor, the bare-word polarity history.
- `src/components/ward-management/hub/hub-derivations.ts:120` — the suffix that travels inside the
  value, and the incident that produced it.
- `src/components/ward-management/statistics/statistics-community-screen.tsx` — the open
  contradiction; 29px between the disclaimer and the figure, rendered and measured.
- `src/components/ward-management/statistics/statistics-compare-screen.tsx:332` — `cannotBeFormed()`,
  the shape §3.1 generalises.
- Owner ruling 2026-09-09 §2; reach-at-2 ruling 2026-09-10; D-8.
