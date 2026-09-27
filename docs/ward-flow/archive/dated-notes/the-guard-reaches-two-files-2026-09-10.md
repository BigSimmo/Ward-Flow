# The invented-figure guard reaches two files out of seventy-six

**Ward Lead, 2026-09-10.** Measured on the master line
(`codex/task-ward-flow-live-state-20260831`), by me, and independently reproduced by three
read-only extraction passes over 39 of the 76 files. The three passes agree with each other and
with a measurement I had already made by hand, which is the only reason I am writing it down as a
number rather than as a suspicion.

---

## The number

    ward .tsx files in the tree                                        76
    files carrying provenance-disclosure prose (invented/synthetic/…)  51
    headings whose TEXT matches the guard's trigger                     3
    files those 3 headings live in                                      2

The three:

    src/components/ward-management/hub/hub-screen.tsx:900   <h3>What is invented</h3>
    src/components/ward-management/ward-management-modes.tsx:341  <h2>Prototype boundary</h2>
    src/components/ward-management/ward-management-modes.tsx:352  <h2>Synthetic decision audit</h2>

**`tests/ward-provenance-sentences-carry-their-own-marker.test.ts` can see nothing else.** Its
trigger is a heading tag whose text matches `/invented|synthetic|placeholder|prototype boundary/i`,
and it then reads the first `<p>` within 400 characters of it.

---

## 🔴 Why this is structural and not a coverage backlog

This is the part that changes what anybody should do next.

**The screens are not missing their disclosures.** They carry them. Fifty-one files do. The
disclosure convention this codebase actually uses is a **governance banner** — a `<span>` badge
reading "Synthetic prototype" followed by a paragraph — and it does **not** put the word "invented"
or "synthetic" in a heading tag. For example, and this is a real and good disclosure:

> `capacity-screen.tsx` — _"Every bed count, ward name and waiting patient on this screen is
> invented. No figure here describes a real hospital, and nothing on it is a clinical record."_

That sentence is exactly what the owner's ruling is about, it is fully compliant, and **the guard
cannot see it, because a `<span>` badge is not an `<h1>`–`<h6>`.**

So the gap is not "forty-nine screens have not been done yet". It is: **the guard keys on a
spelling of heading text, and the codebase's disclosure convention does not use headings at all.**
Doing the other forty-nine "properly" against this guard would mean rewriting compliant screens to
adopt a heading convention they do not use, in order to be seen by a check — which is the tail
wagging the dog, and it is not what the owner asked for.

---

## What this does to Ward Builder Four's three labelled beliefs

Four handed the guard over with three beliefs labelled explicitly as unverified. That labelling is
why all three could be checked at all, and it is the single most useful thing in their handover.

| Their belief                                                    | Verdict now                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. The other fourteen screens are compliant-but-unguarded.**  | **UNGUARDED: confirmed, and far more strongly than they claimed** — not fourteen, seventy-four, and for a structural reason. **COMPLIANT: still unmeasured**, though the extraction found governance banners carrying real markers on every screen that has one.                                                                           |
| **2. The paragraph-scoping catches every disclosure sentence.** | **Measured and FALSE.** A second `<p>` under the same heading is invisible: mutation arm B, green 4 of 4. Recorded at the scoping function.                                                                                                                                                                                                |
| **3. `MARKER` is neither too narrow nor too broad.**            | **Still open**, and now with evidence on the "too broad" side: the extraction found the regex excluding _"the three exception categories this prototype currently detects… of the six the specification names"_ — a sentence about FEATURE COVERAGE, not data authenticity, silenced solely because it contains the bare word "prototype". |

---

## ⚠️ And the anti-vacuity floor is sitting exactly on its population

The guard floors itself at `blocks >= 3`. **There are exactly 3 blocks.** So the floor has no
margin at all: any single one of them losing its heading — a `<h3>` becoming a `<div>`, a rename
from "What is invented" to "About this data" — takes the count to 2 and reddens.

That sounds like a floor doing its job, and mutation arm C showed it fire that way. **It is not.**
It fires because a count crossed a constant, not because a detector noticed a block going dark.
**Add a fourth provenance block and the identical loss takes 4 → 3 and passes in silence.** A
constant floor catches only the LAST unit that stops being measured.

This is the same shape as the two ward tests that went red today for the opposite reason — a flat
30-second ceiling over a page list that grows with the source document. **A constant compared
against a moving population decides its verdict by arithmetic rather than by what it is supposed to
be watching, in whichever direction the population happens to move.**

---

## What I am NOT recommending

**Do not widen the trigger to `<span>`, and do not widen it to banners.** The wider rule was already
built and measured once, by Four: **44 of 58 banner sentences flagged, and almost all of them were
correct.** Banners mix provenance with safety and scope statements — _"This board is not a medical
device."_, _"It places nobody: a coordinator decides every placement."_ — whose job is not
disclosure at all. A guard that reddens on those gets switched off rather than obeyed, and this
programme has recorded that failure enough times to stop re-committing it.

**What is worth doing is a question for the owner, not a decision for me**, because it trades one
kind of incompleteness for another and either way somebody has to say which they want. It is put to
him in the handover, in plain words, with the honest cost of each side.

---

## Option 2 is now priced by its own measurement, not a borrowed one

**Added 2026-09-10, after Ward Builder Four showed that the number I had been quoting was about a
different question.** I had been pricing "widen the trigger" with **44 of 58 banner sentences
flagged** — a measurement of a rule that read EVERY sentence in every banner. The option actually on
the table is narrower: keep the first-paragraph anchoring exactly as it is, and only widen what
counts as a trigger, from a heading tag to **any element whose own text names provenance** — which
is how this codebase actually marks a governance banner (`<span class="prototypeBadge">Synthetic
prototype</span>`).

**So I measured that exact rule, here, rather than reuse the other number:**

    blocks reached        35   (up from 3)
    sentences scanned     69
    would PASS            21
    🔴 would REDDEN       48

Six of the 48 are noise from my probe's crude JSX flattening, which mangles template literals in
`ward-management-console.tsx`. **Excluding those, it is 42 of 63 — two thirds — and almost every one
is correct prose:**

> _"This board is not a medical device."_
> _"It places nobody: a coordinator decides every placement, one at a time."_
> _"No bed is ever allocated automatically; a human here confirms every step."_
> _"Their suburb and its paired community team are the exception: those are real places and real
> pairings, taken from this repository's own catchment table."_

**The reason is structural, not a tuning problem.** A governance banner's first paragraph is where
this codebase puts its _safety_ statement, and the provenance statement is somewhere else in the
same banner — or is the badge itself. Widening the trigger therefore aims the marker requirement
squarely at the sentences whose job is not disclosure. **That is the same failure the 44/58 rule had,
arrived at from a different direction — which is why the old number reached the right conclusion
about this option despite being about a different one.**

⚠️ **Right conclusion, wrong evidence, and the evidence had to be replaced anyway.** Had the banner
convention been different, quoting the old figure would have produced a confident wrong answer, and
nothing would have caught it — the recommendation would simply have been right-looking. The number
above is the one that belongs to this question.

---

## ⚠️ "Two files of 76" is right, and the thing a reader takes from it is wrong

**Added 2026-09-10, at Ward Builder Four's flag, before anybody quoted this file at it.**

The number above counts what **one** guard reaches — the source-scanning one, keyed on a heading
tag. A reader will take it to mean _the owner's ruling is unenforced on the other 74 screens._
**It is not.** The statistics screens are covered by a **second, independent guard** with a different
mechanism: a DOM test that renders the real component and checks each `Invented figures` footnote
item, per item rather than per list. It reaches a population the source-scanning guard structurally
cannot, and the two are complementary rather than duplicated. **Nobody should undo either.**

**So the honest statement is two sentences, not one:**

> The source-scanning guard reaches 2 files of 76. A separate DOM guard covers the statistics
> footnotes. **Everything else is unguarded by either.**

⚠️ **A true number with a false implication is not caught by re-measuring the number.** This file
was accurate and would have misled anyone who read it alone — the correction came from a peer noticing
what the sentence would be _taken_ to mean, not from anyone finding an error in it.

## 🔴 And the second guard has the defect the first one just had

**Measured here, independently, by lifting both predicates verbatim and running the adversarial
corpus against them. Not relayed.**

    ["synthetic","invented","not measured","never a measurement","made up","random walk","not real"]
      .some(marker => sentence.toLowerCase().includes(marker))

                                                            service screen   primitives
    "There were 28 referrals this period."                  caught           caught
    "The ward names are invented; there were 28 referrals"  ADMITTED         ADMITTED
    "Unlike the synthetic patient names, these are current" ADMITTED         ADMITTED
    "The invented logo aside, three teams have capacity"    ADMITTED         ADMITTED
    "These figures are NOT invented — they are current"     ADMITTED         ADMITTED
    "Nothing here is synthetic any more; counts are live"   ADMITTED         ADMITTED
    "This referral count is not made up: it came from live" ADMITTED         ADMITTED
    "These are NOT invented figures — they are live counts" ADMITTED         ADMITTED

**7 of 8, both copies, and all four negations.** Bare topic words under `some(includes)` — the exact
shape closed on the source-scanning guard hours earlier. **A footnote item asserting that an invented
figure is real satisfies the guard by containing the word it denies**, on the very component that
produced the owner's ruling.

**It is in TWO files, not one** — `ward-statistics-service-screen.dom.test.tsx` and, with a shorter
list under `expectSays`, `ward-statistics-primitives.dom.test.tsx`. `expectSays` is `some()`, so the
weakest spelling sets the whole strength.

### ⚠️ The fix is the method, NOT the regex

The repaired source-scanning predicate **reddens one of the statistics screens' honest items** —
_"The bed occupancy is a random walk, not measured."_ `random walk` and `not measured` are statistics
vocabulary the other guard's claim list does not carry. **The method transfers; the list does not.**
Pasting one into the other reddens honest prose on day one, and a guard that reddens correct work
gets switched off rather than obeyed. Whoever repairs it rewrites **their own** vocabulary as claims
— `is a random walk`, `is not measured` — and re-runs **their own** arms.
