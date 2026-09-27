---
name: ward-flow-verification-lessons
description: "How a Ward Flow test looks like a guard and isn't — searching assertions, unvaried inputs, document-not-screen, and three restore traps that fake or destroy evidence"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 01a00060-be1a-7252-922f-b9dfc7a496b3
  modified: 2026-08-28T22:51:58.185Z
---

Verification failures found while executing Ward Flow plans across Phases 1 and 8. Every one
happened; none is general advice.

**A subagent's "typecheck clean" is a claim, not evidence.** One implementer reported it clean when
it was not; the repo stayed red across two tasks. Run it yourself every task.

**Passing tests did not catch a wrong value on every screen.** A past timestamp went to a countdown
formatter, so all 48 movements rendered "1h 35m overdue" at seven call sites — one under a column
headed _Wait_. Forty-three tests green, three reviews passed.

**A regression test nobody has watched fail is not yet a regression test.**

## ⚠️ The service a test gives you WITHOUT going red. Added 2026-09-03.

**A label change of mine was correct in the function and wrong in the sentence.** I joined an ED
destination to its purpose with an em dash. The boards prefix those lines with THEIR OWN em dash,
so a real row read:

    Also refused — Emergency department — For psychiatric review: Belongs to another service

**Two dashes carrying different meanings, on a label whose entire job is to stop one thing being
mistaken for another — the defect reproduced inside its own fix.** Changed to
`Emergency department (For psychiatric review)`.

⚠️ **I only saw it because five failing assertions PRINTED THE COMPOSED LINE.** They were failing
for an unrelated and expected reason — they pinned the old label. **Their diff output happened to
show me the sentence as a clinician reads it, rather than as the function returns it.**

**How to apply: this is a reason to keep tests that has nothing to do with them going red.** A test
that asserts on a COMPOSED, user-visible string — the whole row, not the fragment your function
returns — puts the output where a human can see it is wrong. **Prefer asserting the composed line
over the fragment, even when the fragment is what you changed.** Complements the entry above: green
tests missed a wrong value on every screen, and here a red test showed me a screen I had not opened.

## How a test looks like a guard and isn't (Phase 8, eleven instances)

- **An assertion that SEARCHES for a satisfying example is not an invariant.** It passes as soon as
  any example exists, including one the defect permits. A "distance never gates" test written as a
  search survived a real distance gate — it just found a different pair the mutant allowed.
- **An invariance test is only as broad as the inputs it varies.** A hidden gate reading the origin
  site survived a test varying only home region; a name sweep missed it because the gate had an
  innocuous name. Nothing in the suite caught the phase's founding-defect shape until both varied.
- **Invariance needs a companion pinning an absolute where answers SHOULD differ.** Uniformly wrong
  is still uniform, so invariance alone survives a function that refuses — or accepts — everyone.
- **"In the document" is not "on the screen."** jsdom does not hide closed `<details>` content, so a
  test that collapsed headings still show their counts proved only DOM presence. Moving the counts
  out of `<summary>` keeps every test green while a phone user sees blank bars.
- **A mutation that fails to bite is a QUESTION, not an answer.** "Test is fake" and "test is fine"
  look identical to "my probe never exercised the property".
- **A loose search pattern that matches everything reads exactly like a positive result.**

## Evidence you can stand behind

- **An absent signal reads exactly like a passing one** — a guard that never ran, a scanner that lost
  its place and reported clean, a retry loop exiting 0 while printing "STILL BLOCKED", a memoised
  gate exiting 0 having run nothing, a test file that never loaded.
- **A hash you computed and did not persist is a self-report.** Verify against something the
  repository can independently produce.
- **Byte-identical failure lines across different mutations mean contaminated, never consistent** —
  caused here by another worktree holding a heavy lease.
- **Check a report's evidence for internal possibility, not plausibility.** One claimed an assertion
  "still passed" under a mutation when the runner throws on first failure.

## Three restore traps that fake or destroy evidence

- `mutate.sh`'s restore check **cannot fail** — it copies the backup over the file, then diffs the
  backup against the copy it just made.
- `git checkout -- <path>` **cannot restore an untracked file**; it errors and leaves the mutation
  in place, invisible to a porcelain snapshot.
- `git checkout -- <path>` **destroys an uncommitted tracked file**, restoring from the index. It
  wiped a component under test.
- Restore only from bytes the harness captured itself. Compare porcelain against a pre-mutation
  snapshot and print it — never require empty, which is red every run in a shared worktree.

## A shape no test can reach: a correct unit invoked wrongly

**A derivation's tests cannot see a caller handing it the wrong set.** A panel called
`arrowTargets(admissions, now)` with the whole network's 267 records instead of the one ward's. The
function was correct; all nine of its assertions passed and **had to** — every test supplies its own
admissions, so the unit is never exercised against "is this the right collection?".

This is not a check that cannot fail. It is a well-tested unit called wrongly, where the tests are
**structurally incapable** of seeing it — more coverage would have produced more green assertions and
the same wrong screen.

**The detector was clinical plausibility.** Nothing in the repository caught it. What caught it was
rendering the panel and knowing a twenty-bed ward cannot discharge 180 people, and that "Kimberley 28"
against eighteen occupants is absurd. A test suite has no idea how many people fit in a ward.

**Rule: for any figure a clinician would read, ask whether the number is POSSIBLE, not only whether
the computation is right.** The two are independent, and only the first catches a correct function fed
the wrong data. Corollary: someone consuming a well-tested derivation will read its green tests and
reasonably conclude the call is safe — say so in the commit, not only in a ledger.

**Why:** tests catch what is broken, not what is plausible but false. That needs a human looking at
the rendered screen, or an assertion that cannot pass for the wrong reason.

**How to apply:** verify typecheck and test claims independently; require a watched deliberate
failure for every new assertion; ask of each one "can it fail, and for the reason it names?"; and
build a screenshot pass into every UI task.

See [[ward-flow-coordination-state]], [[checks-that-cannot-fail]],
[[run-the-test-before-prescribing-the-fix]].

## A correct, well-tested unit invoked wrongly — and clinical plausibility as the only detector

2026-08-29. Distinct from every check-that-cannot-fail shape, and worth separating from them.

Building the ward board's destinations panel, I called `arrowTargets(admissions, now)` where
`admissions` was the whole network's 267 records rather than the one ward's. The panel offered
**"Kimberley 28 people" on a twenty-bed ward and totalled ~180 against eighteen occupants.**

**Nothing failed, and nothing could have.** `arrowTargets` was correct. All nine of its assertions
passed and _had_ to: every one supplies its own admissions, so the function is never exercised
against "is this the right collection?" The defect lived entirely at the call site, structurally
out of reach of any test of that unit. **More coverage would have produced more green assertions
and the same wrong screen.**

**The detector had no substitute in the suite.** What caught it was rendering the panel and knowing
a twenty-bed ward cannot discharge 180 people. The suite has no idea how many people fit in a ward;
"Kimberley 28" is only absurd to someone who knows what a ward is.

> **For any figure a clinician would read, ask whether the number is POSSIBLE — not only whether the
> computation is right.** The two are independent, and only the first catches a correct function fed
> the wrong data.

**How to apply:** when consuming a derivation, do not take its green tests as evidence your call is
right — read what collection each of its tests supplies, and check the rendered figure against a
real-world bound (beds, occupants, hours in a day). Say so at the call site, because the next person
will read the derivation's nine passing assertions and reasonably conclude it is safe to call.

## "Is it in the document" is the wrong question for anything whose value is being SEEN

**Added 2026-08-30, from a marker that shipped invisible with every test green.**

A marker saying a patient was at an emergency department was rendered into the person panel. Every
assertion passed. On a real screen at 1440px **that panel is `display: none`** — so the element
existed, the suite was green, and a charge nurse scanning the ward grid saw nothing. Exactly the
defect the marker was written to fix.

**jsdom applies no stylesheet.** A DOM query finds an element CSS has hidden, so `getByTestId`
answers "is it in the document" and never "can anybody see it". For a fact whose entire purpose is
being read off a screen, those are different questions and only the second one matters.

**The fix is not a better assertion, it is a different question:** which SURFACE carries it. The
grid is what a ward scans without clicking; a fact that appears only after somebody opens the right
panel is not on the board. Assert the surface by name.

**Found by opening the app in a browser, which no test in the repository does.**

## Any new CSS rule that sets a `color` reintroduces the white-on-white print defect

Same night, four times, in a file whose print block **already documents this exact defect** — the
ward name, headline figure and occupant list had all printed white on white until somebody printed
the dark theme and looked. I read that comment and then added four rules that set a colour.

**The mechanism is what makes it invisible: the computed colour is CORRECT on screen and only wrong
against paper.** No test reading computed styles can see it; no test querying the DOM can either.
The global print reset forces black ink, and any rule in the file that sets its own `color`
overrides it — in the dark theme those tokens resolve near-white.

**Rule: a new rule that sets `color` owes a print rule in the same commit.** Not after somebody
notices a blank line on a printed sheet.

## A decision can be DECIDED, IMPLEMENTED, and still not PRESENT where it matters

**The fourth state, and nothing was tracking it.** The owner's `released` → `discharged` rename was
decided, built across 23 files, mutation-proven, and reported done — **and sat on one branch for
hours while every other session kept writing the old word into the line everyone builds from.**
Sixteen files of new code in the removed vocabulary before anyone checked.

Both halves were true: I landed it, and it had not crossed. **"Done" without a ref is not a claim
about the project, only about a branch.**

**How to apply:** after landing an owner decision, verify it reached the working line —
`git merge-base --is-ancestor <sha> <working-line>` — and say which of the four states it is in.
The compounding cost is the point: every commit added elsewhere in the old vocabulary is another
file the eventual merge must reconcile, and a rename colliding with new code is the class where a
take-both resolution compiles, passes, and leaves two spellings.

**A take-one-side merge instruction is silent about a rename crossing it.** "Take theirs wholesale"
was my own instruction and would have reintroduced `"released"` in the file the rename was most
about.

Related: [[checks-that-cannot-fail]] — that file is about checks that cannot go red; this is a
sound check that is simply looking elsewhere. Also [[observations-expire]].
