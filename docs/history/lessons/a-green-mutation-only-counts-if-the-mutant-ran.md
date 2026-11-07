---
name: a-green-mutation-only-counts-if-the-mutant-ran
description: "every way a mutation can come back green or red while proving nothing — never ran, ran over inert machinery, caught by the wrong assertion, or a preventative fix over an estate lacking the case"
metadata:
  type: feedback
---

**Consolidated 2026-09-06 from 9 separate memories on one subject**, written from different chairs across a night of six parallel sessions.

⚠️ **Nothing is summarised — each section below is its original entry verbatim.** The merge exists because the index
that points at these has a hard size limit: 9 index lines for one subject crowd out 8 unrelated
memories, which then do not load at all. The only thing given up is recalling one of these without the others.

---

# a-green-mutation-only-counts-if-the-mutant-ran

> Two guards in series make a mutation of the inner one produce a green that reads as a defect — the only failure mode that INVENTS a finding rather than hiding one

**Before trusting a green mutation, confirm the mutated line actually executes in that test.**

**The trap:** defend-in-depth puts two guards in series. Mutate the inner one and the outer one still
stops the action, so nothing changes and the test stays green — **which reads exactly like "the
assertion cannot discriminate."**

**Measured 2026-09-02 on Ward Flow, `ward-ed-screen.dom.test.tsx`:**

```
mutation A   the form's handler guard removed              -> 7 passed   ⚠️ looks like the defect
mutation B   the handler guard AND the button's guard      -> 6 FAILED   <- the truth
```

The outer guard is the repo's standard unavailable-control pattern: `aria-disabled="true"` plus
`onClick={ignoreUnavailableActivation}`, which calls `preventDefault()` and `stopPropagation()`. The
click dies at the button and the form handler never runs at all.

⚠️ **This is the only failure mode in that session that INVENTED a finding rather than hiding one.
A fabricated finding costs more than a missed one — it consumes attention and it arrives with
evidence attached.** I reported it as verified; it was refuted by someone who read the reducer
first and refused to let a green agree with a hypothesis they had been handed.

**Their sentence, which is the whole lesson:** _a green mutation that agrees with your expectation is
the one you never re-examine._

⚠️ **THE PRIMARY RULE IS DULLER THAN "RESIST A CONFIDENT BRIEF", AND THAT IS WHY IT WORKS.** The chat
that caught this refused credit for scepticism and gave the repeatable version instead: _"Had I
mutated first and read second, I would have reported your finding back to you as confirmed — and I
would have had a control in the brief to point at while doing it."_

> **READ THE CODE PATH BEFORE MUTATING IT, SO THE MUTATION HAS SOMETHING TO DISAGREE WITH.**

That is doable by someone who is not being especially alert. "Be sceptical of a confident brief" is
not — it demands exactly the alertness a confident brief consumes. Same file, same question, opposite
order, opposite outcome.

**THE CODEBASE PROPERTY THIS RESTS ON:** Ward Flow guards in depth — an inert `onClick`, a handler
early-return, and a reducer refusal all cover one action. ⚠️ **So single-layer mutation testing is
systematically unreliable in this repo, and it always fails toward "the assertion is weak."** That
direction GENERATES work rather than hiding it, which is why no amount of watching for
tests-that-pass-when-they-should-not would ever surface it — every detection instinct is tuned for
the opposite failure.

**How to apply:**

1. **Read the path first; mutate second.** Then confirm the mutant actually ran — a `throw` in the
   mutated line, or a second mutation one layer out. Green plus "the line never executed" is no
   evidence.
2. **Two guards is the default here, not the exception.** The `aria-disabled` +
   `ignoreUnavailableActivation` pattern is repo policy for unavailable controls, so a UI mutation
   almost always has an outer guard above it.
3. **Read the layer you are reasoning about.** My finding assumed the reducer would refuse an
   incomplete draft. It does not — it checks three fields and deliberately passes the rest, with a
   comment saying gating further "would be inventing a rule nobody has given". **I read the TEST and
   inferred the ENGINE** — see [[assert-only-about-code-you-opened]].
4. **A sweep with no confirmed true positive has unknown precision, not low precision.** Report it
   that way, or the leftovers get priced as worth checking — see
   [[never-produce-a-figure-while-writing]] and [[compliance-without-coverage]].

## Predict the failure COUNT before the run — 2026-09-02

A chat opened the night by warning everyone: **with one test already red, a mutation that breaks a
DIFFERENT test still reads "1 failed" and you will misread it — establish a green baseline first.**

**One message later it restored a stale allowlist entry, mutated on top of it, and got "Failed Tests
2". It had rebuilt the contaminated baseline by hand, having just explained why that must not
happen.**

⚠️ **It cost nothing, and the reason is the whole lesson: the number was WRONG-LOOKING. It expected
one and got two, which forced a second look. Had the pre-existing red been silent, or had it
expected two, the pair would have read as a single result and nothing would have flagged it.**

**So the rule is NOT "remember to take a baseline". Everybody remembers — including the author of
the warning, an hour after writing it.** The rule is:

> ⚠️ **PREDICT THE FAILURE COUNT AND THE FAILING TEST NAMES BEFORE RUNNING THE MUTATION. A count
> you did not predict is the only thing that makes a contaminated run visible.**

**A baseline you forgot to take is invisible. A number that disagrees with a written-down prediction
is not.** It also closes the sibling hole in this file — a prediction naming the test forces you to
notice when the red arrives from somewhere else.

Related: [[green-mutation-that-changed-nothing]], [[checks-that-cannot-fail]],
[[read-the-failure-message]].

## The RED direction: a mutant that never compiled — 2026-09-03

Everything above is about a green that should have been red. **The same trap runs the other way, and
that direction is worse, because a red is what you were hoping for.**

**Measured on Ward Flow.** Probing whether a fixed guard caught a second evasion shape, I mutated two
source files and ran the guard's test file:

```
Test Files  1 failed (1)
     Tests  no tests            <- the whole result, and I nearly published it
EXIT=1
```

**That is not a caught violation. It is a parse error** — my `sed` had corrupted the file, so the test
file could not collect, and vitest reported a failure with **zero tests executed**. Redone properly:

```
Test Files  1 passed (1)
     Tests  10 passed (10)      <- the mutant ran, and the guard did NOT catch it
```

⚠️ **The two runs support OPPOSITE conclusions and their summary lines are both one line long.** The
first says "red"; a red on a mutation is exactly what a working guard produces, so it reads as
_guard works, no finding_. The truth was _guard does not work, finding_. **A parse-error red is
indistinguishable from a caught-violation red unless you look at the count.**

> ⚠️ **REPORT THE COLLECTION COUNT ON EVERY MUTATION, NOT JUST THE PASS/FAIL.** `Tests 10 passed`
> proves the mutant executed. `Tests no tests` proves nothing ran and the result is void.

**Why the count and not the exit code:** both runs exited non-zero versus zero in the direction that
flatters the wrong answer, and neither exit code distinguishes "assertion failed" from "file did not
parse". **The count is the only field that separates them.**

**Two chats hit this independently the same night** — one produced a manufactured finding from a
mutant that never ran, one nearly did. That makes it a property of the method, not of either agent.

**How to apply:** state the collection count in every mutation report, in both directions. A green
mutation needs it to prove the line executed; **a red mutation needs it to prove the failure came
from an assertion rather than from the compiler.** And prefer editing with a parser or a precise
anchored replacement over `sed` on source — a corrupted file is the most common way to get a void run.

## 2026-09-04: THE CONTROL NEEDED A CONTROL, and it failed inside the fix for the same defect

A probe was added to a spec purely as the control — its job was to prove that another measurement
meant something. It looked up two CSS custom properties on a "screen root" selected by
`[class*=screen]`. **CSS-module class names keep the source filename in dev and drop it in a
production build**, so in the run that mattered it matched nothing, fell through to a wrong element,
and returned two EMPTY STRINGS. The test then compared them, found them equal, and printed:

    tokens: --ward-border=  --ward-divider=  |  SAME — the repoint changes nothing

⚠️ **A confident verdict about 28 stylesheets, computed from two blanks, one relay from becoming a
decision.** It came with a run, a comparison and a sentence, which is exactly what makes it
believable.

🔴 **THE CONTROL HAD NO WAY TO REPORT THAT IT HAD NOT RUN.** That is the shape under every instance
of this family: the thing that proves a measurement meaningful is itself a measurement, and gets no
scrutiny because it is "just the control".

**And it was the FOURTH dev-only-selector failure that day — inside the spec written because of the
first three**, hours after every class-name hook in it had been replaced with a stable data
attribute. Knowing about the trap did not help, because **the habit fires when you need a NEW
element, which is precisely when you are thinking about something else.**

### The two fixes, and the first is the general one

1. 🔴 **Prefer a design with NO LOOKUP to a lookup done correctly.** Custom properties inherit, so
   read them off the elements you are ALREADY measuring. There is then no selector to get wrong.
   That removes the class of error rather than the instance.
2. **Give every control an anti-vacuity floor.** An empty/zero/absent reading must FAIL with a
   message saying the dependent comparison cannot be interpreted — never quietly equal another
   empty reading.

### And report at the right granularity

Half that run survived: the two painted colours were read via an ancestor chain and a `data-testid`,
and both resolved. **"Uninterpretable without the tokens" is the accurate report — not "the whole
run was wrong".** Say which half survived.

Related: [[an-alias-defeats-a-name-matching-detector]], [[checks-that-cannot-fail]],
[[a-comment-can-satisfy-a-guard]], [[measure-the-thing-not-a-proxy]].

## 🔴 THE THIRD VARIANT: a mutation that RUNS, edits the file, and still removes nothing

2026-09-04. I claimed a class of assertions could not fail before "something louder" did. To test it
I renamed the function one of them watches:

    useDocumentScrollHideReporter  ->  useDocumentScrollHideReporterRENAMED    31 of 31 GREEN
    useDocumentScrollHideReporter  ->  useDocScrollHideReporterX               1 failed — that
                                                                              assertion, alone

**The first mutation executed. It edited the real file on disk. And it proved nothing**, because the
assertion is `toContain(...)` — a SUBSTRING match — and the suffixed name still contains the
original. The mutant changed the world without removing the thing under test.

That is distinct from both variants above: not a mutant that never ran, and not one the assertions
genuinely cannot detect. **This one ran, changed the file, and left the tested property intact.**

⚠️ **AND IT RETURNED THE ANSWER I HAD ALREADY REASONED MY WAY TO.** I was one step from reporting
"unreachable, confirmed" — the conclusion I expected. **A weak mutation confirms whatever you
expected, and the expectation is what made it weak:** you design the mutation while holding the
hypothesis, so you reach for a change that feels like it should matter rather than one that
provably removes the property.

### The only defence that worked

**Do an independent structural reading FIRST, then treat agreement between it and a green mutation
as a reason to make the mutation HARDER — never as confirmation.** I had read the import graph and
concluded the assertion would fire alone; green disagreed with that reading, so I strengthened the
mutant instead of believing it. Had I skipped the reading, green would have been the whole answer.

### And the naming rule that falls out

🔴 **Name the class from what the mutation PROVED, not from what the reading suggested.** I had
relayed "29 vacuous assertions"; what mutation established was "29 SUBSTRING-matched assertions that
fire on a rename and miss an extension" — smaller, sharper, and with a completely different remedy.
Somebody was one message from deleting them as worthless, which would have removed the only guard on
those symbols in a focused run.

Related: [[a-comment-can-satisfy-a-guard]], [[checks-that-cannot-fail]],
[[check-the-conclusion-that-flatters-the-theme]], [[a-correct-diagnosis-that-stops-the-inquiry]].

## ⚠️ A FOURTH VARIANT: the mutant ran, and a SECOND GUARD absorbed it. 2026-09-04.

A screen's button predicate omitted a `closure` check the reducer enforces. I wrote a test: close a
movement, assert the predicate now blocks. Green. **Then I deleted the closure guard I had just
added — and it was STILL GREEN.**

**The movement my test picked was blocked by the STAGE guard anyway.** The predicate returned
_something_, my assertion only asked whether it returned something, and the guard under test was
never load-bearing for the result.

> **To test guard A, drive to the state where A is the ONLY thing blocking — then assert.**

The fix was the sequence a human had driven by hand: advance the movement until the action is
genuinely available (`expect(predicate(m)).toBeUndefined()` as a stated PRECONDITION), _then_ apply
the closure, _then_ assert it blocks. And separately confirm the reducer really refuses the press,
so the two implementations check each other rather than one checking my belief about the other.

⚠️ **The tell is an assertion of the form "returns something" / `toBeDefined()`.** It cannot
distinguish which of several guards produced the value. A test that cannot say WHICH guard fired is
not testing any of them.

## And the population floor is what surfaced the rest

The same guard went RED on its own anti-vacuity floor before it was worth anything: **the seeded
fixture never reaches three of the four states**, so a sweep over it would have passed by walking an
empty list. Measured: 50 movements, 8 with a transport job, and the only one at the needed stage was
already past it. **The floor is what turned "green" into "green because it drove nothing".**

Related: [[which-assertion-went-red]], [[a-property-that-does-not-discriminate]],
[[a-comment-can-satisfy-a-guard]] (the `scrollWidth` guard hung on a precondition it did not control),
[[unreachable-over-which-paths]].

## One green injection proves a gate can fail SOMEWHERE — 2026-09-06

A peer found a guard reporting `3 passed` after they injected two genuine regressions into a file:
the gate had quietly stopped guarding, and making it fail to fail is the right instrument.

⚠️ **But they injected into ONE file, and the conclusion was drawn about the gate.** A gate can be
unfailable for a reason specific to one file — a selector shape its parser does not handle, a
nesting depth, a media query, a syntax nobody else uses. **Fixing the accounting does not fix a
blind parser, and re-running the injection only where it was first run cannot tell you which you
had.**

**How to apply: the success condition for a repaired gate is the NUMBER OF FILES in which a planted
regression turned it red — never "the counts are clean and the suite is green."** A clean count plus
a blind parser is the most convincing green a gate can produce and the least informative.

⚠️ **And the same failure from the other side, mine, the same night:** my mutation inserted a
violation three lines from the wrong end of a function, outside the guard's window. It stayed green
— **indistinguishable from a guard that cannot fire**, and this is the direction that INVENTS a
defect rather than hiding one, so the invented defect gets "fixed". What separated them was going
and finding where the guard's window actually sat.

**Both directions reduce to one habit: before believing a green mutation, prove the mutant was in
the gate's field of view.** Related: [[a-written-diagnosis-does-not-sweep]],
[[green-mutation-that-changed-nothing]], [[compliance-without-coverage]].

## A probe that changes bytes but mutates nothing — and the site it lands at — 2026-09-06

Two ways an append-style mutation returns `SURVIVED` while proving nothing. Both found on review of
a mode I had just built, after I had already fixed the degenerate version of the first.

**1. A PROBE THE GATE CANNOT SEE.** Appending a comment changes the bytes, so the harness's
"the mutant landed" hash check is satisfied — but nothing functional was mutated, so nothing can go
red, and the verdict reads _"no assertion covers this"_. ⚠️ **It cannot be refused mechanically: a
comment IS a legitimate probe for a guard that scans comments.** I had closed the case where the
probe is _empty_; this is the case where it is _real and invisible_, and only the second matters in
practice. **The reviewer also spotted that my own self-test's example probe was a comment** — correct
for what that case asserted, and the hazard sitting inside the example somebody copies.

**2. AN APPEND CHOOSES THE SITE FOR YOU.** With find/replace you place the mutant where the guard
looks. Appending always lands at end of file, top level, outside every at-rule — **so a guard that
only inspects inside a media query reports SURVIVED while being perfectly correct not to look
there.**

    CAUGHT    unchanged in strength
    SURVIVED  weaker: "nothing covers a probe AT END OF FILE", not "nothing covers this"

**A survival is the verdict people ACT on**, so that asymmetry has to sit where somebody meets it —
we put it in the CLI usage text, not only the doc comment.

⚠️ **And the ordering luck worth naming.** I caught my own version because a case I had written
ninety seconds earlier went red, and I concluded _the guard is wrong_ rather than _my test is
wrong_. **The available explanation is always the one preserving the work you are most attached to,
and the newest artefact is the one with the least attachment.** Had I written that case a day later
I would have deleted it. Related: [[a-control-must-test-the-premise-not-the-measurement]],
[[which-assertion-went-red]].

---

# green-mutation-that-changed-nothing

> A mutation that never executes is indistinguishable from one the assertions cannot detect — and it produces a confident FALSE POSITIVE, not a miss

2026-09-02, Ward Flow. Mutation testing is the technique reached for when a green test is no
longer believed. **It produced the night's only false positive — a defect that did not exist.**

## The rule, which goes above any finding it corrects

> **Before trusting a GREEN mutation, confirm the mutated line actually EXECUTES in that test.**

A mutation that changes nothing and a mutation the assertions cannot detect **look identical from
where you are standing**: the suite stays green either way.

## Two guards in series

Six assertions were reported as unable to tell a screen blocking a bad submission from the engine
catching it downstream. Measured:

```
mutate the form handler's early return alone   -> 7 passed  ⚠️ LOOKS EXACTLY LIKE THE DEFECT
mutate that AND the button's inert onClick     -> 6 FAILED  <- the real answer
```

The button carried `onClick={blocked ? ignoreUnavailableActivation : undefined}`, and that helper
calls `preventDefault()` **and** `stopPropagation()`. **The click died at the button; the handler
never ran.** It was never the engine catching a dispatch — **no dispatch ever happened.**

⚠️ **Mutating the second guard while the first still holds proves nothing about either.** And the
shadow always reads as "the assertion is weak", which is a finding, not a miss — so it gets
reported, believed, and acted on.

**Twice in one evening, so treat it as a property of the codebase rather than of the person:** code
that guards in depth (inert `onClick` → handler early-return → reducer refusal, three layers on one
action) will shadow a mutation aimed at any single layer.

## Why it was caught, which is repeatable and is not "being careful"

**I had read the source before running the mutation, and the result contradicted my reading.**

Everything about how the task arrived pushed the other way: a hypothesis handed down, a control
already built into the brief, framed as verified, from the most reliable peer. ⚠️ **A green mutation
that agrees with your expectation is the one you never re-examine.**

**How to apply:** read the code path before mutating it, so the mutation has an independent reading
to disagree with. Then, for any green mutation, ask the cheap question — _did that line run?_ — and
answer it by mutating one layer further out until something goes red, or by confirming from the
source that the path reaches it.

## Companion: do not add an assertion you cannot demonstrate today

The proposed repair was to assert a rejection count. **Under the current reducer that count never
moves in these cases**, so the assertion could not be mutation-proved. ⚠️ **An undemonstrable
assertion is a check that cannot fail, added in the name of preventing checks that cannot fail.**
The right sequencing is to add it after the engine change that makes it demonstrable, and prove it
against that engine — filed as owed work **with its trigger named**, not as a repair skipped.

Related: [[checks-that-cannot-fail]], [[run-the-mutation-before-relaying]],
[[restoring-a-mutated-file]], [[a-correct-diagnosis-that-stops-the-inquiry]],
[[measure-the-thing-not-a-proxy]].

## The third variant: a mutation that RAN, changed the file, and still did not remove the thing under test

2026-09-04. An assertion read `toContain("export function useDocumentScrollHideReporter")`. To test
whether it could fail, the mutation renamed the symbol:

    useDocumentScrollHideReporter -> useDocumentScrollHideReporterRENAMED    31 of 31 GREEN
    useDocumentScrollHideReporter -> useDocScrollHideReporterX               1 failed, and it was
                                                                            that assertion, alone

⚠️ **The first mutation executed, edited the real file, and proved nothing** — because `toContain`
is a SUBSTRING match and the suffixed name still contains the original. The mutant ran; it just did
not remove what the assertion was looking for.

⚠️ **And it returned the comfortable answer.** The session was about to report "unreachable,
confirmed" — the conclusion it had already reasoned its way to. It caught it only because green
disagreed with a structural reading it had done first, so it made the mutation _stronger_ rather
than believing it. **A weak mutation confirms whatever you expected, and the expectation is what
made it weak.**

**The finding that survived is sharper than the one it replaced.** The defect is not that the
assertion cannot fail — it fires first and alone on a real rename, so deleting it would remove the
only guard on that symbol in that run. The defect is **substring-ness**: it catches a rename and
misses an extension. Different remedy — anchor the match, or assert the exported symbol rather than
its source text.

**How to apply.** When a mutation comes back green, ask _did I remove the thing the assertion looks
for, or something adjacent to it?_ For a substring assertion, the mutation must break the substring —
a prefix-preserving rename does not. And ⚠️ **name the class from what the mutation proved, not from
what the reading suggested**: "vacuous / cannot fail" was wrong, "substring-matched" is right, and
somebody acting on the first description would have deleted live guards.

## A THIRD SIBLING, 2026-09-04: the mutant ran, and the assertion was RIGHT to stay green

I offered a mutation that reworded a fallthrough sentence and claimed it restored a defect while the
guard stayed green. Both halves were wrong, instructively. MEASURED: four closed movements DO reach
that fallthrough, so the mutant executed — not the never-ran case. But all four carried
`blocker: "No blocker"`, for which my mutated sentence _"No blocker was recorded before this movement
closed."_ is **true**, and the guard's own filter excluded exactly those four. The mutation
reintroduced no defect anywhere and the green was correct.

⚠️ **A mutation is evidence only if the population it changes OVERLAPS the population the defect
lives in.** Mine landed on a disjoint set. Three checks before reporting a green mutation as a hole:
did the mutant run; does the assertion observe the members it ran on; and **is the mutated output
actually false for those members**. I did the first two and skipped the third — in the same document
where I was reporting somebody else for flooring the wrong population.

⚠️ **The peer who caught it got the conclusion right and the mechanism wrong** (they said it never
executed). Two different faults produce an identical green, so agreeing a mutation is invalid is not
agreement about why — and the why is what you carry to the next one.

Related: [[a-green-mutation-only-counts-if-the-mutant-ran]], [[a-guard-that-pins-the-old-wording]],
[[floor-the-denominator-never-the-numerator]].

## The fourth variant, and it is the one I got wrong while correcting somebody else

A reviewer offered a mutation of a fallthrough branch; it stayed green. **I diagnosed it as "the
mutation never executed" and said so. That was wrong**, and the reviewer measured the truth:

    closed movements: 7
      "None — handover complete"      1   WF-007      -> a named arm
      "Patient declined transfer"     1   WF-008      -> REACHES the fallthrough
      "Awaiting destination response" 1   WF-300      -> REACHES the fallthrough
      "No blocker"                    4   WF-307,314,321,328 -> REACHES the fallthrough

**Six of seven reach it. The mutation executed and changed four pages.** It stayed green because for
those four the mutated sentence was TRUE — their blocker really is "No blocker", so "no blocker was
recorded" is not a false statement, and the guard's own filter excludes them on purpose.

⚠️ **So the fourth variant is: the branch's population is DISJOINT from the defect's population.**
The mutant runs, the output changes, and no defect is reintroduced anywhere. Distinct from a mutant
that never runs, from one the assertions cannot detect, and from one that fails to remove the thing
under test.

⚠️ **And note where I went wrong: I was correcting somebody else's mutation and reached for the
explanation I already had a name for.** "Green mutation that never ran" was in my notes; "population
disjoint" was not. **A diagnosis drawn from a catalogue you already hold is the one to check hardest**
— it arrives fluent and it did not come from the evidence.

**How to apply.** Before calling a green mutation invalid, MEASURE which records reach the mutated
branch, and ask whether the mutated output would be false for any of them. If it would be true for
all of them, the mutation was aimed at the wrong branch — mutate the branch the defect's own
population actually reaches.

## The fifth variant, and the only one that FABRICATES a finding: the mutation was never applied

2026-09-04. A mutation task had been "running" for 34 hours. It had hung on its **first line**,
before touching the file:

    python3 - <<'PY' 2>/dev/null || sed -i '…inject the mutation…' "$F"
    PY

**An empty heredoc as a guard, with the real mutation in the `||` fallback.** `python3 -` with an
empty body blocks forever reading stdin, so the task never reached the `sed`, never mutated, never
ran the tests. Reproduced deliberately; it hung a second shell too.

🔴 **The hang is not the danger — a hang is eventually visible.** The danger is the SHAPE: the
mutation sits in a fallback arm, so **if the guard succeeds for any reason the mutation is silently
skipped and everything downstream runs against clean source.** The tests then pass and the run
reports _"the guard did not catch mutation B"_. **That is a fabricated finding — manufactured, not
missed** — and it is the only variant of this family that invents a defect rather than hiding one.

⚠️ The script even had a `grep -n -A3` of the mutated constant on the next line, which would have
shown the mutation absent — **as printed output nobody was going to read, not as a gate.**

**The rule: a mutation run must PROVE the mutant is in the file before it runs the tests.** Assert
the injected text is present, or diff against HEAD, and **abort loudly** if not. Never infer
application from a command having exited.

## And the exit-code masking, now four instances

    bjmcqh8mh    script says REAL EXIT: 1    harness says [exited with code 0]
    bwrhhvpm6    script says REAL EXIT: 1    harness says [exited with code 0]
    a Playwright run   log says E2E_EXIT=1   notification says exit code 0
    a production build log says exit 76      wrapper says exit 0

**Always in the direction of hiding a failure.** The only reason the truth was recoverable in the
first two is that the scripts carried an explicit `REAL EXIT:` echo. **Make that standard for
anything whose result anybody will act on**, and read the log, never the summary.

## The sixth variant, 2026-09-05: the mutant ran, was well-formed, and was in the wrong PLACE

A CSS guard found a rule by matching its selector as literal text and scanning forward to the next
opening brace. A mention in a comment was therefore also a match, fabricating a rule body — so
documenting the rule made its own guard fail. To prove it I put a comment naming the selector
**inside the rule body**. SURVIVED, on the broken code.

**The pattern allows no brace between the mention and the next opening brace, and inside a body the
next one that matters is that body's own closing brace. That location cannot reproduce the defect
with or without the fix.** Measured, both placements, code with and without the repair:

    inside the rule body        no strip: 1 body ["1fr"]      strip: 1 body ["1fr"]
    above a DIFFERENT rule      no strip: 2 bodies ["1fr", "minmax(9rem, 14rem) 1fr"]
                                strip:    1 body   ["1fr"]

⚠️ **A mutation aimed at the wrong LOCATION is indistinguishable from an assertion that does not
cover the property.** Sibling of the population-disjoint variant above, in space rather than in
data: there the branch ran on the wrong records, here it ran in the wrong part of the file.

## And the mirror — the only variant that fabricates a RED

Variant 5 fabricates a SURVIVED. **This one fabricates a CAUGHT, and it is easier to hit.** My first
mutation's replacement text contained a literal backslash-n, so what landed was the comment PLUS an
invalid declaration. It went red — for a defect I had introduced, not the one I was testing.

🔴 **A malformed mutant and a real defect are identical from the exit code.** Nothing in a harness
checks that the mutant is the mutant you described; it only checks that something changed. So:
**after applying, print the mutated region and read it** — the same discipline as proving the mutant
is present, extended to proving it is the right one.

⚠️ **Even the repair's own witness fired on the wrong branch.** The stylesheet comment now names the
selector deliberately, so removing the fix makes the guard go red against the shipped file. First
version: my explanatory prose contained literal braces, the unstripped scan stopped on a brace in a
_sentence_, and it failed as "absence is not single-column" instead of with the two-track value.
Right colour, wrong cause — invisible from the verdict.

**The habit that caught all three, and it is cheap: print what the mutant actually produced — the
matches, the bodies, the values — not just the verdict, and predict the failure message before
running.** A message that differs from your prediction is a finding even when the colour is right.
See [[which-assertion-went-red]] and [[read-the-failure-message]].

⚠️ **And the diagnostic probe that first exposed my contradiction was itself broken**: written
through a bash heredoc, which collapsed the doubled backslashes in its regex and turned backslash-b
in a template literal into a real backspace byte. It reported zero matches for a rule plainly in the
file, exit 0. Third instance of that trap in one session — **probe scripts get written with a file
tool, never a heredoc**. See [[backslash-b-becomes-a-backspace]].

---

# a-green-mutation-over-inert-machinery

> A mutation that stays green means either the tests are weak or the code is decoration — the two look identical and the fixes are opposite

2026-09-04. Building the Ward Flow contention model, I collected per-unit claims in a `Map` keyed by
movement id, with a comment stating that **the key is what prevents one patient claiming a ward
twice**. Eleven mutations were run against the finished function. One replaced the whole `Map` with
a plain pushing array.

**All twelve tests stayed GREEN.**

**The machinery could not fail.** Each movement is visited once per unit and the two branches are
mutually exclusive through a `continue`, so the key had nothing to collide with. The `Map` changed no
outcome the code could reach — and its comment asserted a mechanism that was not operating.

⚠️ **THE TWO READINGS OF A GREEN MUTATION ARE INDISTINGUISHABLE AND THEIR FIXES ARE OPPOSITE.**

- _"My tests are too weak to detect this"_ → **add an assertion.** Wrong here: no assertion could
  ever have failed, so the new test would have been a second thing that cannot fail.
- _"This code is inert"_ → **delete it, and find what is really doing the work.**

The deciding question is not about the tests at all: **can any input reach a state where this
machinery changes the answer?** For the `Map`, no — and once that was asked, the real safeguard was
obvious: the `continue` and the branch order. Two further mutations (remove the `continue`; swap the
branches) each took the same test red, so the guard that was actually load-bearing is now the guard
that is pinned.

⚠️ **AND THE COMMENT IS WHY THIS WOULD HAVE SURVIVED REVIEW.** Inert code with prose vouching for it
is worse than absent code: a reviewer reads the comment, recognises the intent, and stops. The
duplicate-claim risk was real; the thing named as handling it was not.

⚠️ **IT HAPPENED A SECOND TIME THE SAME NIGHT, IN THE SAME FILE, AFTER THIS WAS WRITTEN.** A
guard read `competing.length < 2 || competing.length <= allocatable`. Deleting the first half left
all 25 tests green — a unit with nought or one claim yields nothing from the loop below whatever the
guard says. **Two pieces of inert machinery, written hours apart, by someone who had just recorded
the lesson.** The shape both times was a defensive clause added while thinking about a hazard that
the surrounding control flow already made unreachable.

**So the trigger is not "a mutation came back green" — that is too late.** It is **writing a guard
against a case you have not shown can occur**. Ask it at the moment of writing: what input reaches
this line with the bad state? If you cannot name one, the guard is decoration before it is ever
tested.

⚠️ **AND WHEN THE INSTANCES ARE COUNTED, COUNT THE SOURCES.** By the end of the night four
instances of this class had been named across three sessions — two of them mine. **A peer pointed out
that my two are attested by a single comment in a single file, so they are one source, not two
independent confirmations: four instances, three discoveries.** The distinction matters because a
tally is what turns "somebody was careless" into "this is what guards here do by default", and an
inflated tally makes the second claim on evidence that cannot support it. **Every instance found by
the same method, by the same person, in the same file, is one observation repeated.**

**How to apply:** treat every green mutation as an open question with two answers, never as "the
suite is fine". Ask whether the mutated construct can change any reachable outcome BEFORE reaching
for another test. When the answer is no, delete the construct and mutate again to find what was
really holding the property — and rewrite the comment to name that, because the old comment is now
evidence of a mechanism nobody has.

**Second finding the same hour, worth keeping beside it:** twelve tests passed GREEN while `tsc` was
RED on the same file — an import of a type from a module that does not export it. **Vitest runs no
typechecker**, so the iteration loop is blind to type-only breakage; only the separate `tsc` step
sees it.

Related: [[checks-that-cannot-fail]], [[which-assertion-went-red]],
[[a-green-mutation-that-changed-nothing]], [[a-comment-can-satisfy-a-guard]],
[[the-suite-never-tests-the-absence]], [[a-guarantee-that-holds-one-direction]].

---

# mutation-testing-is-blind-to-false-reds

> every mutation asks \"does the guard notice wrong code?\" and none asks \"does it accept right code?\" — and the false red is the more dangerous half, because the natural repair damages the code

**A mutant is by construction wrong code.** So mutation testing asks one question — _does the guard
notice wrongness?_ — and is structurally silent on the other: _does the guard accept rightness?_
That second one is the half a real contributor meets every day.

2026-09-04. Two guards written and mutation-proved within an hour; a reviewer found a live defect in
each, **both in the direction no mutation tests.**

    guard 1   required `background-color: Canvas !important`
              -> `background: Canvas !important` is identical in effect and went RED

    guard 2   allowed three phrasings of a denial and called it a property
              -> "awaiting acceptance", "Nobody has accepted this patient",
                 "0 wards have accepted" all went RED on truthful copy

🔴 **THE FALSE RED IS THE MORE DANGEROUS HALF.** A false green leaves the defect where it was. **A
false red manufactures one** — faced with a red test and working code, the natural repair is to
change the working code until the test passes. The guard wins, the code gets worse, and every gate
is green afterwards.

**The rule: alongside every mutation, write the equivalent-but-differently-spelled CORRECT form and
require GREEN.** The shorthand instead of the longhand, the alias instead of the token, a reworded
sentence, a reordered selector list. A seven-case matrix with three must-stay-green rows costs
minutes.

⚠️ **And note the mirror image, which is the failure this one hides behind:** a substitution that
LOOKS equivalent and is not (`--cti-leading-body` = 1.45 is `relaxed`, not `body`). **Guards need
both directions: a substitution that is equivalent and does not look it, and one that looks
equivalent and is not.**

**A second, unrelated finding from the same fold, worth keeping beside it.** Two sessions
independently added the same helper to one file. **Git found no conflict, because a conflict
requires the same region changed DIFFERENTLY** — two compatible additions are just two additions. It
kept both copies and only `tsc` saw it.

> **Convergent effort is invisible to the tool we use to detect collisions. The more alike two
> sessions' work is, the less likely it is to conflict.**

Same mechanism as one print defect being patched independently on four branches all night with zero
merge signal: disjoint files, no shared lines, `merge-tree` quiet, every session believing it had
fixed _the_ defect. **A clean merge is not evidence of a coherent tree.** When several sessions are
told to fix one class of defect, check for duplication **by symbol name**, not conflict by diff.

Related: [[a-control-must-test-the-premise-not-the-measurement]], [[a-guard-that-pins-the-old-wording]],
[[identical-work-produces-no-conflict]], [[green-mutation-that-changed-nothing]],
[[an-alias-defeats-a-name-matching-detector]], [[a-property-that-does-not-discriminate]].

---

# which-assertion-went-red

> Watching a suite go red is not enough — check that the assertion you care about is the one that fired; a filter plus an assertion over the same predicate is a tautology

Ward Builder One shipped five assertions guarding Playwright spec routing. **Two were
tautologies by construction**: they filtered the spec list to "matches the mockup pattern AND
NOT the production pattern", then asserted the production pattern did not match. `false ===
false`. Four mutations ran straight past them while the suite stayed green.

**It found them only because the mutation report had two assertions that never appeared in any
CAUGHT BY line.**

**Why:** a tautology is invisible in a green run and, in a test listing, reads exactly like
coverage. The usual discipline — write the test, watch it fail, watch it pass — does not catch
it, because _some_ assertion in the file does go red and the run looks correct.

**How to apply:** when mutation-testing, record WHICH assertion caught each mutation, not just
that the suite failed. Any assertion that never appears as a catcher across the whole mutation
set is a candidate tautology. And when a test filters a collection by a predicate and then
asserts something about that predicate, it is almost always circular — assert over the thing
(compute both sets independently and intersect them) rather than over the predicate.

Three variants of the same shape appeared in one night from three different chats: this one, a
prefix-derived token candidate list that could not report its own omissions, and a negative
assertion placed after an exact `.toBe` on the same value. All three are constructions that
cannot report their own emptiness.

Related: [[checks-that-cannot-fail]], [[a-property-that-does-not-discriminate]],
[[a-green-mutation-only-counts-if-the-mutant-ran]], [[compliance-without-coverage]],
[[a-written-diagnosis-does-not-sweep]].

## The sibling shape: a test that finds its case absent and returns — Ward Flow, 2026-09-06

Three tests in one file could not fail, and all three guarded the ordering of the two LEGAL
AUTHORITY delay causes — the ones the screen puts first.

    "ranks legal_breached above legal_expiring when both are present"
        read both groups, returned early when either was missing. Neither is EVER populated by
        the fixture. Zero assertions, every run, since it was written.
    "puts an expiring legal authority first"
        fell into a branch asserting the array did NOT contain the thing whose absence was the
        condition of that branch. The tautology this entry is about, one level up.
    "returns a negative figure once the deadline has passed"
        filtered for a passed deadline, found none, returned.

**Swapping the two entries in the ORDER table — so an already-expired legal authority ranks BELOW
one merely approaching — left the file at 15 of 15 and every other ordering test at 18 of 18.**

⚠️ **The tell is not "a test with no assertions" — nobody writes those. It is a docblock that
EXPLAINS why the case is not exercised.** That sentence is the author telling you the test does not
run. One of them said the early return let it "hold in both the case where the fixture starts
exercising the group later and the case where it never does" — **holding in both cases is the
defect**, because a test passing vacuously is indistinguishable from one passing because the
property holds, and a SKIPPED test at least reports as skipped.

⚠️ **And the fixture is almost never the obstacle.** All three functions were pure. Cloning one
seeded record with one field moved populated every missing case, with no new seed and no wait.
"Cannot be exercised without inventing fixture data" was false of a pure function: moving `dueAt` is
supplying the argument, not inventing data. Related: [[a-green-mutation-that-changed-nothing]],
[[the-suite-never-tests-the-absence]], [[a-property-whose-operands-can-coincide]], [[establish-the-unit-before-counting]].

## Which LAYER the catcher proves — three of my four mutations only proved a helper, 2026-09-06

Every mutation ran, every one went red, every message named the right thing. And three of the four
proved nothing about the gate.

M1, M3 and M4 mutated logic reached through **exported functions fed synthetic input** — a fixture
string in, a classification out. Real reds, real catchers, and all of them one layer below the
thing that ships. **Only M2 changed a constant that the walk, the classifier and the register all
read, over the real tree** — and it named five actual files. **Only M2 could have caught a
classifier that was correct and wired to nothing.**

⚠️ **A correct helper connected to no call site passes every unit-level mutation you can write for
it.** The red proves the helper is not vacuous; it says nothing about whether the gate consults it.
That is the same family as a guard that never runs, arriving from the opposite side: here the code
runs, the assertion discriminates, and the _scope of what was proved_ is smaller than the sentence
you are about to write about it.

**How to apply: for every mutation, name which layer goes red — unit or wired.** A proof set with
no mutation that travels the real input to the real assertion has not tested the gate. **The cheap
tell: if a mutation's red could be produced with the rest of the file deleted, it is a unit test
wearing a mutation's clothes.** I stopped at three and added the only load-bearing one last, which
is the order to distrust. Related: [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[compliance-without-coverage]], [[a-measurement-is-scoped-to-what-it-measured]].

## A red from an incidental catcher reads as "your finding was unnecessary" — 2026-09-06

A reviewer found that my guard used a `Set` where it needed a multiset, forgiving a violation that
shared a line with a valid one. I fixed it, then ran the control both ways:

    multiset tally      ->  RED, naming it: "2 path-bearing, 1 parsed"
    reverted to a Set   ->  1 failed        <- STILL A RED

**`1 failed` reads as "the guard held anyway, the fix was unnecessary."** It was not. The arm under
test said **nothing**. The failure came from an unrelated sanity floor that pins **three named
files** to exactly one declaration each — **an incidental catcher covering 3 of 51 files**, which
happened to include the one I planted in.

⚠️ **Counting reds would have retired a correct finding. Naming the assertion kept it.** And the
danger is specific to controls run against a real tree: a mature guard file has several arms, and
any of them may fire for reasons that have nothing to do with the one you are testing.

**How to apply: a mutation control must name the assertion that caught it, and check that assertion
is the one under test.** `Tests 1 failed` is not a result. Where the catcher is a floor pinned to
named files, ask what fraction of the population it covers before letting it stand as coverage.

**And the same run produced the opposite lesson from the harness:** its first verdict was
`🔴 THE MUTANT SURVIVED`, which was **correct** — reverting a _preventative_ fix against a tree
containing none of the case it prevents changes nothing. ⚠️ **A preventative fix cannot be proved
over an estate that lacks the case; the proof has to be planted.** A harness that had said "caught"
there would have been worse than none. Related: [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[a-property-that-does-not-discriminate]].

---

# a-guard-proved-in-one-direction-only

> Mutation testing proves a guard catches wrong code; it never proves the guard passes right code, and the natural repair for a false red is to break the code

Every mutation run across the Ward Flow print work, 2026-09-04, had the same shape:
**make the code wrong, watch the guard go red.** Three mutations on the `composes` resolver, two on
the coverage guard, one on the `it.fails` pin. All passed. All tested one direction.

**Both defects actually found in those guards were the OTHER direction — a guard going red on
CORRECT code:**

    required `background-color` specifically   -> `background: Canvas !important`, identical in
                                                  effect, would have gone RED on correct CSS
    walked a hardcoded eight-file list         -> a correct file it never opened read as a pass
                                                  (the same axis, failing silent instead of loud)

⚠️ **AND THE FALSE RED IS THE MORE DANGEROUS HALF, because of what the repair looks like.** Faced
with a red guard and working CSS, the natural move is **to change the working CSS to satisfy the
test.** The guard wins, the code gets worse, and every gate is green afterwards. A false green
leaves the defect where it was; a false red actively manufactures one.

**Why mutation testing cannot see it:** a mutant is by construction wrong code. The whole method
asks "does the guard notice wrongness?" and is structurally silent on "does the guard accept
rightness?" — which is the half a real contributor meets every day.

**How to apply:** prove a guard in BOTH directions. Alongside each mutation, write the equivalent-
but-differently-spelled CORRECT form and require GREEN — the shorthand instead of the longhand, the
alias instead of the token, the reordered selector list, the extra whitespace. Where a guard matches
text, enumerate the spellings that are equivalent in EFFECT and accept all of them.

Same shape as the `--cti-leading-body` catch: a substitution that looks equivalent and is not.
Here it is the mirror — a substitution that IS equivalent and does not look it.

Related: [[a-property-that-does-not-discriminate]], [[checks-that-cannot-fail]],
[[floor-the-denominator-never-the-numerator]], [[an-alias-defeats-a-name-matching-detector]].

---

# predict-the-count-not-just-the-colour

> Predicting 23 reds and getting 1 exposed 22 vacuous assertions; a mutation with no pre-registered count can only report red or green

**"I predicted 23. It reddened one."** — Ward Builder One, 2026-09-06.

Deleting the owner's ruling from `openBedsNow` should have reddened one case per ward. It
reddened **one case total**. `bedsPendingPreparation` is zero for 22 of 23 units, so for those
the assertion compared `max(0, ready − 0)` against `max(0, ready − 0)` — **satisfied whatever the
code does.** The whole ruling rested on a single fixture row; delete that row and every case
stays green while guarding nothing.

⚠️ **A prediction of "1" would have passed without comment.** Red was the right colour, the
mutant was caught, and every report would have said so truthfully. **The finding exists only
because a number was committed to in advance and then disagreed with the result.**

> **A mutation with no pre-registered expected count can only tell you red or green. One with a
> count tells you how much of the suite is actually watching.**

**How to apply:**

- Before running a mutation, write down **how many cases should redden and which**. Then compare.
  A disagreement in _either_ direction is a finding: fewer means vacuous assertions, more means
  the mutation is broader than intended.
- Floor on the **discriminating** population, not the loop length. The loop here was already 23
  and told nobody anything; the useful floor is "at least one unit must actually have a bed
  pending preparation".
- Same family as [[which-assertion-went-red]] (which assertion, not how many) and
  [[a-floor-whose-failure-is-a-bare-zero]] (what the failure says).

**Companion failure from the same session:** the chat's own mutation reporter scored a run that
executed **zero** tests as `0 failed — MATCHES PREDICTION`. A lock refusal exits 1 having run
nothing. ⚠️ **A run that executed nothing is neither a green nor a red, and scoring it either way
invents a result rather than losing one.** Fixed by refusing to report any run whose case count
is not the expected number — see [[heavy-lock-refusal-looks-like-failure]] and
[[two-task-lists-one-check]].

---

# caught-and-survived-are-not-equally-strong

> In append-mode mutation, CAUGHT is as strong as ever and SURVIVED is much weaker — and the weak one is the verdict people act on

A mutation harness gained an `--append` mode (place the probe at end of file, no anchor) so
sweep-shaped controls could use it. Ward Builder Three's review, 2026-09-06:

> **`CAUGHT` in append mode is as strong as ever. `SURVIVED` is weaker** — it means _"no assertion
> covers a probe at end of file, of whatever kind you supplied"_, not _"no assertion covers this"_.
> ⚠️ **A survival is the verdict people act on, so that is where the qualifier has to live.**

**Two reasons `SURVIVED` weakens:**

1. **The probe may be inert for that gate.** An empty probe was refused, and the boundary check
   (`trim() === ""`) closes the whole whitespace class. But `/* comment */`, `;` and
   `@media print{}` all **run and survive** while carrying no functional mutant.
2. **The mode chooses the site.** `--find` puts the mutant where the guard looks; append puts it at
   end of file, top level, outside every at-rule. A guard that only inspects inside
   `@media (forced-colors: active)` reports `SURVIVED` **while being perfectly correct not to look
   there**.

🔴 **And the class cannot be closed by a check.** The refusal is **syntactic** — _is this
whitespace?_ — while the property that matters is **semantic** — _can the gate under test see it?_
**Inertness is relative to the gate, not to the string**: `@media print{}` is inert for a
status-colour ratchet and a perfectly good probe for a print-styles guard. No input validation can
decide that.

**How to apply:**

- Treat an asymmetric-strength verdict as a **documentation** problem, not a guard problem, and put
  the qualifier on the verdict people act on.
- Generally: before adding an input check, ask whether the property you want is syntactic or
  semantic. A syntactic test can only ever close a syntactic class — see
  [[a-property-that-does-not-discriminate]].
- Companion: [[predict-the-count-not-just-the-colour]] and
  [[a-green-mutation-only-counts-if-the-mutant-ran]].

---

# a-red-that-is-load-bearing

> Some failing tests are the only surviving record of an unanswered question — read what a red asserts before recommending how to silence it

**Before proposing to convert, skip, quarantine or delete a failing test, read what it asserts and
why it fails.** A red can be a defect nobody has fixed — or it can be a question nobody has
answered, deliberately held visible because a test is the only artefact that will not let it be
forgotten. The two look identical in a run summary, and the second is destroyed by every fix that
targets the first.

**Why:** the pressure to silence a red is procedural, not technical. It comes from wanting the suite
to read clean, and it arrives with a plausible mechanism attached. Nobody proposing it has usually
read the test — I recommended converting one to an expected-fail, twice, in writing, to two
different people, having read only its name and the run summary.

**Established 2026-09-06 on Ward Flow.** A ward suite carried "one deliberate red". A peer reported
that the filter was unusable whenever a second red appeared — correct, and a real standing defect.
Both of us proposed converting the deliberate red into an expected-fail so any red would be a real
one. Then I read it.

It was one parked case asserting per-ward sex mix and specialling capacity. Its note said sex mix is
rendered by nothing reachable, specialling appears only as an eligibility gate, **whether either
belongs on that board is the owner's question**, and the sex-mix half overlapped an unbuilt ruling
plus an unsettled question about which field is the honest source. The file had already gone from 13
cases to 5 deliberately, each retirement recorded, with a header saying it must not be made green by
deletion.

**So the red was the last thing in the repository preventing an unanswered clinical question from
being forgotten.** Converting it would have reported green over the question, and — per
[[it-fails-passes-on-any-error]] — kept reporting green after it was answered.

**How to apply:**

1. **Read the assertion and its comment before recommending anything about a red.** Its name and the
   summary line are not enough; both describe a defect even when the truth is a parked decision.
2. **Ask whose question it is.** If the answer is "the owner's" or "undecided", the red is
   load-bearing and silencing it is data loss, not tidying.
3. **Pin the LIST, do not silence the member.** A gate asserting the set of failing files equals a
   named expected list — each entry carrying its reason and owner — keeps the red visible, fails by
   name on any new red, _and_ fails when an entry stops failing, so an answered question prompts a
   retirement instead of being absorbed by a green. That last property is the one `it.fails` cannot
   give.
4. **A "just fix it" instinct is worse than the conversion here, and arrives second.** When the
   screen is correct and the open question is whether it should show something it does not, there is
   nothing to fix and an attempt will invent a decision.

⚠️ **A peer endorsing the recommendation is not evidence for it.** They endorsed mine on my say-so,
having also not read the test — two agreeing sessions, one unexamined premise. See
[[agreeing-checks-with-one-blind-spot]] and [[a-correction-that-agrees-with-you]].

Related: [[prove-the-task-is-still-outstanding]], [[compliance-without-coverage]],
[[a-guard-that-red-lights-the-fix]], [[hand-picked-test-subsets-ship-red]].

---

## A RED mutant that proves a milder fault than the one the guard is for

2026-09-06, Ward Flow. Two of us repaired the same guard — a canary on a comment-stripper — within
an hour, independently, and each reported it _"proved by mutation"_. Both mutants went red. **Both
verdicts were wider than the evidence.**

```
the guard exists for   a GREEDY pattern: eats first opener -> LAST closer, so it takes the MIDDLE
Verifier mutated       .slice(0, 200)         truncation — loses the END
I mutated              [\s\S]*? -> [\s\S]*    the real fault
```

Verifier caught their own: _"the repair holds; the evidence I cited for it did not."_ ⚠️ **Those are
two different claims and from outside they are indistinguishable — both look like a red mutant and a
green suite.** Only the person who ran it knows which fault the mutant actually was.

**Then the same error caught me, pointing the other way.** My landmarks caught greedy and would have
missed truncation entirely; theirs caught truncation and reached greedy through a single landmark.
**Each of us had proved exactly the fault our own mutation exercised and then generalised to "the
guard is sound".** The union of both sets is the guard; neither half was.

🔴 **And the landmark that reads like the real check was the weakest in both versions.** The `<h1>`
sits just past the last comment closer, so a genuinely greedy stripper leaves it standing — measured,
the mutant's output began `'"use client";\n\n}\n        <h1 class…'`. **A landmark only proves the
fault shape that can actually remove it**, and where it sits in the file decides that, not how
important it looks.

**How to apply:**

1. **Name the fault your mutant is, next to the verdict** — "proved against a greedy match", never
   "proved by mutation". The unqualified phrase is what let two of us over-claim in the same hour.
2. **Enumerate the fault SHAPES the guard is for, then check each is reachable.** Here there were two
   and each set covered one. Write the mapping into the source so the next person cannot re-derive
   only half of it.
3. **For a positional guard, map each anchor against the span the fault destroys.** Two of my four
   landmarks were inside the greedy span, two outside; only the inside ones could ever fire.
4. **Convergence is not corroboration.** Two independent repairs agreeing on a design says the design
   is natural, not that it is complete — we agreed and were both incomplete.

Related: [[a-guard-that-blocks-its-own-purpose]], [[a-claim-is-scoped-to-what-it-measured]],
[[caught-and-survived-are-not-equally-strong]], [[a-correction-that-agrees-with-you]].

---

# a-red-mutation-can-prove-nothing-too — sequential assertions inside one `it()`

> The mirror of everything above: a mutation that comes back RED while proving nothing about the site you think you measured

**Measured 2026-09-08, Ward Flow, running reword arms on converted guards.**

**The trap:** several assertions about DIFFERENT subjects sit inside one `it()`. Assertions run in
sequence and the first failure **stops the test** — every later assertion in that block **never
executes**. The file goes red. Nothing in the output says which assertions ran.

**So a batched mutation touching two subjects reads as proof of both, and is proof of one.**

    ward-console-controls   broke 2 subjects at once. L573 failed; L574 NEVER RAN.
                            I was one keystroke from recording L574 as "deletion arm proved".
    ward-governance         all 3 converted sites sit in ONE it(). First run measured ONE
                            while appearing to measure three.

**What caught it:** the failure message named one subject and not the other. **The colour was
identical to the colour of real proof.**

**The fix, and it is cheap:** one mutation per assertion. To isolate a later site, craft the mutant
so the EARLIER assertion still passes — e.g. keep the word the first guard reads, remove only what
the second reads. Then it fails on its own message.

⚠️ **The general rule this belongs to: READ WHICH MESSAGE CAME BACK, NEVER JUST THE COLOUR.** Every
entry above is a green that meant nothing; this is a red that meant nothing. Both are defeated by the
same habit, and neither is defeated by counting passes and failures.

⚠️ **Related, same day, different mechanism — a COMPOUND mutation produces an unattributable red.**
Changing two words in one sentence reddened an unconverted pin as well as the two converted guards I
was measuring. Narrow the mutation to touch only what the guard under test reads, or you cannot say
which guard the red belongs to.

---

# widening-a-guard-can-buy-nothing — the unconverted pin beside it

> A guard made tolerant next to a verbatim pin on the SAME sentence yields ZERO tolerance gain, and both are green until somebody actually rewords the copy

**Measured 2026-09-08, Ward Flow `ward-governance`.** Three brittle guards were widened and both arms
re-proved. **The file still went red on the identical reword** — two _unconverted_ assertions pinned
the same sentence verbatim. The screen was no more rewordable than before the work.

**Why nothing sees it:** the population count counts CONVERSIONS. The pins deliberately left standing
are not in it. So a programme can report progress per-guard while delivering none per-screen.

**The check:** after widening a guard, reword the real sentence and run the WHOLE FILE, not the
assertion. If the file still reddens, the tolerance gain is fictional and the claim must not be
written.

⚠️ **And one of those pins carried a comment overstating what it did** — it claimed a joined-text
assertion is what scoped the check to one element, when the element lookup already did that. **A
rationale can do work the code does not.** Read the code, not the reason beside it.

## 2026-09-09 — the mutation that ran, and was the wrong mutation

Grepped this file first; the mislabelled-arm case was absent. Found and self-reported by Ward Builder
Two after a re-proof came back GREEN where they had predicted RED — the only reason it surfaced.

**A two-arm method runs a REWORD (must stay green) and a BREAK (must go red). If the "break" is
actually a reword wearing a break's label, its green is correct and proves nothing** — and it is
filed as the break arm passing. The mutant ran. It compiled. It was simply not the mutation claimed.

⚠️ **This is the mirror of the usual trap.** The familiar failure is a mutant that never ran
returning green. This one runs perfectly and answers a different question — so every check aimed at
"did the mutant execute?" passes, and the finding is published "measured in both directions" at
double its real width.

🔴 **AND THE DEEPER RULE THE WHOLE EXERCISE CONVERGED ON, from three directions in one day:**

> **A guard is a QUERY plus a PREDICATE, and reword-and-break only ever exercises the PREDICATE.**

The query — _what the assertion reads_ — is untouched by both arms. Hence: a positive claim reading
the whole page is satisfied by a bystander; a ban reading one element cannot see the forbidden phrase
next to it; and a numeral guard reading a paragraph lets the page publish the very figure it refuses.
**All three pass both arms.** See [[a-guard-that-blocks-its-own-purpose]] for the ban inversion, and
[[checks-that-cannot-fail]].

**The tell that caught it:** a re-proof returning green where red was predicted. **Predict the colour
before running the arm** — an unpredicted green reads as success, and a contradicted one is the only
thing that makes a mislabelled mutation visible.

## 2026-09-11 — the fixture never reached the branch, and the mutation made it look DOUBLY proved

**Ask "can this test enter the branch at all?" BEFORE "does it assert the right thing?"** Two
measured in two days on Ward Flow, both would have shipped a green test proving nothing:

    a "No department matches <id>" fallback   0 of 50 seeded movements carry an unresolvable id
    the gender-decides-the-bed gate           0 of  8 seeded patients have gender != sex

The second is the nastier one: with no divergent patient in the seed, **gender-gating and sex-gating
return identical results on every seeded case**, so the wiring could be left reading `sex` and every
test still passes. Not a weak proof — a vacuous one, and it looks green.

🔴 **And a mutation proof does not rescue it.** A mutation tells you the test CAN fail; it does not
tell you the fixture ever reached the code you care about. **A test that never enters a branch can
still be reddened by mutating something else it does touch — and then it looks doubly proved**,
because a green-to-red mutation is normally the strongest evidence available. Here it corroborates
the wrong thing, and the stronger the evidence looks, the more confident the false report.

**Cheaper than a mutation and catches what a mutation cannot:** assert the fixture reaches the state
first, then assert the behaviour. Where the seed cannot produce the state, build it by hand and say
so. Related: [[the-suite-never-tests-the-absence]], [[compliance-without-coverage]],
[[a-property-whose-operands-can-coincide]].
