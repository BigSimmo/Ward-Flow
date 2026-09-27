---
name: compliance-without-coverage
description: "anti-vacuity floors on the numerator, an emptied population that passes everything, a denominator sharing its numerator's assumption, and a guard sampled on one of many"
metadata:
  type: feedback
---

**Consolidated 2026-09-06 from 9 separate memories on one subject**, written from different chairs across a night of six parallel sessions.

⚠️ **Nothing is summarised — each section below is its original entry verbatim.** The merge exists because the index
that points at these has a hard size limit: 9 index lines for one subject crowd out 8 unrelated
memories, which then do not load at all. The only thing given up is recalling one of these without the others.

---

# compliance-without-coverage

> Anti-vacuity guards prove a search found something, never that it found everything — three careful methods agreed on a list that was missing two surfaces

**Proving that what you found is correct is not proving you found it all.** A static search that
cannot detect its own incompleteness is the same class of defect as a check that cannot fail — see
[[checks-that-cannot-fail]].

**Why:** anti-vacuity guards _feel_ like coverage and are the opposite. "The derived set has ≥3
members", "at least one site was seen to pass" — these confirm the search is not empty, which is the
weakest possible statement about completeness. Every one of them can hold while the search is
missing half its subjects.

**Established 2026-09-02 on Ward Flow.** A list of UI surfaces that dispatch an overridable event was
computed three times, by three chats, from three different starting points, and agreed. It was wrong
twice over:

1. **A surface missed because it was PAUSED.** The guided tour is unrendered by owner decision but
   still wired, and dispatches through the live reducer. A paused surface is one whose defect is
   _scheduled_, not absent — and the person who un-pauses it will correctly conclude that un-pausing
   broke it, months after the change that did.
2. **A surface missed because THE SET HAD GROWN.** The list was derived from one refusal function's
   call sites; a change that evening made a fourth event overridable through a _different_ function.
   The gate's scope was defined by code elsewhere, so it enlarged without the gate's wording changing
   and nothing went red. Same disease as [[comments-that-recruit]], one level up.
3. **A shape all three shared:** every method searched for a literal `type: "EVENT"`. A computed type
   (`type: x ? "A" : "B"`) is invisible to all of them — and one such dispatch already existed.

**How to apply:**

1. **Assert coverage, not just compliance.** Count the whole population, count what your search can
   read, and pin the difference to a named allowlist. Then "my search might be incomplete" becomes
   "my search knows when it is incomplete."
2. **Every allowlist entry states WHY it is safe**, not merely that it is — an unexplained entry is
   the next reader's mystery and the one after that deletes it.
3. **Derive the set from the code, never from a hand-copied list.** A list that cannot grow is the
   bug; a set parsed from the type declarations grows the moment someone adds a member.
4. **Write an unchecked gap down AS a gap.** "Nobody has checked this" got checked within the hour and
   something was found. A conclusion that quietly absorbs its own blind spot reads as stronger and is
   unfalsifiable — see [[observations-expire]] and [[agreeing-checks-with-one-blind-spot]].
5. **Audit yourself with a principle immediately after articulating it.** A new rule is most dangerous
   to its own author, who feels like the one person it cannot apply to. Having named this, my own
   sweep turned out to be scoped to one directory — the identical defect, in my scope choice.

## ⚠️ A DERIVED LIST CAN NARROW AS EASILY AS IT CAN BROADEN, AND NARROWING IS SILENT. 2026-09-04.

Ward Flow. A guard checked four hand-listed CSS modules for undeclared `--ward-*` tokens. Three more
screens were moved onto the shared layer and inherited the whole silent-failure class with no guard,
because **the list was a name list rather than a property**.

So I replaced it with a derivation: every file matching `composes: wardTokens`. **It silently DROPPED
`ward-shared.module.css`**, which composes nothing and declares nothing — it INHERITS its tokens from
whichever root renders it. **A change intended to broaden the guard would have narrowed it, and
passed.**

> **"Derive from disk, never hand-list" is necessary and NOT sufficient. A derived set needs a floor
> asserting the known members are still IN it.**

⚠️ **Broadening announces itself** — new members appear and somebody investigates the new failures.
**Narrowing produces a smaller green, which looks exactly like success.** The only reason this was
caught is that the floor asserted the four originals were still present, and it fired on the first
run.

**How to apply: every derived set gets two floors — a count floor (the matcher still matches
anything) AND a membership floor naming what it replaced.** The second is the one that catches a
property subtly narrower than the list it supersedes. The fix here was the union of both.

Related: [[a-guard-over-something-erased]], [[hand-picked-test-subsets-ship-red]],
[[agreeing-checks-with-one-blind-spot]], [[checks-that-cannot-fail]].

## The sharpening, 2026-09-04: a conveniently-shaped control is how the gap survives

A colleague's detector reported "rendered nowhere" for every symbol, including ones they had read
with their own eyes minutes before. **Its control PASSED.** The matcher only recognised an element
written on ONE line; the control symbol happened to be written that way, and the symbol it missed
was written across several.

**A control proves the method can find SOMETHING. It never proves the method finds EVERYTHING — and
picking a control of the convenient shape is precisely how the blind spot survives the check.**

**The remedy is concrete: two controls of deliberately DIFFERENT shapes**, chosen so that each
exercises a different hard case (single-line vs multi-line, present vs absent, nested vs flat). Only
a method passing both is worth its silence.

⚠️ **My own version of this the same night, and I got lucky rather than careful.** My tight matcher
for portal usage returned "name collisions excluded: 0" — a false-negative-shaped output I had not
controlled for. It was right, but only because a LOOSER earlier version had surfaced a collision I
then read by hand. **Had I written the tight one first, I would have had a clean answer and never
seen the case.** The sloppy instrument was the control, by accident.

**And the cheap mitigation that converts silence into noise:** every mutation or edit script gets an
exact-count precondition (`assert s.count(old) == 1`) before it writes. A pattern that silently
mangled then throws, instead of matching nothing and reporting success. For a detector, the same
role is played by a floor over the population it actually walked.

> **THE REAL MANGLING CASE - AND THIS PARAGRAPH WAS MANGLED WHILE BEING WRITTEN.** The sentence
> explaining escape-eating had its own escape eaten, and the follow-up edit could not match the line
> because the byte on disk was INVISIBLE when read back.

**TWO SEPARATE HAZARDS THAT COMPOUND, measured on this machine by writing a file and reading the
bytes back - not inferred:**

    written  \s      on disk  \s     SURVIVES        a single backslash is safe
    written  \\s     on disk  \s     COLLAPSED       a RUN is halved
    written  \\\\s   on disk  \\s    HALVED
    written  \b      on disk  \b     SURVIVES

1. **The shell halves runs of backslashes** in a quoted heredoc. Single ones survive.
2. **Python then reads a surviving `\b` in a NON-RAW string as a 0x08 BACKSPACE.** This is
   independent of the shell and fires even when nothing was collapsed.

My case was both in sequence: `\\b` collapsed to `\b`, which Python turned into 0x08.

⚠️ **The actionable line, and it is about STRINGS not shells: a regex LITERAL is safe; a regex built
from a STRING is not.** `new RegExp("\\s")` needs two backslashes on disk, so it needs four written -
put two and you get `"\s"`, which JavaScript reads as a plain `s`. **The matcher compiles, runs, and
matches nothing.** That is an inert detector reporting a clean sweep.

**How to apply: write scripts with a file-writing tool, never a shell heredoc.** Where a heredoc is
unavoidable, prefer the form leaving a file on disk (cat > f) over the one piping to stdin
(python -): only the first can be inspected afterwards to confirm the escapes arrived. Prefer regex
literals and raw strings over strings-that-become-regexes. And verify with an instrument carrying no
escape of its own - build the character with chr(92) or chr(8) - or it can suffer the very defect it
is testing for.

## The floor must be PER MEMBER, not over the population. 2026-09-06, Ward Flow.

A number-agreement guard rendered five statistics measures and asserted, as its anti-vacuity check,
that **at least one of them** printed a count of one. It passed. Two mutations that forced two of
those five sentences permanently plural ALSO passed — the mutants ran and changed no result.

The fixture had timed its admissions against a clock of its own while the screen read `now` from the
provider, so those admissions landed in the FUTURE and every clock-comparing derivation skipped
them. Two of the five measures rendered "0.5 days" and "None." and were never exercised at all.

> **"Some member of the population was covered" is not a floor. It is the weakest sentence that can
> be written about coverage, and it passes at any coverage above zero.**

The fix was one case per member, each tuned so THAT member takes the breaking value, each failing by
name when its own value stops appearing. It also forced an admission I had been avoiding: a single
combined fixture could never have done this, because two of the measures make contradictory demands
on the same ward. The combined fixture was claiming a coverage that was arithmetically impossible.

**How to apply: when a guard walks N subjects, the anti-vacuity assertion must be N assertions.** If
that is impossible because the subjects conflict, that is the finding — say so, and split the render.

## When testing ONE member is legitimate, and how to say so — 2026-09-06

I proved a scanner's file coverage by planting a fault in all 51 files. Then I needed to test five
more _syntactic forms_, and testing each across 51 files again would have been 250 runs.

**One file was enough, and the licence came from an earlier result rather than from convenience.**
The blind form had failed in **0 of 51** files — _uniform_, not 7 of 51. **That makes shape-blindness
a property of the PARSER, not of any file**, and a parser property is fully exercised by one file.
Coverage — a file property — had been established separately over all 51.

⚠️ **Had the blind shape failed in 7 of 51, the same shortcut would have been invalid**, because the
result would have shown that files differ. **The uniformity IS the licence, and it has to be
measured before it can be leaned on.**

**How to apply: before testing one member and generalising, name the DIMENSION you are generalising
over and point at evidence that it does not vary.** Then write both halves into the report — I said
_"one file is legitimate for a shape question BECAUSE the whitespace result was 0 of 51, not 7 of
51"_ — because "I tested one file" on its own reads as the weaker claim it would otherwise be, and a
reader cannot reconstruct the licence.

⚠️ **The reverse is the commoner error and it has its own entry:** a sweep that covers one file and
is reported as covering the class. The difference is not the sample size; it is whether anything was
measured about variation. Related: [[a-written-diagnosis-does-not-sweep]],
[[caveat-only-in-the-report]], [[a-measurement-is-scoped-to-what-it-measured]].

---

# floor-the-denominator-never-the-numerator

> an anti-vacuity floor over a shrinking backlog fails exactly when the work succeeds; floor the population walked, not the violations found

**An anti-vacuity floor placed on a shrinking population is a guard with an expiry date.**

2026-09-04: I wrote `expect(coveringScreens().length).toBeGreaterThan(10)` to stop an empty result
reading as a fixed backlog. The backlog was 14. A builder's four adoptions took it to exactly 10 —
and 10 is not greater than 10, **so the guard went red because the work succeeded.**

⚠️ **Bumping the number only moves the date it fails again**, and it hits zero-tolerance precisely
when the backlog empties — the one moment it should be celebrating. A guard whose maintenance is a
countdown is not a guard; it is a reminder with an expiry.

**The fix is to floor the thing that does not shrink.** The violation count is being driven to zero
by design; the _population searched_ only grows. So:

- `expect(filesWalked.length).toBeGreaterThan(30)` — the denominator. Never
  `expect(violations.length).toBeGreaterThan(N)`.
- And separately, **prove the matcher works by feeding it synthetic input**: assert it detects each
  known-bad shape and does NOT flag each known-good one. That reads identically at 14, at 10 and at 0.

⚠️ **Both halves are needed.** A synthetic-input test proves the matcher works but not that it ran
over the real tree — if the walk returns empty (a moved directory, a changed glob, a bad root), the
synthetic assertions still pass, the violation list is empty, and a two-sided pin then reports every
remaining row as "freed", which reads as _the backlog is done_.

⚠️ **AND THE FLOOR'S POPULATION MUST BE THE BRANCH'S POPULATION** (added 2026-09-04, a second and
different way to floor the wrong set). A guard floored at 3 movements "closed, with a recorded
blocker"; walking the function it guarded, exactly **1** could reach the sentence under test, the
other 2 returning early on an unrelated branch. The floor was over the members matching the
_filter_, not the members reaching the _branch_ — so it would keep reading 3 while the property
went untestable. Count what executes, and state the number in the message.

**How to apply:** whenever writing a floor, ask which direction the number is meant to travel. If the
work is supposed to drive it down, that number cannot also be the proof the check ran. Related:
[[checks-that-cannot-fail]], [[self-invalidating-pins]], [[compliance-without-coverage]],
[[a-green-mutation-that-changed-nothing]], [[a-guard-that-pins-the-old-wording]].

⚠️ **AND A CORRECT PER-MEMBER FLOOR DOES NOT FLOOR THE MEMBERSHIP.** 2026-09-04. I wrote a print
guard with a properly discriminating floor — each named file must have at least one rule the
assertions actually read — and hardcoded the eight files it walked. Ward Lead ran it on their tree,
saw **12 failed, 8 passed** with none of their own seven named, and was one sentence from writing
"my seven are clean". **Their files were not in the list.**

**The floor guarded each named file having something to check. Nothing guarded the LIST being the
population.** Both halves are needed and they are different assertions.

**Absence from a guard's output is not evidence when the guard does not walk the file** — and the
only thing that stopped a wrong conclusion was a passing test that happened to name the guard's own
scope out loud. That is luck, not design.

**The repair is a two-sided pin, because a bare exclusion list is an amnesty that never expires:**

    discover the population from DISK, never a literal list
    floor the DISCOVERED count
    unexpectedlyBroken  = hazard not in KNOWN_UNFIXED    -> must be []
    fixedButStillListed = KNOWN_UNFIXED entry now clean  -> must be []   <- forces the list to shrink
    every excluded path must still EXIST                 -> no amnesty for a renamed file

**How to apply:** when you write a guard, ask what would happen if someone ran it expecting their
file to be covered. If the answer is "it passes silently", the scope is a defect. And a scanner
built to stop enumeration rotting must not enumerate its own population.

---

# a-floor-whose-failure-is-a-bare-zero

> An anti-vacuity floor reporting "expected 0 to be greater than 0" is as silent as no floor when the population is what broke

**An anti-vacuity floor whose failing value is a bare zero is exactly as silent as no floor at
all when the population is what broke. The floor has to say what it WALKED, not only what it
FOUND.** — Ward Builder Four, 2026-09-06, correcting credit I had given it.

Its guard asserted `nonZeroCells.length` was `> 0`. The red read **`expected 0 to be greater
than 0`** — nothing derived from the seed, word for word what an emptied fixture produces. The
seed-derived equality below it never spoke, because the floor fires first and short-circuits.

**The repair is two assertions, deliberately not merged:**

    "0 of 23 wards report a non-zero sex mix"   -> a statement about the CODE
    walked.length > 10                          -> a statement about the FIXTURE

`0 of 0` would be the second problem wearing the first one's clothes, and the pattern that
catches the code defect passes silently on a destroyed board.

**Why:** I had told them the control cleared itself under
[[restore-proof-sits-downstream-of-the-damage]]'s test — a red quoting pre-existing content.
**I reasoned about what the red would say. They ran it.** Asserting a property of a failure
message without reading the failure message is the same error I had been naming in others all
night.

**How to apply:**

- Write floors so the failure message **names the denominator**: `"0 of 23 …"`, not `> 0`.
- Never let one assertion carry both "the code is wrong" and "the input is missing" — see
  [[a-property-whose-operands-can-coincide]].
- ⚠️ **A correction that runs against the sender's own interest is the one to check and then
  believe.** Compare [[a-correction-that-agrees-with-you]] — the flattering one is the least
  audited; this is its mirror and it was right.

Companion: [[floor-the-denominator-never-the-numerator]] (what the floor is _over_); this one is
about what the floor _says when it fails_.

---

# an-emptied-population-passes-every-check

> `[].every(...)` is true, so deleting the code a guard watched turns it into a permanent pass — and the natural repair, setting the expected count to 0, cements it

2026-09-06, Ward Flow. A guard read every `<th>` in one file, required exactly 16, and asserted all
carried `scope="col"`. I deleted the views that held those tables (they were unreachable). The file
now has **zero** `<th>`.

The count assertion goes red, and **the obvious repair is to change 16 to 0** — at which point
`[].every(...)` is `true` and the accessibility check underneath **can never fail again**. Nothing
would ever say so: it is green, it is specific, it names a real property.

**A guard reduced to an empty population reads exactly like a guard that is satisfied.**

## How to apply

- **When you delete code, grep for guards that scanned it** and ask what their population becomes.
  A count going red is the loud half; the predicate silently ranging over nothing is the dangerous
  half, and they arrive in the same failure.
- **Re-point the property at whatever took the work over**, and widen while you are there. Mine went
  from one file / 16 headers to every ward component / 91 headers, floored on the population walked.
- **Never re-pin a bare count you did not derive.** That one had been revised 12 → 15 → 16 by people
  counting columns rather than checking headers — three chances to notice, none taken.
- Prove it with a mutation **on the live replacement**, not on the thing you deleted.

## 🔴 The anti-vacuity floor did not help, because it floored on the wrong population

The same day, a reachability guard reported an EMPTY list of orphaned modes and was believed. Its
pattern was `/WardModeWorkspace\s+mode="…"/` — the JSX attribute form only. Two test files render
the same component as **`createElement(WardModeWorkspace, { mode: "queue" })`**, and the scan could
not see them.

⚠️ **It HAD an anti-vacuity check.** It floored on the scan finding renders _somewhere_ — and it was
finding plenty, all of them JSX. **A floor on total matches cannot protect against a pattern that
only knows one spelling of the thing.**

**And an empty result is the least-audited output there is, because there is nothing to look at.** A
list of five offenders gets read; `[]` gets believed. Related:
[[an-alias-defeats-a-name-matching-detector]], [[floor-the-denominator-never-the-numerator]],
[[compliance-without-coverage]], [[a-property-that-does-not-discriminate]],
[[git-doubled-star-requires-a-subdirectory]], [[the-suite-never-tests-the-absence]].

## The one that made the dead code compulsory

Five unreachable branches looked like neglect. They were **mandatory**: the component's prop type
was `Exclude<WardMode, "command">` — seven modes — while it rendered two, and the exhaustiveness
`never` tail therefore REQUIRED a branch for each. **Narrowing the type is what made deletion
possible.** When dead code will not go, check whether a type is ordering it to stay.

---

# an-emptied-allowlist-changes-the-claim

> Removing the last entry from a known-exceptions list silently widens what the assertion claims, at the moment it looks most finished

A guard held "only one file may declare this rule set" plus a `KNOWN_UNMIGRATED` list of files still
to be converted. Entries came off as each was migrated. **The last one came off, and the list was
empty.**

**With entries the assertion read "these files still need migrating". Emptied, it reads "the estate
is clean" — and the estate was not clean.** The detector matched a literal class name, so three
modules using different names for the same rule had never been in scope at all. **The moment the
list emptied was the moment the assertion became most misleading**, because that is when it started
making a claim far larger than its detector could support.

**How to apply.** When you remove the last entry from an exceptions list, re-read the assertion as a
stranger would and ask whether it now claims something nobody proved. Prefer a detector whose scope
is the property (any `*[Tt]able*` selector) over one whose scope is a name. **And an empty list means
either "we finished" or "we stopped looking" — the two are indistinguishable from outside**, so say
which in the file.

⚠️ **The repair produced its own instance.** I predicted widening would flag one file; it flagged
three, because I had measured for the canonical padding AND border _values_ while the guard's filter
is the looser "declares padding or a border at all" — a stricter property than the one the assertion
tests. See [[measure-the-thing-not-a-proxy]] and [[establish-the-unit-before-counting]].

Related: [[compliance-without-coverage]], [[a-property-that-does-not-discriminate]],
[[floor-the-denominator-never-the-numerator]], [[a-fix-can-obsolete-its-own-guards-question]].

---

# a-guard-sampled-on-one-of-many

> a guard that checks 1 of N because all N were identical keeps passing when they stop being identical — coverage silently drops to 1, and its own comment stops the next reader looking

**A guard may sample one instance on the recorded grounds that all instances are identical. The day
they stop being identical, its coverage drops from N to 1 and it stays green.**

2026-09-05, Ward Flow. A browser test pinned the discharges board's six columns on
`scrollers.first()`, with this note beside it:

> _"Pinned on the first table rather than all four: every group renders the same `<thead>` from one
> component, so one is the header contract and four would be the same assertion written four times."_

True when written. Then a ruling dropped one column from three of the four groups. **The first
scroller is the group that kept all six**, so the assertion went on passing — still measuring one
table, while the three it explicitly claimed to cover stopped being pinned at all.

⚠️ **The comment is the trap, not the shortcut.** The shortcut was correct and well reasoned. What
makes it dangerous is that a reader who opens the file finds an argument for why one stands for
four, and does not re-derive whether the premise still holds. **A recorded justification is read as
a current fact.**

**How to apply:**

- When you change something that makes N instances stop agreeing, **grep for guards that sample
  one of them** — the giveaway is a comment saying "pinned on the first / one is enough / they are
  all the same".
- Fixing it means **replacing the reasoning, not deleting it**. A bare list of four assertions
  invites the next person to re-derive the same shortcut. Say why one no longer stands for four.
- Distinct from [[a-fix-can-obsolete-its-own-guards-question]]: there the guard's QUESTION became
  wrong. Here the question stays right and the POPULATION silently shrinks. Green means the same
  thing in both — _"the question I asked has a consistent answer"_, never _"the property holds"_.
- When mutating to prove such a guard, **check WHICH assertion goes red.** Restoring the dropped
  column could plausibly have tripped the geometric overflow check sitting beside the header check;
  that would have proved nothing about the header contract. See [[which-assertion-went-red]].

---

# a-denominator-that-shares-an-assumption

> A reconciliation arm built to remove a tautology contained the same tautology — both sides required the same terminator

**"A denominator that shares an assumption with the numerator is not a denominator."**
— Ward Builder Three, reviewing Ward Verifier, 2026-09-06.

A guard matched `composes: x from "path";`. Its anti-vacuity floor had been a bare count, so it
was replaced with a **reconciliation**: a deliberately crude denominator scan of every
declaration, compared against what the matcher parsed. Equal sets = nothing escaping.

**Both regexes required the trailing `;`.** CSS lets the last declaration in a block omit it —
so on that declaration **the denominator and the matcher were blind together, and reported
agreement.** The arm built to remove a tautology contained the same tautology one layer up.

A second hole in the same fix: the sets were keyed `file:line`, and a `Set` **discards
multiplicity** — an unreadable declaration sharing a line with a readable one was forgiven.

**How to apply:**

- When building a reconciliation, **list the assumptions each side makes and check no assumption
  appears on both.** Terminators, quoting, line structure, case, encoding.
- Prefer a denominator whose parsing is _deliberately cruder_ than the numerator's — it must be
  able to see things the matcher cannot, or it cannot bound it.
- Multiset, not set, whenever two findings can share a key.

⚠️ **And the control that nearly hid it:** reverting the multiset fix gave `1 failed`, which
reads as _the guard held_. **It did not** — the red came from an unrelated sanity floor pinning
three named files, an incidental catcher covering 3 of 51. _"Counting reds would have said the
finding was unnecessary; naming which assertion went red said it was necessary."_ See
[[which-assertion-went-red]].

Same family as [[a-property-whose-operands-can-coincide]] and
[[a-control-must-test-the-premise-not-the-measurement]]. Third and fourth instance of
[[a-clean-result-held-up-by-another-gate]] — Prettier adds the missing semicolon and splits
declarations onto their own lines, which is why neither hole had a live instance.

---

# an-empty-search-is-a-claim-about-the-detector

> A precise grep against compiled source returns empty for the pattern's reasons, not the subject's — and I only escaped it because a looser pattern happened to be in the same command

Ward Flow, 2026-09-05. Checking whether `getByRole` reads an `exact` option, I searched the
installed `@testing-library/dom` for the name comparison with

    grep -nE "matches\(|fuzzyMatches\(|matchers\."      -> NOTHING

The compiled call reads `(0, _allUtils.matches)(`, so `matches\(` cannot match it. **I did not
notice.** The same command also carried a looser `grep -n "matches\|computeAccessibleName"`, which
returned lines 162 / 173 / 181, and I read that one and reported the finding as confirmed. **I did
not design a control — I had two patterns of different tightness and read the one that produced
output.** Ward Builder One hit the identical wall on the identical claim and caught it only because
they had decided a corroborating claim was the one to check hardest.

**Why:** the mechanism ran FOUR times in one night at four levels — a typecheck filtered through
`grep -i statistics`, my own equivalent, and then both of us filtering the _evidence for the finding
about filtering_. **A detector's silence kept obscuring the case against trusting a detector's
silence.** See [[scope-a-gate-by-what-you-run]] for the gate-level half.

**How to apply: when a search returns empty, widen the pattern once before believing the absence.**
An empty result is a claim about the detector at least as much as about the subject. On compiled,
bundled or minified sources a precise pattern is the wrong tool by default — property access becomes
`(0, _mod.name)(`, names get mangled, and whitespace is not where you left it. Start loose, confirm
the hit, then tighten.

⚠️ **The same session, the same relay: I truncated a commit quote and turned "Removed;" into
"Removed."** — a full stop where a semicolon was, which is what makes a truncation read as a
complete sentence instead of a fragment. **The untruncated text was in my own grep output on
screen.** Not a relay error; I had it and trimmed it. Related:
[[a-distribution-error-inflates-a-quote]], [[relayed-numbers-lose-attribution]],
[[msys-leading-slash-false-absence]], [[compliance-without-coverage]].

---

# scope-a-gate-by-what-you-run

> Piping a full gate through a grep for your own area turns every else's failure into empty output, and empty output reads as clean

Ward Flow, 2026-09-05. Ward Builder One scoped every `tsc` run this session with `| grep -i
statistics`, to keep the output to their own work. Empty output, read as clean. Their tree had
**four** type errors, none of which they had seen — including two of mine.

**Why it is worse than the ordinary narrowed-check case: vitest runs no tsc at all.** The filter was
not hiding a signal the normal loop would surface later. It was the only place that signal was ever
going to appear. The suite figure and the typecheck figure fail in different directions, and the
natural way to scope tsc to your own work is the way to stop seeing everyone else's.

**The counterpart evidence was mine.** My unfiltered runs went 3 errors → 1 → 0 across the session.
**That sequence is only legible because nothing was filtered** — a scoped run shows zero at every
step. Two of the three were mine, from a commit I had already reported as done, and a filter on
"caption" would have hidden precisely those two from me.

⚠️ **THE POSITIVE CONTROL, AND IT IS THE WHOLE ARGUMENT IN ONE LINE OF CODE.** The defect was
`exact: true` passed to `getByRole`. Read in the installed `@testing-library/dom`: `queryAllByRole`
never destructures `exact` — the word does not appear in `role.js` — and the accessible name is
always compared with the exact `matches()`, never `fuzzyMatches`. **So the option asked for
behaviour the query already performs unconditionally: no runtime difference, no assertion that could
ever move.** A line whose stated intent and actual effect had come apart with only one possible
witness.

**And both arms of the experiment had already been run on that same line.** Builder Three's
unfiltered typecheck caught it, and their commit labelled the fix _"Unrelated"_ so it could not hide
inside a feature. Builder One's `grep`-scoped run on the identical error read empty and reported
clean. Same line, same file, opposite outcomes, hours apart. The gate was never the problem.

**How to apply: scope a gate by what you RUN, never by what you READ.**

    tsc -p <a narrower tsconfig>     a scoped check — its silence means something
    tsc | grep mine                  the full check with the answer thrown away

Same family as [[a-bypass-that-runs-a-narrower-check]] and [[gate-wrappers-mask-exit-codes]], and it
is the reason [[the-suite-never-tests-the-absence]] keeps costing this repo: nothing in the loop a
builder actually runs typechecks anything.

⚠️ **The related resolution habit, from the same exchange:** their four and my zero were both
correct, on different trees. Before treating two gate figures as contradictory, compare the BLOBS of
the file each was run against. Theirs differed from master by exactly one line — the error's own line
— and master had already fixed it. Related: [[differs-is-not-owns]],
[[a-measurement-is-scoped-to-what-it-measured]].

---

# a-skip-is-invisible-to-every-guard

> Two instances in one night: a retirement scoped to a FILE switched off the cover for subjects the ruling never mentioned, and no check anywhere can see it

**No guard in this repository reads a `.skip`.** So a skipped suite is indistinguishable from a
passing one in every summary line, every gate and every reachability check — _"skipped" reads as
"fine" the same way "completed" reads as "finished"_.

**Instance 1, `StatFootnote`.** A component was declared unreachable and its suite skipped — a
correct, documented pair. When a later screen imported it, the reachability guard reddened, the
`DECLARED_UNREACHABLE` entry was deleted, and the guard went green. **The suite stayed skipped.** A
live component rendered by a live route, with every test switched off, behind a green guard.
⚠️ **The entry and the skip are two halves of one arrangement and only one half has an alarm.**
Deleting the entry _answers_ the alarm; restoring the cover is what the alarm was _for_.

**Instance 2, and it is the general form.** `ward-device-claim-reason.dom.test.tsx` rendered two
boards: a retired one and `ReferralBoard`, which is live. The whole FILE carried `describe.skip`, so
retiring one board also switched off the live board's _"not a medical device"_ assertions. The file
header said _"no route reaches the screen this file renders"_ — **singular, and true about the
retired subject the entire time**, which is exactly why nobody questioned it.

**The rule: scope a retirement to the cases about the retired thing, never to the file that happens
to contain them.** And when a guard reddens because a subject came back, ask what the guard was
_for_ before answering it.

**Cheap sweep that finds both:** list every `describe.skip` / `it.skip` in the suite, map each to
the module it covers, and check that module against the declared-unreachable list. Anything skipped
whose subject is _not_ declared unreachable is uncovered live code. On Ward Flow this found 13
skips, 11 legitimate, 2 defects.

Related: [[checks-that-cannot-fail]], [[the-suite-never-tests-the-absence]],
[[a-working-safeguard-leaves-no-trace]], [[broken-and-never-worked-look-identical]].

## A constant threshold against a population that moves (2026-09-10)

Two guards, same shape, opposite directions, found the same afternoon in Ward Flow.

**The floor.** A provenance guard floored itself at `blocks >= 3` and the tree held exactly 3
blocks. Mutating one block so the walk stopped seeing it took the count to 2 and reddened — which
**looks like the floor catching a blind spot and is not.** It fired because a count crossed a
constant. Add a fourth block and the identical loss takes 4 → 3 and passes in silence. **A constant
floor catches only the LAST unit that stops being measured.**

**The ceiling.** Two DOM tests rendered every community team page one at a time against Vitest's
flat 30 s default. The page list is derived from a source document and grows when a team is added.
The cost side grew, the limit side did not, and the gap closed silently for three days until runs
started landing on the wrong side of it. Diagnosed correctly as _"not randomly flaky — it runs close
enough to the limit that machine load decides the verdict"_, which is the sentence that separates
this from a flake. **A flake is re-run until green; this is red for as long as it stays that slow.**

**The rule.** A constant compared against a moving population decides its verdict by arithmetic
rather than by the thing it is supposed to be watching — in whichever direction the population
moves. **Derive the threshold from the population** (`pages × budget`, `found × ratio`), never raise
it to a new constant, which resets the identical trap one unit further out.

**And a fix that buys margin gives something up: say what.** `pages × 3 s` no longer polices
per-page performance — it catches a runaway, not a drift. Record the measured per-unit figure beside
it so the drift stays legible.

⚠️ **A timed-out duration is not a measurement of the work.** Dividing 34 s (a run that never
finished) by a page count taken from a different reading produced a per-page figure with neither
half measuring the same thing. See [[establish-the-unit-before-counting]].

Related: [[a-green-mutation-only-counts-if-the-mutant-ran]], [[checks-that-cannot-fail]],
[[local-test-failures-windows]].

---

# 2026-09-12: a ratchet on a NET COUNT, whose slack grows as the programme succeeds

`scripts/ward-flow/check-text-size-floor.mjs` implements owner ruling D-3: **no NEW sub-12px text**,
existing uses grandfathered because a sweep would relayout every ward screen at once. It compares a
**total occurrence count** against a pinned baseline (`393`).

🔴 **Nine new sub-12px declarations were added in one night and it reported "Not risen."** Earlier
rebuilds had removed enough that nine new ones still landed under the baseline. **The rule is
per-declaration; the instrument is net-aggregate. A pass means only "the total did not rise".**

⚠️ **And the slack GROWS every time a screen is correctly rebuilt — so the guard weakens precisely
as the programme it protects succeeds.** ⚠️ **A second slack source I claimed and then RETRACTED — the retraction is the lesson.** I said
`fileCount` fell 39 → 37 so files had left the population, donating their counts as headroom.
🔴 **`fileCount` is not the population: the script filters `count > 0`, so it counts files STILL
CARRYING a token. Tracked ward stylesheets went 62 → 66 over the same period — the population GREW,
and 39 → 37 was two screens correctly rebuilt to zero.** **I reported a number's meaning without
checking what the number counts.** 🔴 **And the instruction I gave on it was harmful: an equality
check on `fileCount` reddens every time a screen is correctly cleaned — a guard firing on the work
it exists to encourage.** ✅ **The real hazard (a file RENAMED or moved out of the swept directory)
is invisible to `fileCount` either way, because cleaned and departed both just stop appearing; only
a per-file pin, which NAMES files, can tell them apart.**

✅ **The fix was one line, not a redesign: the script already computes `perFile` at :104 and
discards it, comparing only the reduce. Pin the per-file breakdown into the baseline and the same
script enforces the actual rule.** **Before proposing a new instrument, check whether the existing
one already computes the right thing and reports a weaker one.**

✅ **How the nine were corroborated without seeing the tree they were in:** running the same script
in a second worktree gave `383`; the other gave `392`. **The instrument counts git-tracked files but
reads them from DISK, so uncommitted edits appear in one run and not the other. 392 − 383 = 9 — the
breaches are visible in the DIFFERENCE between two runs and invisible to the verdict of either.**

⚠️ **The script's own footer was a specification, not a caveat**: it also cannot see a raw
`font-size: 10px` written without the token, or anything outside its swept directory. **Wiring it as
it stands buys less than it looks like.** And it was wired to nothing at all — see
[[a-working-safeguard-leaves-no-trace]] and [[ward-journeys-run-in-neither-loop]].
