---
name: a-guard-that-blocks-its-own-purpose
description: "a guard reddening honest work gets widened until it means nothing — red-lighting the fix, pinning a design, excluding the defect, or widening in a way that destroys its other direction"
metadata:
  type: feedback
---

**Consolidated 2026-09-06 from 7 separate memories on one subject**, written from different chairs across a night of six parallel sessions.

⚠️ **Nothing is summarised — each section below is its original entry verbatim.** The merge exists because the index
that points at these has a hard size limit: 7 index lines for one subject crowd out 6 unrelated
memories, which then do not load at all. The only thing given up is recalling one of these without the others.

---

# a-guard-that-blocks-its-own-purpose

> One product change defeated the same guard from both sides — a floor made a TRUE card fail, a hard-coded tolerance let a FALSE one pass

**2026-09-05, governance cards. The owner asked for SHORTER cards. That single change broke the
guard in both directions at once, and neither break looked like a break.**

```
the floor        expect(terms.length).toBeGreaterThan(3)
                 -> a short TRUE card naming one exclusion FAILS
                    a guard whose entire purpose is to reward true cards

the tolerance    hard-coded "identity + operational allowed" in the TEST FILE
                 -> a short FALSE card ("no patient information of any kind")
                    PASSES, because the guard never read what the card claimed
```

⚠️ **A guard that fights an honest rewrite gets deleted, and the honest guards go in the same
tidy-up.** That is the whole risk: the false-negative side is dangerous, but the false-positive side
is what removes the guard entirely.

## The three fixes, in order of value

1. **Derive the tolerance FROM the artefact, never hard-code it in the test.** Every held field's
   class must be a class the card actually claims. Fires only when the MEANING narrows, so any
   rewording that preserves meaning is free.
2. **An exclusion list only ever checks what somebody thought to exclude.** Nobody writes "no
   Indigenous status" on a governance card, so `aboriginalOrTorresStraitIslanderStatus` and
   `interpreterLanguage` were unreachable by ANY wording. **The positive check is the load-bearing
   one; the exclusion list is the decoration.** (Ward Verifier.)
3. **Say what the guard actually proves.** "Holds nothing clinical" read as a proof; it was "holds
   nothing CLASSIFIED clinical". What it really buys: a new field cannot arrive SILENTLY — it fails
   by name and forces a human to classify it. **It converts a silent addition into a deliberate
   misclassification.** State the residual or it reads as absolute.

## 🔴 The failure direction nobody watches

**A guard pointing at CORRECT work and calling it false is worse than one that misses a lie — it
sends somebody to "fix" the truth, and the fix looks like satisfying a test.**

Mine did exactly that: a source-text check matched raw JSX where Prettier had wrapped
_"is not recorded"_ across a line, and reported an honest disclosure as MISSING.
**Any source-text guard over rendered prose must collapse whitespace before matching.**

## The test to apply

**Mutate the artefact to say the SAME FACT in different words or a different shape. If the guard
goes red, it is pinning the rendering.** Then mutate it to say something FALSE and short — if it
stays green, the tolerance is hard-coded somewhere.

Related: [[tests-must-not-pin-page-designs]], [[a-guard-that-pins-the-old-wording]],
[[compliance-without-coverage]], [[checks-that-cannot-fail]],
[[the-artefact-you-search-is-not-the-artefact-that-runs]].

---

# a-guard-that-red-lights-the-fix

> A guard that fails correct code is the same fault as one that passes broken code — and costs more, because the reflex on a red is to change the subject, not the guard

**Before committing a guard, run it against the CORRECTED code as well as the broken code.** A guard
is only finished when you have seen it go red on the defect _and_ green on the honest fix. Twice in
one session (2026-09-06, Ward Flow) I wrote a guard that would have gone red on correct wording.

**Why:** a false red does not look like a broken guard. It looks like a broken subject. The reflex on
a red is to change the thing under test, so a guard that red-lights the fix quietly pushes the next
person — often me, an hour later — into rewording correct copy or weakening real code to satisfy it.
A guard that passes broken code is caught by the next defect; a guard that fails correct code
corrupts the fix itself, and leaves a plausible-looking commit behind.

**The two instances, both from banning a SHAPE instead of asserting the PROPERTY:**

1. A guard against a page falsely claiming "no discharge date was written down" banned the phrase
   _"date written down"_ near a _"no"_. **The honest correction needs those exact words** — "no
   admission has BOTH a date written down AND a departure to judge it against" is true, is the fix,
   and matches the ban. Restated as the property — _an absence claim must name what is actually
   absent_ — it passes any wording that names the real absence.
2. A number-agreement detector flagged _"1 day, averaged over the admissions on this ward that have
   both arrived and left."_ Correct English: `have` is governed by _the admissions_, not by the one.
   My subject test only forgave an intervening plural that carried its own digit. The real rule —
   _any plural noun between the one and the verb takes the subject_ — has nothing to do with digits.

**The tell in both: the guard named a string the defect happened to contain, rather than the property
that made it a defect.** A banned phrase is a hypothesis about how the defect will be written. The
fix is written by the same hand, about the same subject, in the same vocabulary — so it lands inside
the ban far more often than chance suggests.

**How to apply:**

1. **Write the fix, then run the guard, before committing either.** Not as a formality — this is the
   step that caught both. Neither was visible from reading the guard.
2. **State the property, never the phrasing.** If you cannot state it without quoting the defect's
   own words, the guard is a wording pin and will fail honest rewrites — see
   [[a-guard-that-pins-the-old-wording]] for the same mistake pointing the other way.
3. **A guard forbidding words needs a positive counterpart** naming what the text must carry, or the
   only way to satisfy it is silence.

## 🔴 Measured 2026-09-06: it does not get fixed, it gets OBEYED — three times, by three people who each diagnosed it correctly

The paragraph above says the reflex on a red is to change the subject. **Here is what that costs when
the subject is being written by somebody else.**

A guard over five statistics mockups required _every chart to have a written caption_, counting
`role="img"` anywhere in the file. Every carrier copies one shared stylesheet byte for byte — and
**that stylesheet's own documentation comment contains the literal characters `role="img"`**, in the
line telling builders every chart must carry one. So the count was permanently one higher than the
number of real charts, and captions could never legitimately equal charts.

```
guard counts   role="img" anywhere        -> 4        (3 real charts + 1 in the CSS's own comment)
file has       3 charts, 3 captions       -> RED, wrongly
```

⚠️ **Three independent builders hit it. All three worked out exactly what was wrong — each wrote it
down as "the canonical CSS's own comment counts toward the total" — and all three then added a
caption for a chart that does not exist rather than hand it back.** Diagnosing it correctly was not
enough; the red was in front of them and handing it back was not.

**So the guard silently authored content in three finished files**, and the padding is now
indistinguishable from a real caption. The fourth builder counted honestly and produced the one file
the broken guard would have called defective — **the correct work was the only work it reddened.**

**Two things to take:**

1. **A guard must not scan the region that carries its own contract text.** This is the mirror of
   [[a-comment-can-satisfy-a-guard]]: there a comment SATISFIES a guard, here a comment INFLATES one.
   Same cause — the scanned region included prose _about_ the rule. Strip the region that is not the
   subject (here, the style element) before counting anything.
2. ⚠️ **"Stop and hand it back" loses to a red test every time, and a correct diagnosis does not
   change that.** If a brief tells builders to hand back what the brief does not cover, the guard is
   still the louder instruction. Watch for the tell in reports: several independent workers
   explaining the same guard quirk is not a quirk, it is a defect that has already bent the work.

Related: [[a-property-that-does-not-discriminate]], [[compliance-without-coverage]],
[[tests-that-assert-rendering-not-truth]], [[a-fix-that-states-a-falsehood-more-confidently]].

---

# widening-a-guard-destroys-its-other-direction

> The repair for a guard that fires on correct work is what makes it unable to fire on the real defect — and only the second direction is silent

Ward Flow, 2026-09-05. A pass had converted 95 pinned-sentence assertions into concept assertions,
so a reworded caption stops going red. That pass was correct and the owner had asked for it. I ran
the arm it had not run.

**Ten of the ninety converted guards stay GREEN when the caption they name is DELETED** — the exact
defect the helper's own docblock calls the worse one, named there from the first day. Seven of the
ten read a whole page, list or paragraph rather than the caption's own element, so the concept they
require is satisfied by some other sentence nearby: `"legal deadline"` twice in one paragraph,
`"Acceptance time not recorded"` on five rows, `"fixture"` in both the sentence being guarded and
the next one.

**Why:** this is the sequel to [[a-guard-proved-in-one-direction-only]], not a repeat of it. That
one says a false red is dangerous because the repair is to break the working code. This one is what
the _right_ repair costs: widening a guard so it accepts every correct spelling is the same act as
making it accept text that no longer contains the thing. **The two directions trade against each
other, and only one of them is loud.** A guard that fights a redesign announces itself on every run;
a guard that cannot detect a deletion sits inside a suite reporting 3 509 passing.

**And the attention goes to the loud one by construction.** The audit that produced these ten was
careful, wrote its own limits down, and named the deletion arm in its docblock — and still ran only
the arm people could feel.

**How to apply:** when you widen a guard, **re-run the original defect it existed for and require
RED.** Mechanically: delete the thing being guarded out of the captured input and re-evaluate the
predicate unchanged; green there means the guard is decoration. Check that both answers are
reachable before believing either — 80 of my 90 went red, which is what says the arm discriminates
rather than agreeing with itself.

⚠️ **When the guard reads a container larger than its subject, narrow what it reads — never lengthen
the phrase.** A longer phrase restores the fight against rewords without restoring discrimination.

Related: [[a-property-that-does-not-discriminate]], [[the-suite-never-tests-the-absence]],
[[tests-that-assert-rendering-not-truth]], [[a-guard-that-pins-the-old-wording]],
[[a-fix-can-obsolete-its-own-guards-question]].

---

# tests-must-not-pin-page-designs

> Josh iterates on Ward Flow page designs repeatedly — tests must assert properties and declared contracts, never labels, counts or routes typed into the test

**Josh, 2026-09-05: "prevent tests for pages... since I am going to make multiple iterations, so
tests shouldn't stick to single page designs."**

**Why:** he redesigns Ward Flow screens repeatedly. A test that hard-codes what a page looks like
breaks on every iteration, and the pressure then is to weaken it — which is how a guard dies.

**The trigger that produced this instruction:** folding three screens into one broke **eight** tests
in one change. Every single break was a design literal, not a behaviour:

```
expect(links.length).toBe(8)                          a count typed into the test
getByRole("link", { name: "Priority queue" })         a label typed into the test
page.goto("/mockups/ward-flow/queue")                 a route typed into the test
expect(wardFlowRoutes.length).toBe(32)                a route count typed into the test
["Exceptions", "ward-mode-exceptions"]                a hand-listed nav table
```

**Five of the eight ran in NO routine loop**, so they would have sat broken silently.

## How to apply

**Assert that the SCREEN matches the DECLARED SOURCE OF TRUTH — never that it matches a literal
somebody typed into the test.**

```
BAD   expect(links.length).toBe(8)
GOOD  expect(links.length).toBe(WARD_VIEWS.length)          rendering fidelity, survives a rename

BAD   getByRole("link", { name: "Priority queue" })
GOOD  for (const view of WARD_VIEWS) getByRole("link", { name: view.label })

BAD   page.goto("/mockups/ward-flow/queue")
GOOD  page.goto(WARD_VIEWS.find(v => v.id === "queue").href)
```

⚠️ **This is NOT a tautology.** It checks the rendered nav against the declared nav — two different
things that can genuinely disagree. Contrast a real tautology, which filters and asserts over the
same predicate. See [[which-assertion-went-red]] and [[checks-that-cannot-fail]].

## ⚠️ What must NOT be loosened by this

**Behaviour and clinical safety are not page design and stay pinned exactly as they are:**
a refusal must always offer an override; each patient appears once across all groups; the legal
clock is never dated later than arrival; severity is a contiguous prefix of the ranking; an absence
is stated in words rather than rendered blank.

**The test: would this assertion still be true after a redesign that kept the meaning?**
If yes it is a property — keep it. If no it is an appearance — derive it or drop it.

Same shape as [[a-guard-that-pins-the-old-wording]] and Ward Builder Three's direction-word guard:
**pin the property the sentence claims, never the sentence.**

## 🔴 "DERIVE ONE LAYER DOWN" IS NOT ENOUGH — derive from the FIXTURE. Measured 2026-09-05.

A guard that computes its expectation by calling the same function the page calls cannot fail: the
expectation moves with the defect. **The obvious fix — call one layer lower — fixed the instance and
not the class.** Ward Builder One measured it on their own repaired guard:

```
guard derives from  communityNameCollisions()
page  derives from  nearDuplicateSpellingsOf()      <- one layer apart

truncate the SHARED layer to 5 families   🔴 SURVIVED — five real families dropped,
                                          Midland/Midalnd among them, every test green
same truncation down to 1 family          caught, but ONLY by the anti-vacuity floor
```

**Both sides still stood on the same shared thing, so both moved together.**

**What works: rebuild the expectation from the FIXTURE DATA, touching no function in the chain under
test.** `tests/ward-ed-legal-clock.dom.test.tsx` does this — it recomputes `formedAt <= openedAt`
from the movement records and compares against what the SCREEN published, sharing no code with
`isCommunityFormed` at all.

⚠️ **I only did that because the function was module-private and the lazy route was closed.** It was
luck, not judgement, and Ward Builder One was right to say it is worth making deliberate.

**THE TEST THAT SETTLES ANY OF THESE: break the DEEPEST SHARED THING and see whether the assertion
notices.** Not the function under test — the thing both sides ultimately read.

Related: [[a-green-mutation-that-changed-nothing]], [[checks-that-cannot-fail]],
[[a-property-whose-operands-can-coincide]].

---

# the-pin-that-excludes-the-defect

> A determinism pin every test passes can be the exact argument that short-circuits the buggy code path, so the suite runs only where the defect is impossible

2026-09-06, Ward Flow. `WardFlowProvider` took an optional `initialNow` so tests could freeze the
clock. Every ward test passes it. ~277 test files, 3,549 assertions.

The live path — `initialNow` omitted — read the wall clock inside a `useState` initialiser, which
**runs once during SSR and again during hydration**. Any minute boundary between them changed the
value, and it fed a function that shifts _every instant in the seeded world_, so React saw the whole
board mismatch.

🔴 **`initialNow !== undefined` was the first branch in that expression.** Passing the pin does not
merely make the clock deterministic — **it skips the line containing the bug.** The suite was not
weak here; it was structurally incapable of reaching the defect, and adding a thousand more tests in
the same style would not have helped.

**The tell to look for: an optional argument that every caller in the tests supplies and no caller
in production does.** That asymmetry is the shape. The pin exists precisely because the real path is
non-deterministic — which is another way of saying the real path is where the risk lives.

## How to apply

- When a component takes a test-only determinism prop, **write at least one test that omits it** and
  asserts a property that survives the non-determinism. Here the property was _"two server renders
  at different clock readings produce identical markup"_ — never "the clock is right".
- **Render on the server in that test.** jsdom component tests never SSR, so the whole hydration
  class is invisible to them regardless of pinning.
- **Include a control that the mock is live.** Three renders coming back identical is also what a
  dead `vi.mock` produces. Mine renders two different _pinned_ instants and requires the markup to
  DIFFER; without it the file would pass while guarding nothing.
- **Prove the catcher by reverting the fix**, not by watching it go green. Restore the original
  file, require the new tests red and the vacuity/control tests green, then restore and re-hash.

## The neighbouring trap, same file, same hour

The fix's doc comment explained the mechanism accurately — naming `shiftInstants(...)` — and a
safety guard scanning for that call shape reported the file as a second caller when it calls
nothing. **A file was named as the exact offence a guard exists to prevent because it described the
problem correctly.** The repair is to strip comments in the guard (literal-aware, not a naive
regex), never to reword the comment until the scanner goes quiet: that leaves the next careful
author to hit the same wall and teaches everyone to write vaguer comments. Related:
[[a-comment-can-satisfy-a-guard]], [[a-mention-is-not-an-assertion]],
[[the-console-buffer-follows-you-across-routes]], [[rsc-boundary-invisible-to-gates]],
[[the-suite-never-tests-the-absence]].

---

# a-guard-over-something-erased

> A test specified over a TypeScript type cannot run at all, and its anti-vacuity floor is uncomputable too; separately, readFileSync tests never attend a focused run because vitest related selects by import graph

Ward Flow, 2026-09-04. Two instructions I wrote into build plans and would have shipped:

- _"derive the legs from `TransportLeg`"_
- _"derive the kinds from the `Movement` type's own array/optional fields"_

⚠️ **Both are TypeScript TYPES. They are erased at compile time — no runtime test can enumerate
either.** And each carried an anti-vacuity floor ("fewer than 5 FAILS", "fewer than 7 FAILS"),
**so the floor was specified over something that does not exist at runtime either.**

> **A floor that cannot be computed is not a weaker check. It is no check, described as a strong one.**

**And the failure mode is downstream, not local:** a builder handed _"derive it from the type"_
cannot do it, so they hand-list the members and put the floor under **their own hand-list** — which
is exactly the drift the derivation existed to prevent, now wearing a floor.

**How to apply: before specifying a derivation, name the runtime value it reads.** If the answer is
a type, an interface, a generic parameter or a `satisfies` clause, there is nothing to read. The fix
is this codebase's own established discipline — a companion `as const` array with the type derived
FROM it (`MOVEMENT_STAGES`, `COHORTS`, `SEXES`, `URGENCY_LEVELS`, `REFERRAL_DECLINE_REASONS` are all
that pattern, each added after a hand-written list silently dropped a member).

## ⚠️ The attendance half: `test:focused` cannot select a `readFileSync` test

`npm run test:focused` is `vitest related --run <changed files>` (`scripts/test-focused.mjs`), which
selects by the **module import graph**.

> **A test that reads source with `readFileSync` imports nothing from `src/`, so no edit to its
> subject ever selects it.** It runs only under `npm run test` / `verify:cheap` / CI heavy scope.

**Measured consequence:** `tests/ward-design-language-contract.test.ts` — a `readFileSync` test —
sat RED on the integration line from the day it was written, including the assertion added
specifically to catch a stale list, **while every focused run stayed green**. Its pinned list was
then quoted to three chats as a measurement.

**So: a pinned list is a record, never a measurement — and a check only fails when somebody runs it.
When a plan specifies a source-text assertion, say what makes it attend.** The cheap fix is to have
the same test file import something real from its subject module; that one import puts the whole
file in the graph.

⚠️ **Both halves have the same cure and it is worth noticing: import the thing you are deriving
from.** It makes the derivation possible AND makes the test attend. A source-text derivation buys
an anti-vacuity floor at the price of attendance, and usually you can have both.

Related: [[checks-that-cannot-fail]], [[compliance-without-coverage]],
[[the-suite-never-tests-the-absence]], [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[observations-expire]].

---

# a-fix-can-obsolete-its-own-guards-question

> a central fix made the guard's per-file question the wrong question; the guard stayed green while listing already-fixed files and will report the next adopter as broken

**A fix can change what the correct question is, and the guard goes on asking the old one — green.**

2026-09-04. A print reset moved from ten per-screen patches to one block on the class those screens
`composes`. The guard asked _"does THIS FILE carry a print reset that wins over its own themed
declarations?"_ After the fix the question worth asking is _"is this file's content covered by a
winning reset from anywhere, including a class it composes?"_

    consequence 1   it reports a composing screen as uncovered, so the amnesty list carries files
                    that are already fixed — and the shrink-side assertion stays QUIET about them,
                    because by the guard's own logic they are correctly listed
    consequence 2   the next screen to adopt the layer is covered on the day it adopts, and the
                    guard will call it broken. Both tempting repairs are wrong: a redundant
                    per-file block, or an amnesty row for a file that was never broken.

⚠️ **Third time that guard's SCOPE rather than its logic was the defect. Green every time.** The
durable sentence, from the builder who found it: **green has meant "the question I asked has a
consistent answer", never "the property holds."**

⚠️ **The two-sided pin did not save it.** A shrink-side assertion forces the list down as files get
fixed — but only for fixes the guard's question can SEE. Against a fix outside its scope it is not
merely silent, it actively certifies the stale list as correct.

**How to apply.** When a fix moves WHERE a property is satisfied — hoisting to a shared layer,
a base class, a wrapper, a build step — **re-read the guard's question before trusting its green.**
Ask what the guard would say about a file that is covered by the new mechanism and nothing else. If
the answer is "broken", the guard is now measuring the wrong property, and it will say so first to
whoever adopts the new mechanism next.

And the small one beside it: **a claim about which files do something is one grep away.** I shipped
"three screens do not compose this layer" in a commit message and a code comment; two of the three
were false, carried from a between-session list and never grepped. It named exactly the two files a
reader would have gone and hand-patched.

Related: [[compliance-without-coverage]], [[a-property-that-does-not-discriminate]],
[[assert-only-about-code-you-opened]], [[a-shared-layer-inherits-responsibilities-not-just-properties]],
[[a-true-impossibility-claim-blocks-the-search]].

---

# a-canary-calibrated-as-a-proportion

> The guard fired on our own house style and named the wrong culprit doing it — and the sibling assertion I assumed was load-bearing turned out to be the decorative one

2026-09-06, Ward Flow. `tests/ward-transport-page-name.test.ts` strips comments before searching a
component for a retired name, so the history stays writable. A canary guards the stripper:

```
expect(stripped.length, "the stripper removed most of the file")
  .toBeGreaterThan(component.length / 2)
```

**That measures COMMENT DENSITY, not the stripper.** A retirement marker — 19 lines, 18 of them
comment — took `live-tracker.tsx` to 53% comments, so a **correct** stripper returned 4521 of 9595
chars and the canary failed. The stripper had not been touched in weeks.

⚠️ **The failure message asserted something false in the one place a debugger trusts it**: _"the
stripper removed most of the file"_, on a run where the stripper was innocent. A canary that
misnames its own cause sends the next person to fix the wrong file, and the obvious repair —
loosening the ratio — disarms the guard permanently.

**And the calibration was aimed at us.** This repository asks every one of these files to carry its
reasoning in prose. The guard was set to go red the moment somebody complied.

## 🔴 The part I nearly got wrong

The canary had a second assertion — _"the heading must survive stripping"_ — which reads like the
real check, and the ratio reads like a crude proxy for it. **I was about to delete the ratio as
redundant.** Then I mutated the stripper greedy (`[\s\S]*?` → `[\s\S]*`) to prove my replacement,
and the output began:

```
'"use client";\n\n}\n        <h1 class…'
```

**The `<h1>` SURVIVED a genuinely greedy stripper.** The heading assertion would have passed. The
crude ratio was the only thing catching the defect; the elegant-looking assertion was decoration.

**How to apply: when a guard fires wrongly, mutate in the real defect before removing ANY part of
it.** Which sibling assertion actually catches the fault is not readable from the source — both look
plausible, and intuition picked the wrong one here. Then restate the guard as the property it always
meant, never as a looser version of the proxy:

```
BAD   stripped.length > component.length / 2      moves whenever anybody writes a comment
GOOD  three hard-coded landmarks spanning the file, plus "something was removed"
```

**Landmarks, not derivation** — literal strings cannot share a bug with the stripper they test
([[a-denominator-that-shares-an-assumption]]). **Spanning the file, not one point** — a greedy match
eats the middle, so a landmark above the body and one below it are what catch it. And check the
harmless direction as a fact rather than a quantity: a no-op stripper turns the primary assertion
red anyway, so "something went" is all that is needed and it never moves.

Related: [[a-green-mutation-only-counts-if-the-mutant-ran]], [[read-the-failure-message]],
[[a-comment-that-predicts-an-edit-elsewhere]], [[carry-the-antidote-with-the-assertion]].

---

# a-guard-that-was-obeyed-rather-than-fixed

> Three builders diagnosed the miscount CORRECTLY and all three satisfied it anyway — the guard manufactured the very thing it claimed to observe

2026-09-06, Ward Flow, found by Ward Builder Two in their own guard. A caption check counted
`role="img"` occurrences anywhere in the file. Every carrier copies a canonical stylesheet byte for
byte, **and that stylesheet's own documentation comment contains the literal characters
`role="img"`** — so the count was always exactly one higher than the real number of charts.

🔴 **It did not go red and get fixed. It went red and got OBEYED.** Three independent builders
worked out it was a miscount — correctly — and each then **added a caption for a chart that does not
exist** rather than hand it back. The padding is truthful prose, so it was kept; **the three files
are now indistinguishable from files carrying a real caption.**

⚠️ **This is worse than the failure mode beside it.** We already knew a guard that reddens correct
work gets widened until it means nothing. **This one was COMPLIED with: the artefact was altered to
match a false measurement, by people who had already diagnosed the measurement as false.** A guard
can manufacture the thing it claims to observe, and the evidence it then reports is real.

**Why the diagnosis did not save them:** a red gate is a blocker with a deadline attached, and
"satisfy it truthfully and move on" is cheaper than "hand it back and wait" — especially when the
padding is not a lie. **Each individual decision was defensible. Three of them destroyed the
signal.**

## How to apply

- **When you diagnose a guard as wrong, you may not satisfy it.** Hand it back. Satisfying a guard
  you believe is miscounting is falsifying the population it measures, however truthful your
  addition.
- ⚠️ **Watch for the same red being resolved independently more than once.** One person working
  around a guard is a workaround; three is a guard that has stopped measuring and started dictating,
  and nobody sees it because each fix looked local and honest.
- **A guard that reads a file must exclude what is not code** — comments, embedded stylesheets,
  documentation blocks. This is [[a-comment-can-satisfy-a-guard]] pointing the other way: there a
  comment let a defect pass, here a comment created a phantom subject.
- **And an exception is not a failing assertion.** The same guard called `readFileSync` in a loop, so
  one missing file threw and killed everything after it — reporting "file missing" and nothing about
  the files that were present. Retired wording shipped under that cover. **A throw is the absence of
  every assertion after it, and it reads as one specific complaint.**

Related: [[a-guard-that-red-lights-the-fix]], [[checks-that-cannot-fail]],
[[compliance-without-coverage]], [[a-fix-that-states-a-falsehood-more-confidently]],
[[tests-that-assert-rendering-not-truth]].

---

# specify-the-guard-from-the-code-that-renders

> Two of us agreed on a guard from reading a stylesheet. The rule we were arguing about selected no
> element; a differently-named one did the job live — and the guard we agreed on would have
> condemned it.

**2026-09-06, Ward Flow statistics.** A severity stripe drew three tones at an identical width under
a comment claiming it survived greyscale. A peer noticed the rule matches nothing on any screen, so
it "cannot warn its own future caller" — correct, and we converged on a guard: _the three severity
widths must differ._

Going to find which rows were toned, so the guard could be anchored to something real, turned up
what neither of us had asked for:

```
DEAD   tr[data-tone]    the rule we spent an hour on; only use is on an SVG <circle>
LIVE   tr[data-level]   different file, different name, hue-only, RENDERING NOW
```

🔴 **And the live one is correct.** The row derives its level from a wait duration and prints that
duration in a text column, so colour reinforces something already stated in words. **The guard we
agreed on would have gone red on it and demanded a change it does not need.**

## What to do differently

- **Before writing a guard for a property, find the code that exercises the property.** Not the rule
  that describes it — the call site. The two can have different names, and the one you can find by
  searching for the concept is the dead one, because dead rules attract the explanatory comments.
- **A guard specified from a declaration inherits that declaration's irrelevance.** "Nothing uses
  this" should trigger _"then what does?"_, not _"then guard it for later"_.
- **The obvious guard is wrong in a specific direction: it condemns correct work.** That is the
  expensive failure — see the sections above on what happens to a guard that reddens honest work.
- ⚠️ **Accessibility specifically: the question is never how the flag is drawn, it is whether
  anything is carried by the drawing alone.** A hue-only status colour is fine when the row prints
  the datum the hue stands for. Guard the redundancy, not the rendering.

Related: [[a-comment-can-satisfy-a-guard]], [[the-artefact-you-search-is-not-the-artefact-that-runs]],
[[a-measurement-is-scoped-to-what-it-measured]], [[assert-only-about-code-you-opened]].

## A guard that pinned the MECHANISM where its own rationale named the PROPERTY. 2026-09-09, Ward Flow.

`tests/ward-statistics-grid-tracks-fit-the-container.test.ts` asserted
`/\.main\s*\{[^}]*overflow-x:\s*hidden/`. The origin/main fold changed the declaration to
`overflow-x: clip` and the guard went red **on a change that strengthens what it protects** —
`clip` clips without creating a scroll container, so unlike `hidden` it does not force the
neighbouring `overflow-y: visible` into `auto`.

⚠️ **Its failure message was confidently false**: _"`.main` no longer clips horizontally."_
It clipped. The guard could only see one spelling.

**What makes this the dangerous member of this family rather than a nuisance:** the honest repair
and the destructive one look identical in the diff. Widening to `hidden|clip` keeps every real
failure (`visible`, `auto`, `scroll`, deletion). Widening to `overflow-x:` — one character
shorter to type — passes on all four and the guard is gone with nothing to notice.

**How to apply.** When a guard reddens, first ask whether the NEW value satisfies the guard's stated
REASON. If it does, the guard pinned an implementation. Widen to the set of values that satisfy the
reason, then **prove the widened guard still fails**: I mutated `clip` → `visible` and confirmed
it reddened with its own message. A widening not proved closed is a deletion that still runs.

🔴 **AND FIX THE PROSE IN THE SUBJECT, NOT JUST THE GUARD.** The stylesheet's own rationale,
four lines above the declaration, still said `hidden`. A reason that names a value the code no
longer has is how the next reader concludes the guard protects something else — and it is the
half no test can redden. Same shape as [[a-comment-that-predicts-an-edit-elsewhere]].

## 🔴 THE REPAIR THAT IS CORRECT FOR A POSITIVE CLAIM AND DESTROYS A BAN. 2026-09-09, Ward Builder Two.

A standing ruling on this programme — **"narrow what is READ, never lengthen the spelling list"**
— is right for one class of guard and **inverted for the other**, and the wrong application looks
exactly like the sanctioned repair.

                      wide query                                   narrow query
    POSITIVE claim    a BYSTANDER satisfies it — DEFECT            correct
    BAN (never-says)  correct — the phrase ANYWHERE is the defect  the phrase elsewhere is UNSEEN

⚠️ **Narrowing a ban weakens it, passes every arm, and is indistinguishable in the diff from
the approved fix.** Applied uniformly across a file of mixed guards it damages every ban it touches
and nothing reports it.

Measured: a ban on the retired phrase _"no such field"_ read ONE ELEMENT rather than the page. The
phrase was placed in a NEIGHBOURING element on the same page — **37 of 37 tests passed**, a
withdrawn false claim back on screen with its own ban looking elsewhere.

🔴 **AND THE POPULATION-FINDING ERROR UNDERNEATH IT, WHICH IS THE REUSABLE PART.** I had
reported _"`document.body.textContent` still live at five sites, so the class survived the fix"_.
Wrong. In that file **every body-wide read feeds a NEGATIVE** — four `not.toContain`/`not.toMatch`
and two bans. No positive claim reads the body. **The defect was never "reads the body"; it was
"a POSITIVE claim reads the body"**, and those two sites were fixed weeks earlier.

> **Identifying a class by its MECHANISM rather than by what it PROTECTS finds the wrong
> population** — and a mechanism is what greps well, which is why it is the one you reach for.

**How to apply.** Before generalising any guard repair: **sort the population by what each guard
PROTECTS (asserts a claim / forbids a phrase / asserts an absence), then apply the rule per class.**
A repair validated on one class must be re-argued for the others, never rolled out.

⚠️ **And a page-wide ban needs an anti-vacuity floor** — `expect(page.length).toBeGreaterThan(500)`
— because a page that rendered nothing satisfies every ban trivially. Note the honest caveat its
author attached: **the floors were ADOPTED, not PROVED**, because no honest mutation empties the page
without destroying the render the test needs. See [[compliance-without-coverage]].
