---
name: a-control-must-test-the-premise-not-the-measurement
description: "write the control before trusting the scanner, test the premise not the measurement, and beware a control shaped conveniently or prescribed in the wrong direction"
metadata:
  type: feedback
---

**Consolidated 2026-09-06 from 7 separate memories on one subject**, written from different chairs across a night of six parallel sessions.

⚠️ **Nothing is summarised — each section below is its original entry verbatim.** The merge exists because the index
that points at these has a hard size limit: 7 index lines for one subject crowd out 6 unrelated
memories, which then do not load at all. The only thing given up is recalling one of these without the others.

---

# a-control-must-test-the-premise-not-the-measurement

> every anti-vacuity control we wrote tested whether the method could FIND something, never whether the thing was a defect — so a wrong premise passes them all, and passes more convincingly than a right one

**Every control in this programme has the same shape, and it is the wrong shape for half the claims
it is asked to protect:**

    "confirm your method finds the KNOWN instance ... if you cannot reproduce it,
     your method is broken and every clean answer it gives is worthless"

⚠️ **That tests whether the method can FIND something. It never tests whether the thing is a
defect.** A wrong premise passes it — and passes _more_ convincingly than a right one, because
reproduction feels like confirmation.

**The worked example, 2026-09-04.** A finding said 17 of 30 generated movements were in a state the
reducer refuses to create. Its control independently recomputed 17 from `300 % 7` and the array
positions rather than copying the brief's number — and I called it "the strongest control anyone has
run tonight". **It was strong and it was irrelevant.** It derived _how many records are in that
shape_, which nobody disputed. The contested claim was that **the shape is impossible**, which lives
in the reducer, which the control never opened. The reducer's membership test turned out to be a
**precondition consumed by the transition** — checked, then cleared by the same update — so all 17
were reachable. The owner had approved a repair on that number, and the repair would have
reintroduced an already-fixed defect.

**Two claim types, two different controls:**

| Claim                      | Control                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| "N instances exist"        | recompute N independently. Sufficient.                                    |
| "X is an impossible state" | **try to reach X through the real transitions.** Nothing else touches it. |

Conflating them inside one brief is what happened. And the reachability guard built separately — one
that drove the reducer — is what found the genuine finding (5 movements, not 17) without being asked.

⚠️ **The relay failure on top:** "derived independently" was read as "verified" by two people in
sequence. They are different properties. **A control can only test the step it covers, and nobody
asked which step was load-bearing.**

⚠️ **Severity contamination.** A brief's headline number calibrates every finding the agent then
ranks against it. A headline five times too large inflates the whole ranking, even where the
individual findings are sound. The fix is not to re-run: **discount the ranking, keep the findings,
and take each on its own evidence.**

**How to apply.** Before writing a control, say in one sentence which claim it protects, then ask:
_could this control pass while that claim is false?_ If yes, it is testing the measurement and the
premise is unguarded. Related: [[compliance-without-coverage]],
[[a-green-mutation-only-counts-if-the-mutant-ran]], [[a-property-that-does-not-discriminate]],
[[floor-the-denominator-never-the-numerator]], [[measure-the-thing-not-a-proxy]].

## 2026-09-05: THE LEVEL ABOVE THE CONTROL — I PROVED THE CONTROL AND NOT THE GATE

A file scanner of mine seeded a copy with a bad byte, required the seeded copy to be FLAGGED and the
real file to read CLEAN, printed "scanner proved live", and **exited non-zero rather than reporting a
verdict if either arm failed to fire.**

🔴 **That refusal branch had never once executed.** I had written it, watched the happy path print,
and treated writing it as having it. **An unfired refusal is indistinguishable from one that cannot
fire** — the same object the control exists to rule out, one level further out.

Proved by breaking one arm deliberately (seeding only the control byte, not the invalid one) and
requiring a refusal: it printed "SCANNER IS NOT LIVE — refusing to report a verdict" and exited 1.

⚠️ **Ward Verifier's scanner had the same unfired branch, found only because I described mine.**
Neither of us reached that level alone, on either instrument.

**How to apply.** A control has THREE things to prove, not two: that it fires on the defect, that it
does not fire on the honest case, **and that whatever ACTS on its verdict actually acts.** Break each
arm in turn and require the refusal. Writing `if not fired: exit(1)` is not having it.

Related: [[a-green-mutation-only-counts-if-the-mutant-ran]], [[checks-that-cannot-fail]],
[[compliance-without-coverage]].

## AND THE REASON NEITHER OF US SAW OUR OWN

Two agents built file scanners with **opposite implementations and the identical blind spot**: one
decoded before scanning, so an invalid byte became U+FFFD and sat above the checked range; the other
read raw bytes but only examined values below 32. **Both controls passed. Both scanners reported
clean. Both were right about the case their author was hunting and blind to the other.**

> **A control is written by the person who already believes the thing.**

That is why each of us saw the other's immediately and neither saw their own — and it is a stronger
statement than "two independent passes beat one careful pass", because it says why. Four times in one
night, on four unrelated technical subjects, every real finding came from the second look.

**Practical form: seed EVERY failure class you claim to cover, not one representative** — a control
byte AND an invalid byte, not either alone. A single seed licenses a claim about a single class.

## A control that runs a DIFFERENT predicate from the scan — Ward Flow, 2026-09-06

My comment-stripping control fed the stripper `/* CCC_EVENT is explained here */` and asserted
nothing was found. **The scan it was controlling matches only DOUBLE-QUOTED names** — so the control
used one regex and the scan another, and disabling the stripper entirely left the real assertion
green while only the control fired.

It was invisible because today's ward comments happen to write event names in backticks, so the two
predicates agree on every real file. **A control that agrees with the scan on today's data is not a
control; it is a second opinion from the same source.** Write the fixture in the exact form the scan
matches, and re-run the mutation after fixing it.

## Write the control BEFORE trusting the scanner — 2026-09-06, and it is the ordering that matters

Three sessions in one night were defeated by comment-and-string stripping, in three directions. Mine
announced itself immediately, and the only reason was the order I wrote things in.

I wrote the control first, asserting the scanner would read `process.platform === "win32"` out of a
real gate. It returned `process.platform === " "` — **the string literal blanked by my own
stripper.** Harmless for classifying a platform gate; fatal for `gitAvailable("<sha>")`, where the
string IS the question. **A red line with the answer in it, before the scanner had been trusted for
anything.**

**A control written AFTERWARDS agrees with whatever the scanner produced.** You take the output,
see it looks plausible, and encode it — so the control tests that the scanner is self-consistent,
which it always is. That is why a late control is not merely weaker: it is a different test.

**How to apply: write the expected output of a scan by hand, in the exact form the scan is meant to
meet, before running it once.** If you cannot state what it should return, you do not yet know what
you are scanning for. The fix that came out of it is worth having too — **locating and reading are
two jobs wanting two texts**: find gates in a copy with comments and strings blanked, then read them
out of the RAW source at the same offsets, which requires the stripper to be length-preserving.

⚠️ **And the general form of all nine failures that night, ours and two peers':** _trusting a
comparison without establishing that its two sides were comparable_ — two document populations that
were not the same population; a brace-balancer's guess against a number already known; a condition
read from a copy where the string that was the question had been blanked.

---

# a-conveniently-shaped-control

> A control proves the method can find something; pick an easy-shaped instance and it never exercises the case that breaks

2026-09-04. A detector had to answer "is this component rendered anywhere?". Three versions, all
failing as FALSE NEGATIVES — the direction that reports work as absent and produces no error.

1. **Escapes collapsed on the way to disk**, so the JSX matcher compiled to something inert. It
   reported "rendered nowhere" for every symbol given to it, **including ones I had read with my own
   eyes minutes earlier.** Uniform, confident, negative — indistinguishable from a real finding.
2. Rewritten to match `"<Name "` / `"<Name/"` / `"<Name>"`. **Missed every element written across
   multiple lines.** ⚠️ **AND ITS CONTROL PASSED** — the control component happened to be written
   `<ClinicalRail />` on a single line.

**Why:** a control demonstrates the method can FIND something. It says nothing about whether the
method finds EVERYTHING, and the instance you reach for as a control is chosen for being easy to
verify — which is exactly the property that makes it not exercise the hard case.

**How to apply:** pick controls of **deliberately different shapes**, one per structural variant the
input can take — single-line and multi-line, quoted and bare, aliased and direct, nested and flat.
If every control has the same shape, the control set is one control. And when a detector's output
contradicts something you have read yourself, believe the reading.

⚠️ **The mirror image, same night, another session:** matching the literal `<Sheet` returned a
second file whose local components are `<SheetPerson` and `<SheetGroup` and which imports no Sheet —
a false POSITIVE from matching a name. **Both instruments checked text for a structural property;
both controls were satisfied by an instance that did not exercise the hard case.**

## The backslash rule, measured — my first statement of it was too broad

It is NOT that heredocs "eat backslashes". Measured by writing a file and reading the bytes back:

    written   one backslash + s        -> on disk  one backslash + s      SURVIVES
    written   two backslashes + s      -> on disk  one backslash + s      COLLAPSED
    written   four backslashes + s     -> on disk  two backslashes + s    HALVED
    written   a regex literal /..+/u   -> on disk  unchanged              SAFE

**A single backslash survives; a RUN of backslashes is halved.** So a regex LITERAL is safe and a
regex built from a STRING is not: `new RegExp` with a two-backslash escape lands as one backslash,
which JavaScript then reads as a plain letter. The matcher compiles, runs, and matches nothing.

**Prefer regex literals in any script written through a shell.** Where a name must be interpolated,
use `String.raw`, or build the pattern from an explicit character list instead of escapes. Another
session measured that its own heredoc-written scripts survived — because they used single
backslashes throughout. **Both observations are correct, and this rule reconciles them.**

⚠️ **This defect struck the edit that was documenting it.** A patch script written to correct this
very file failed to match its anchor, because the anchor contained escapes that had themselves been
collapsed. **The only reason it stopped rather than writing nothing was an explicit precondition** —
another session's habit of asserting the pattern occurs exactly once before writing.

> **A counted precondition converts a silent false negative into a loud stop.** For a detector the
> equivalent is an anti-vacuity floor; for an edit script it is `count(old) == 1`; for a mutation it
> is asserting the mutation actually applied. All three turn "did nothing, reported success" into an
> error.

**The robust route is not to use the shell at all** for files containing escapes: write them with a
file-writing tool directly.

Related: [[a-control-must-test-the-premise-not-the-measurement]], [[checks-that-cannot-fail]],
[[a-green-mutation-that-changed-nothing]], [[an-alias-defeats-a-name-matching-detector]],
[[reachability-is-not-containment]], [[backslash-b-becomes-a-backspace]].

---

# a-prescribed-control-with-the-wrong-expected-direction

> A peer handed me a mutation and named the wrong pass/fail; running it as written would have broken a correct fix

A peer relayed an owner instruction to fix a test, added the right constraint (do not relax the
assertion, fix the premise), and then specified the control: **"make a third team resolvable and
confirm the test goes RED."**

**The direction was inverted.** The fix derives its exclusion set from the data, so a third
resolvable team joins the set, leaves the walked population, and the test correctly stays **GREEN**.
Going red is the signature of the _hardcoded_ two-name exemption — the thing the peer was warning
against. So the outcome it named as proof-of-correctness is the outcome that proves the defect.

**Why this is worse than an ordinary wrong claim:** the instruction was expert, specific, measured
in tone, and correct in every other respect — the constraint, the clinical reasoning, the sibling
test to re-run. A control arrives pre-framed as the rigorous part of a message, so it is the clause
least likely to be re-derived. And this one failed toward _action_: I would have "fixed" a correct
guard until it went red, converting a derived population back into a hand-maintained exemption list.

**How to apply:** before running a control someone else designed, state the expected result yourself
from the code, and only then read theirs. If they disagree, one of you has the mechanism wrong and
it is cheaper to settle before the mutation than after. In the same message, the peer's _worry_ was
real ("would exempt any number tomorrow") and its _test_ did not test it — the worry needed the
upper floor exercised, not a third team added. **A correctly-identified risk paired with a mutation
that cannot detect it is the common shape**, because the risk is reasoned and the mutation is
improvised.

Related: [[run-the-mutation-before-relaying]], [[a-control-must-test-the-premise-not-the-measurement]],
[[deferring-to-a-correction-looks-like-humility]], [[a-relayed-approval-is-not-an-approval]],
[[which-assertion-went-red]].

---

# a-control-proves-one-arm-not-the-scanner

> Two scanners built the opposite way had the same blind spot; each author's control fired on the case they were hunting and certified the whole instrument

Ward Flow, 2026-09-05. Two of us swept files for corrupted bytes, independently, opposite
implementations, and **both scanners had the same hole:**

    Ward Builder One   decoded first with errors="replace"  -> an invalid byte became U+FFFD,
                                                               ordinal 65533, above 32, invisible
    me                 read raw bytes, matched below 32     -> an invalid UTF-8 sequence is not
                                                               below 32, equally invisible

**Both of us ran a positive control, and both controls passed** — theirs seeded a `0x08`, mine
seeded a `0x08`. Valid UTF-8 either way, so each control fired on exactly the case its author was
hunting and said nothing about the class neither was looking for. **A control proves the arm it
exercises, never the scanner.** Neither of us found our own; each found the other's, and then
recognised the same shape at home once it had been named.

**Why this is the same error twice for me in one session:** hours earlier I reported ten guards as
unable to detect a caption's deletion, on an arm that varied the TEXT — blind to the `getByTestId`
above it. It was three. Both times my control produced both answers along the one axis it varied,
and I read that as the instrument being sound.

**How to apply:**

- **Seed one control per FAILURE CLASS, not per scanner**, and require every arm to fire before any
  verdict prints. Exit non-zero when one does not — a scanner that certifies a clean tree without
  proving itself is worth less than no scanner.
- For byte hygiene the two classes are **control bytes** (`0x00 08 09 0B 0C 0D 1B`) and
  **undecodable bytes** (strict `decode("utf-8")`, no `errors=`). Seed `0x08` and `0xFF`.
- 🔴 **Then prove the GATE, not only the control.** A sweep that refuses to report when an arm
  fails to fire has a refusal branch that has, typically, **never executed** — and a gate that has
  never fired is indistinguishable from a gate that cannot. Break each seed in turn and require the
  refusal. Mine, proved 2026-09-05:

        both arms seeded     -> verdict printed,                       exit 0
        arm 1 seed removed   -> "INVALID -- arm 1 did not fire",       exit 2
        arm 2 seed removed   -> "INVALID -- arm 2 did not fire",       exit 2

  Ward Builder One took this step first, on their scanner, prompted by my finding about theirs;
  I took it on mine, prompted by their message about it. **Neither of us reached the gate level
  alone, on either instrument.**

- **Ask what your control CANNOT distinguish.** If the answer is "the thing I was already looking
  for", the control is a rehearsal.

⚠️ **The generalisation, which is [[a-reviewer-who-has-read-the-intent]] and handover §7 arriving by
another road: every real defect that night came from the second look and never the first.** Two
correctly-scoped instruments, each blind exactly where its author was. That is an argument for two
independent passes over one careful pass — evidenced now rather than asserted.

Related: [[a-guard-is-predicate-plus-query]], [[a-control-must-test-the-premise-not-the-measurement]],
[[an-empty-search-is-a-claim-about-the-detector]], [[compliance-without-coverage]],
[[agreeing-checks-with-one-blind-spot]].

---

# a-control-searches-for-the-fix-you-missed

> My control failed on the honest case and exposed a SECOND identical defect seventy lines below the one I had just fixed and called done

I replaced a test that banned the phrase "at most" — it forbade "live at at most three wards at
once", which is true, because the cap is a concurrency limit. Fix applied, suite green, done.

Then I ran the control that the honest sentence must now PASS. **It failed.** A second ban,
`not.toMatch(/at most|.../i)`, sat seventy lines below in the same file, on the same word, with the
same defect — three lines under a comment warning that _a correction which pins its own remainder is
worse than no correction_. It had done exactly that, twice.

**Why:** I ran the control expecting a receipt for the fix I had made. Its actual value was as a
search over everything else that could produce the same red. A green suite could not distinguish
"one fighter, fixed" from "two fighters, one fixed".

**How to apply:** after fixing a guard, run the honest case that the OLD guard rejected, not only
the defect the new one must catch. When it still fails, the remaining cause is a sibling you have
not found — grep the whole file for the same construct before assuming your fix is wrong. And
re-run every earlier control after the second fix: [[a-tautology-that-regenerates]]. Related:
[[compliance-without-coverage]], [[a-written-diagnosis-does-not-sweep]].

---

# run-the-mutation-before-relaying

> A finding checkable by one cheap mutation must be mutated before it is relayed, not after — and the claims that skip the control are the ones that sound like plumbing

When a finding can be settled by a single mutation and the file is already open, **run it before
relaying, not after.** On 2026-09-02 I sent Ward Lead and Ward Builder Two the claim that
`coordinatorScopedReferral` _"has no field-set allowlist"_. What I had actually measured was that
deleting a field leaves the whole 1,397-line test file green — true. The categorical sentence I hung
on it was false: `tsc` catches it (`TS2741`, rc 2). The type **is** the allowlist; it simply runs in a
gate the fast local loop does not.

**Why:** the five minutes are cheaper than the retraction, and a claim that arrives corrected is
recoverable in a way one that has already been relayed onward twice is not. Builder Two had to
falsify my sentence on its own file, and then offered to take the whole error — which was generous
and inaccurate, because I wrote the sentence it carried.

**How to apply:**

1. **Ask which gate holds the contract before saying no gate does.** "The test suite does not catch
   it" and "nothing catches it" are different claims, and `typecheck`, `lint` and the build are all
   gates a vitest run says nothing about. A guard in a slower gate is an _enforcement_ gap; a guard
   nowhere is a _type-completeness_ gap. Only the second is unfixable by running more.
2. **Watch which findings you skip the control on.** I ran a full verification on the
   `sexDesignation` finding because it felt clinical, and skipped it here because it felt like
   plumbing. **That is not a defensible way to choose.** The severity of the consequence does not
   predict the fragility of the reasoning.
3. **A track record makes this worse, not better.** A claim that creates work gets checked less when
   it comes from someone whose last two findings were right — so trust is spent on exactly the claims
   that most deserve a control.
4. **Commit before mutating**, then restore by reversing the edit and proving byte-identity by hash.
   Not for safety — because `git checkout --` is unreliable here (see [[restoring-a-mutated-file]]).
5. ⚠️ **A broken test is not an unguarded property, and the mutation is what tells them apart.** Same
   night, same lesson one level up: I reported 129 "checks that cannot fail" across 89 files, framed
   so that each read as a gap. Ward Builder One measured one of them — the defect the failing title
   named turned a **static single-source test in another file** red. The property was guarded all
   along; the test was lying about its own job. **Mis-attributed needs an honest rename and nothing
   is at risk; genuinely unguarded needs a new test and something is.** A count of tests that cannot
   fail must never be quoted as a count of unguarded properties.
6. **Don't run the inverted proof as "does the renamed test still pass" — run it as "what DOES go red
   when I introduce this defect."** The second names the guard that actually exists, so the next
   person can find it. The first leaves that knowledge nowhere.
7. **Give an agent permission to fail the task, and say why the failure is worth more.** Builder One's
   brief said: if no event could make the states differ, stop and report _that_ — it is worth more
   than a patched test. Mine said only "hand it back if the brief does not cover it". **Same
   instruction, incentive missing:** one makes the honest answer the ambitious one, the other makes
   it the safe one.

Related: [[relayed-numbers-lose-attribution]], [[assert-only-about-code-you-opened]],
[[a-mention-is-not-an-assertion]], [[measure-the-thing-not-a-proxy]],
[[checks-that-cannot-fail]].

---

# run-the-test-before-prescribing-the-fix

> Never prescribe a fix whose central premise is an unexecuted check — run it first, or state it as a question rather than a packet

On 2026-08-22 I diagnosed ledger `#231` from the Gate E dumps, found that a grounded extractive
answer bypasses `generatedAnswerQualityFailureReason`, and recommended moving the call outside
the `!grounded` guard — while explicitly noting I had NOT executed the predicates against the two
incoherent answers. A PR reviewer ran that check in minutes: the predicates return `null` for
both, so the current gates ACCEPT those answers and the guard-only fix would have caught neither.
The real defect was predicate strictness, not gate reachability. Two of my ledger requests were
cancelled and superseded.

**Why:** the code-path finding was correct and the recommendation built on it was wrong, because
the step joining them was assumed. Labelling an assumption honestly does not make it safe to build
a packet on top of it — a reader takes the packet, not the caveat. What saved it was that I wrote
the kill condition into the doc and the paste-ready prompt ("if either passes every predicate,
STOP and report"), so the reviewer knew exactly which test decided the question.

**How to apply:** if a claim is cheap to execute, execute it before it becomes a recommendation —
a focused test against two string literals is minutes. If it genuinely cannot be run (no deps, no
approval, provider-gated), then demote the output: state it as the open question and name the
experiment, do not write it as a packet with a fix in it. Always write the falsification condition
into the handoff so whoever runs it first knows what it kills. Also: caveats stated only in prose
get separated from the recommendation when it is copied — put the kill condition inside the
prompt itself. Related: [[ward-flow-verification-lessons]], [[checks-that-cannot-fail]].

---

## 🔴 2026-09-07: A BROKEN PROBE PRODUCED A CONFIDENT POSITIVE THAT AGREED WITH ME, AND I ALMOST SENT IT

Ward Lead challenged a finding of mine — that a shared bar primitive had two tones painting the same
colour — and invited me to overturn them. I wrote a resolver to walk each tone's `var()` chain
through the token file into `globals.css`, in both palettes. It returned:

    good -> CanvasText   warning -> CanvasText   danger -> CanvasText
    🔴 COLLISION  good + warning + danger

**A three-way collision. Far worse than I had claimed, and exactly the shape I was arguing for.**

**It was entirely an artefact.** `CanvasText` is the **forced-colors override**; my parser took the
_last_ declaration of each token and every one of them ends up redeclared inside
`@media (forced-colors: active)`. Excluding those blocks and re-running:

    LIGHT  #0c6b41  #8a4d05  #a3190f  #1d6fb8  #475467   no two coincide
    DARK   #7de0a3  #f2c45a  #ff9ca4  #74bdf0  #a4adb7   no two coincide
    CONTROL  --ward-border-strong = --text-muted = #475467  → the alias IS visible to the probe

**Ward Lead was right. Only one tone uses the aliased token, so no two DIFFERENT tones can coincide,
and my claim was over-stated.**

⚠️ **The literature on broken probes is all about false NEGATIVES** — the search that finds nothing
because it was malformed. **This was a false POSITIVE, and it is more dangerous**, because a negative
invites a second look and a positive that confirms your existing belief closes the question. I had a
disagreement, a hypothesis, and a result that vindicated me. **Nothing in that moment felt like a
reason to check the instrument.**

🔴 **What caught it was a comment I had written myself, hours earlier, in my own test file:** that
`CanvasText`/`LinkText` are forced-colours OVERRIDES and correct. **I recognised the value as one my
own documentation had warned me about.** Had I not written that note, I would have sent a three-way
collision to the chat that reports to the owner.

**How to apply: put the control in the probe, and make it a control the probe must PASS.** Mine
printed `--ward-border-strong = --text-muted = #475467` beside every run — a known alias it must be
able to see. **That line is what makes "no two coincide" mean something rather than being the shape
of a broken parser.** And when a measurement arrives supporting the side you are already arguing,
that is the moment to re-read the instrument — **not the moment the argument is over.**

Related: [[a-clean-negative-that-measured-nothing]], [[a-correction-that-agrees-with-you]],
[[right-conclusion-wrong-evidence]], [[tokens-that-read-correct-and-paint-wrong]],
[[when-a-mutation-proves-nothing]].

---

## 🔴 2026-09-07: A CONTROL THAT COMPARES TWO IMPLEMENTATIONS SHARING THE DEFECT

I fixed a guard that was reporting a comment as the defect it described, using a regex to blank CSS
comments. Asked whether my version silently loses real code, I measured it against the repository's
canonical blanker across the whole corpus:

    files scanned 1575 · CONTROL: both strippers do strip · files where reported refs DIFFER: 0

**I reported "a real flaw, but dormant — nothing is being missed today", to a peer and to the owner.**

⚠️ **BOTH BLANKERS CARRY THE SAME not-literal-aware HOLE, so agreement between them was guaranteed
and meant nothing.** My "control" — a live token surviving with 18 hits — proved only that _stripping
happens_. It never tested the premise, which was whether the hole BITES. A peer re-measured the way
I should have — **blanked against RAW, asking what blanking REMOVES** — and it is live:

    var() references removed repo-wide: 155  ·  files carrying the trigger: 13
    constructed CONTROL: raw [--real-one, --swallowed, --after] → blanked [--real-one, --after]

🔴 **And the trigger was not the one I tested for.** I looked for `"/*"` inside a string, which the
canonical helper's own header documents as finding M-4. The live door is a `//` LINE COMMENT
containing `/*`, which opens a block that runs to the next terminator and swallows the code below.
**Different door, same room — and reading the documented failure made me confident I had checked the
class when I had checked one member of it.**

**The general shape, which is worth more than the incident: two implementations of one idea are not
independent instruments.** Comparing my version to theirs answers _"did I reimplement it faithfully"_,
not _"is it correct"_ — and a faithful reimplementation of something wrong agrees perfectly. It is
[[a-baseline-from-the-subject-vouches-for-it]] with a sibling instead of the subject itself, and
[[right-conclusion-wrong-evidence]] when the two happen to be right.

**How to apply: a control must be able to FAIL for the reason you are testing.** Ask what result
would appear if the thing you fear were true — if it is the same result you just got, you have not
measured. Prefer comparing against **the unprocessed input** or a **constructed case containing the
defect**, never against a second thing you or a colleague wrote from the same understanding. ⚠️ **And
when the comparison is between two artefacts, name their shared author or shared ancestry out loud —
that is the tell.** Related: [[a-test-co-authored-with-the-code]],
[[identical-work-produces-no-conflict]], [[a-property-whose-operands-can-coincide]],
[[a-clean-negative-that-measured-nothing]].

## 2026-09-11 — a control SAVED an answer, and the cost framing is what hid the defect

Ward Flow had a Playwright test parked as `test.skip`, never run once, asking whether ward
`forced-colors` blocks do anything. Its own header said _"guessing further costs a full production
build each time, which is why this is parked rather than iterated"_, and noted that **46 stylesheets
carry blocks whose whole content is a custom-property re-point** — if inert, all of it is dead
high-contrast accessibility code.

I ran it. **It failed its own CONTROL:** re-pointing the token did not move the border _even in
ordinary colours_. Diagnosed statically in about a minute — the probe sampled
`[data-ward-primitive="panel"]`, and that primitive's stylesheet uses the re-pointed token **zero**
times (it paints from a different one) and carries **no forced-colors block at all**. The token
itself is fine: 336 paint sites across ward CSS. **The element was wrong, not the hypothesis.**

🔴 **Without the control it would have produced a confident FALSE answer in the dangerous
direction.** The forced-colours read would have come back "unchanged", the test would have printed
_"INERT — the UA overrides the resolved value"_, and somebody would have had written permission to
strip accessibility code from 46 files. **A control is cheapest exactly where the measurement is
expensive, which is where people leave it out.**

⚠️ **And the cost framing is the second lesson.** _"Too expensive to iterate"_ is what stopped anyone
re-examining it — but the defect was not in the browser at all, it was one grep away. **When a check
is parked for cost, audit its TARGETING statically before ever paying to run it again.** The same
mistake I made hours earlier with `prefers-color-scheme`: a clean negative from an instrument
pointed at the wrong thing, and when the instrument is expensive nobody re-points it.

Related: [[a-clean-negative-that-measured-nothing]], [[a-clean-result-from-measuring-nothing]],
[[looking-at-the-screen-misattributes]], [[a-property-set-on-the-element-itself]],
[[broken-and-never-worked-look-identical]].

### The sequel, same night — a repair that MOVED the failure without curing it

I diagnosed the probe's control failure as a wrong target, repaired the selector, and re-ran. **The
control failed again**, on an element that demonstrably paints from the token under test — its
rendered colour was that token's own documented value. An inline `style.setProperty` outranks every
selector, so on that element it should have moved.

🔴 **Two different elements, both genuinely correct targets, both failing the same way — which says
the METHOD is unsound, not the target.** My first diagnosis was true of the panel and I stated it as
though it were the whole problem. **A repair that changes the symptom is easily mistaken for a
repair that works**, and the tell was that the failure moved (a new starting colour) rather than
disappearing.

⚠️ **The temptation at that exact moment is the dangerous one: the reading was ONE assertion away,
and deleting the control would have produced it.** The lead had pre-ruled _"do not weaken the control
to get a reading"_ — **a constraint written before the temptation existed is worth more than judgement
applied during it**, because at that point I had a repair I believed in and a single line standing
between me and a result.

**What to take:** when a fix relocates a failure instead of removing it, **stop and re-derive the
diagnosis** rather than iterating toward green. And record what a failed investigation ESTABLISHED —
"the obvious repair also fails" is worth real money to whoever picks it up, and is invisible if you
only report "still unknown".

---

# a-passing-control-beside-a-wrong-answer (added 2026-09-11)

> 🔴 **three wrong probes in one day, and EVERY TIME the wrong one's output looked BETTER than the truth** — two of the three HAD a control and the control PASSED

**A control proves the mechanism can tell present from absent. It cannot tell you the POPULATION is
wrong, the COMPARISON is wrong, or the CLASS is wrong — and none of those announce themselves.**

**The three, all on one night, all from one verifier's own instruments:**

    fourteen hospitals read as fourteen unmarked teams          (wrong population)
    a tidy 15-to-1 split from a sweep that could not return
      a single true positive — innerText does NOT exclude
      sr-only content, it is CLIPPED not display:none            (wrong comparison)
    sixteen ONE-SILENT carriers where there was exactly one      (wrong class)

🔴 **What caught all three was not a control. It was that the result's SHAPE was implausible** —
fourteen defects on a screen already hardened; zero agreements in a careful codebase; a mount count
varying 5–7 when a mount count cannot vary. ⚠️ **Implausibility fires on the ANSWER, not the
instrument.**

## 🔴 AND AS STATED THAT IS A RESCUE, NOT A DEFENCE — two additions make it transferable

⚠️ **Implausibility needs a PRIOR, and a prior does not transfer.** _"Zero agreements is not a
plausible shape for a codebase this careful"_ is held only by someone who has worked on that
codebase. **A fresh agent, or the same one on an unfamiliar module, has no such prior — so the one
detector that fired would not fire.**

**① PRE-REGISTER THE EXPECTED SHAPE.** **Write the rough split AND the reason down BEFORE reading any
number.** ✅ **Then an implausible result contradicts a WRITTEN PREDICTION rather than a feeling, and
fires mechanically.** ⚠️ **And it fails honestly the other way: if you cannot predict the shape, you
have said so, and the result is correctly treated as uninformative rather than as a finding.** Costs
one sentence.

**② A THREE-STATE SWEEP NEEDS THREE CONTROLS — ONE KNOWN SPECIMEN PER STATE.** 🔴 **A control on one
class licenses a claim about THAT CLASS ONLY.** The run above proved its probe could detect
ONE-SILENT and said nothing about whether it could detect AGREE — **and AGREE is the class it got
wrong, fifteen times.** ⚠️ **Its reported `0 DISAGREE` had no control at all: a zero from an arm
with no control is not a measurement.**

## ⚠️ Two independent causes of one miss defeats the fix

**One element was missed for TWO reasons AT ONCE: the `title` wording differed from the `sr-only`
wording, AND the span was a sibling referenced by `aria-describedby`, so `closest()` found no host.**
🔴 **Repair either alone and the element is still missed, and the repair looks correct.** ✅ **Only
opening the page settled it.**

## ✅ The reporting line worth copying

**Say which figures you would stand behind and which you would not.** _"The rail and `<h1>` counts
are exact-match and are the only ones I would stand behind; the `ward-bar` figure used a PREFIX
selector, so it answers 'how many testids begin with this', never 'how many are mounted'."_
⚠️ **Most reports give one number and no such line.**

---

# a-check-that-passes-on-the-wrong-base

> an OLDER edition of the same app sits on `main`, so "does this directory exist" is true in both the good and the bad case — four agents passed it from the wrong base, and the thing that caught it was an agent's refusal, not the check

**2026-09-12, Ward Flow.** My build brief told ten screen agents to prove their base:

    ls src/app/mockups/ward-flow/    ← must contain board, capacity, delays, statistics

🔴 **That passes on `main`.** A previous, merged **second edition** of Ward Flow lives there (PRs
#2597, #2654). Four agents were launched into worktrees cut from `main`; **all four passed.**
Measured afterwards: **3** third-edition drawings on those bases against **36** on the ward line.

✅ **What caught it was a Sonnet agent that REFUSED**, in its own words — the ward-flow directory
existing _"is not proof of the right base, because an older edition of it already lives on `main`"_.
It had been told _"do not try to fix your own base"_ and it handed back instead. **The instruction
that saved this was the refusal clause, not the verification step. Write refusal clauses.**

✅ **The replacement discriminates by COUNT, not existence:**
`ls docs/ward-flow/mockups/ | grep -c third-edition` → 36 on the ward line, 3 on `main`.

🔴 **THE SHARPEST PART: three of the thirty-six drawings DO exist on `main`.** An agent assigned one
of those three would have found its drawing, found the app directory, and built something plausible
against the wrong edition — **with nothing anywhere reading as an error.**

**How to apply:** before trusting any verification, ask _what would this have printed had the thing
been broken?_ If the answer is "the same", it is not a check. ⚠️ **A predecessor version of the
thing you are checking for, still present somewhere, is the commonest way a check stops
discriminating** — and it never announces itself, because the artefact it finds is real.
See [[checks-that-cannot-fail]] and [[a-clean-negative-that-measured-nothing]].
