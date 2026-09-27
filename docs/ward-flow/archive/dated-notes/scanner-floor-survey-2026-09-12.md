# Which ward guards can say "I did not look here"

**Surveyed 2026-09-12 in `D:/Worktrees/Database/ward-builder-two`. 63 files read, not grepped.**

🔴 **The question: a guard that finds NOTHING TO LOOK AT and a guard that finds everything correct
produce the same output — green.** This survey asks, of every ward guard that walks a population from
disk: **if the walk returned zero, would it fail?**

## The population of this survey, and its boundary

✅ **63 ward test files that walk a population by `readdirSync` / `globSync` / a recursive `walk()`.**

⚠️ **STATED BECAUSE THE METHOD IS THE BOUNDARY NOBODY WRITES DOWN, and it caught two chats four times
in one night.** This survey does **NOT** cover:

| not covered                           | how many | why it matters                             |
| ------------------------------------- | -------- | ------------------------------------------ |
| `git ls-files` walkers in `tests/`    | 14       | a different enumeration method entirely    |
| `git ls-files` walkers in `scripts/`  | 20       | **the D-3 text-size gate is one of these** |
| `readdir`-style walkers in `scripts/` | 53       | outside `tests/`                           |
| non-ward walkers in `tests/`          | 61       | outside this lane                          |

🔴 **So the class is at least 177 and this survey covers 63 of it.** ⚠️ **Two chats corrected the
boundary of this figure four times, every correction a DIRECTORY, none of them the METHOD — and both
independently measured 53 with the same shaped pattern, which felt like corroboration and was the
same blind instrument reporting twice.**

⚠️ **AND IT MEASURES EMPTYING ONLY.** A population can also silently **FILL**: a comment placed inside
an array literal turned each of its code spans into a phantom entry on another lane the same night.
**That class is not covered here, and it is arguably worse — an emptied guard stops catching, a
filled one starts asserting about things that are not there, and the phantom entries look like real
findings that cost somebody time to disprove.**

---

## 🔴 1. The defect in this survey's own instrument, stated first

**Two competent readings of the same five files returned DIFFERENT headline verdicts.** One called
`ward-sidebar-phone-contract.test.ts` a blind spot; the other called it protected. **Both were right.**

⚠️ **My brief never said whether the unit of analysis was the ASSERTION or the FILE**, and the answer
differs by unit:

- **Per assertion:** `expect(offenders).toEqual([])` over an empty population passes. Blind.
- **Per file:** a sibling `it()` floors the population, so the file goes red anyway. Protected.

🔴 **Both readings matter and they answer different questions.** CI runs whole files, so the
file-level answer is what the sweep sees. **But a reader inspecting one test believes something
false, and anybody deleting the "redundant" floor test blinds every sibling at once.**

✅ **Every verdict below therefore says which lens it uses.** The survey found this only because a
re-dispatch accidentally produced a second reading of the same files — **it was luck, not method.**

---

## 2. What the 63 actually look like

**The headline is NOT "the guards are blind".** Most have a floor. **The remedy is not "add floors" —
it is largely already done, and would have been the wrong recommendation.**

| shape                                                      | roughly                      | what it catches                  |
| ---------------------------------------------------------- | ---------------------------- | -------------------------------- |
| floor present, **in the same `it()`** as the assertion     | a minority                   | collapse, and the reader sees it |
| floor present, **in a sibling `it()`**                     | **the most common shape**    | collapse at file level only      |
| **no floor on the population an assertion actually walks** | a small number, listed below | nothing                          |
| **a floor that cannot fail**                               | 2 found                      | nothing — see §4                 |

🔴 **AND THE FLOORS THAT EXIST CATCH COLLAPSE, NOT ATTRITION.** A guard requiring "at least 5
`<WardTable>` call sites" is satisfied by the other four when one silently drops out. **That is the
shape that actually happens**, and nearly every "how would this go blind" answer was the same: the
pattern stops matching one file while the count stays healthy.

**Concrete, from the files:** rename a CSS class so it no longer contains `table`; add a prop before
the one a regex expects; write `.table :is(th, td)` instead of `.table th, .table td`; import through
a barrel; use `import * as x`; move a declaration two directories deeper than a one-level walk.

---

## 🔴 3. Ranked by consequence, not by effort

### P1 — a blind guard over something a coordinator acts on

1. **`ward-token-layer.test.ts` — the WALK has no floor, though the MATCHER is controlled.**
   ⚠️ **DEMOTED AND RE-WORDED AFTER REVIEW; the first version said "no floor anywhere in the file",
   which is wrong.** Three tests walk the whole ward stylesheet directory with no floor on the walk —
   the leading-token consistency check, the `--ward-space-*` ladder, and the retired `--ward-z-phone`
   name — so **all three pass silently if the walk returns nothing**, including the regression the
   file's own history flags as dangerous, a re-introduced local fork of a shared token.

   ✅ **But the file carries four genuine tier-2 positive controls**, including
   `expect(proved, "the --ward-space-* matcher found nothing even in ward-tokens.module.css…")
.toBeGreaterThan(7)` — the matcher re-run against a file it must match. 🔴 **So this is a
   CONTROLLED file with one redundant line, not a blind guard wearing diligence.** ⚠️ **The narrower
   thing still worth fixing: the redundant `:548` makes `walked` LOOK floored while the real
   protection sits on a different variable, so a reader checking "is this walk floored?" gets a yes
   from a line that answers a different question.**

2. **`ward-expected-reds-manifest.test.ts` — 🔴 NOT HYPOTHETICAL. IT IS BLIND TODAY.**
   `manifest.expected` ships **empty**, so two loops over it pass every day having examined nothing.
   **The file says so itself**: _"ships EMPTY, so this assertion walks zero entries and passes — every
   day, until somebody files the first one."_ ⚠️ **A guard that has never once looked at anything is
   indistinguishable from a guard that works.**
3. **`ward-statistics-v3-language.test.ts` / `v4` — 5 of 7 and 8 of 14 content checks unfloored**,
   including the chart-ceiling rule that edition exists for. A rename of the five carrier files empties
   the population while the checks report clean.

### P2 — a mechanism that fails more quietly than a vacuous pass

4. 🔴 **`ward-nav.test.ts` — a loop that DELETES ITS OWN TESTS.** `for (const entry of
RENDERABLE_ROUTES) { it(...) }` generates **zero test cases** on an empty list. ⚠️ **Nothing goes
   red; the suite silently gets smaller.** That is worse than a false green, because a false green is
   at least a result. **Contrast `ward-route-component-binding.test.ts`, where the same `it.each`
   shape is SAFE — because the list it iterates is a hardcoded map, not the walked population.**
5. **`ward-mode-workspace-reachability.test.ts` — a floor on the SUM of two populations.**
   `testedModes + productionModes > 0` stays true while `testedModes` alone empties — and
   `testedModes` is the one the assertion filters. **A floor on a total is not a floor on its parts.**

### P3 — real, lower blast radius

6. Unfloored inner narrowings in `ward-announced-figures-carry-their-marker`,
   `ward-no-screen-claims-a-durable-access-record`, `ward-status-colour-reach`,
   `ward-table-single-source`, `ward-statistics-demonstration`.

---

## 🔴 4. A sub-class nobody had named: the floor that cannot fail

**Two found, and each reads as diligence.**

🔴 **CORRECTED AFTER REVIEW, AND THE CORRECTION IS A BETTER FINDING THAN THE CLAIM IT REPLACES.**
The first version said the tautology appeared **twice** in `ward-token-layer.test.ts`. **It appears
once.** I grepped the assertion TEXT, counted two, and classified both **without opening either**:

- `:245` — the operand is `panel.search(/\.panel\s*\{/u)`. ⚠️ **`String.search` returns `-1` when not
  found, so `>= 0` means FOUND** — a correct, load-bearing existence check with an accurate message.
- `:548` — the operand is a COUNTER (`let walked = 0; walked += 1`), always `>= 0`. **The real one.**

🔴 **SO `toBeGreaterThanOrEqual(0)` CANNOT BE CLASSIFIED BY READING THE ASSERTION — ONLY BY READING
WHAT THE OPERAND IS.** An index and a count take the identical assertion and mean opposite things.
⚠️ **A pattern sweep for tautological floors therefore produces false positives at a predictable
rate, and every one looks exactly like a real finding.**

✅ **This is §1's own rule turned on an assertion instead of a file: never assert a named thing is
inside a pattern-counted set without opening it.** **I broke it inside the sentence claiming I had
re-measured rather than relayed** — the COUNT was measured and the CLASSIFICATION was inferred, which
is an honest count lending its authority to a claim it never made.

| where                                 | the line                                                         | why it never fails                                                                            |
| ------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ward-token-layer.test.ts`            | `expect(walked).toBeGreaterThanOrEqual(0)` — **once**, at `:548` | `walked` is a COUNTER, always ≥ 0. ⚠️ But this file is otherwise well controlled — see below. |
| `ward-statistics-v3-language.test.ts` | `expect(CARRIERS.length).toBe(5)`                                | measures a **hardcoded array**, not the walk                                                  |
| `ward-statistics-v4-language.test.ts` | the same line, carried forward                                   | v4 fixed three other defects and copied this one                                              |

⚠️ **These are worse than a missing floor.** A missing floor is an omission somebody may notice; **a
decoy floor is an answered question.** A reviewer checking "does this guard have an anti-vacuity
check?" finds one, ticks it, and moves on.

---

## ✅ 5. The remedy already exists in this repository, three times, and is applied inconsistently

**This is the most useful thing the survey found.** Nothing needs inventing.

**Tier 1 — a count floor.** Catches total collapse. Most files have it. ⚠️ **Does not catch
attrition.**

**Tier 2 — a positive control.** Re-run the matcher against something it MUST match.
`ward-travel-grouping.test.ts`: `expect(readers).toContain(ALLOWED)` — the one legitimate reader must
appear, so an empty result fails outright. `ward-raw-colour.test.ts` uses a synthetic fixture for the
same reason, and says why: _"the estate is clean, so the real assertion below passes on an empty list
— indistinguishable from a detector that matches nothing at all."_ ✅ **Catches the matcher breaking,
which a count floor does not.**

**Tier 3 — 🔴 NAME WHAT YOU FOUND BUT DID NOT SCAN.** `ward-provenance-sentences-carry-their-own-marker.test.ts`
reports **`dark`** — headings found where no paragraph was scanned — as its own failure, separate from
"this paragraph is wrong", and ties the counts together: `blocks === headings.length - dark.length`.

🔴 **Its own comment is the argument this whole survey arrives at independently:** a constant floor
_"catches only the last unit that stops being measured."_

⚠️ **This is the ONLY guard in 63 that does it — and it is the guard that caught the on-call defect
that started this survey.** ✅ **`ward-legal-figure-guard.test.ts` is the other gold standard by a
different route: a floor per source AND per form code, adjacent to every assertion, plus eight planted
historical-bypass fixtures proving the detector still fires.**

---

## 6. What I did NOT do, and why

🔴 **I did not add 63 floors.** A change that size is unreviewable, **and a floor on the wrong
population is worse than none — it reports healthy while the thing it was meant to watch is empty.**

**One fix was made, because it was mine:** `ward-on-call-holds-no-people.test.ts`, written the night
before to stop the on-call screen ever showing a phone number, had **two** of the defects surveyed
here — a second test recomputing the population with no floor at all, and a floor on the SUM that
`NETWORK_ON_CALL_ROLES` alone kept true while every per-service role could vanish. ⚠️ **Writing a
guard while actively thinking about this failure did not prevent it.**

**Not checked:** whether the same shapes appear in the 114 walkers outside this survey's method and
directory; whether any population silently FILLS; and whether the sibling-floor pattern is load-bearing
anywhere that runs tests individually rather than by file.

---

## 7. One class with no instrument at all

⚠️ **Some defects here could only ever be caught by a person opening the file for an unrelated
reason.** The worked example is from this lane the same night: **a careful, TRUE comment placed
against the WRONG number** — the renderable-count note sitting above the total-count assertion.

🔴 **Invisible to every gate, and invisible to the author**, who had read the resolution, run its
suites green, and committed it. **It was found because a peer's unrelated question caused the file to
be opened again.** ✅ **That is an argument for cross-checking between chats, not a lament.**

---

## Summary

    DID        Read 63 ward guards that walk a population from disk and asked, of each, whether it
               would fail if it found nothing to look at. Ranked the answers by consequence. Fixed
               exactly one — my own.

    ISSUE      Three findings, in order. (1) My own instrument was ambiguous: two competent readings
               disagreed on the same files because the brief never said whether the unit was the
               assertion or the file — both answers are true and they answer different questions.
               (2) A guard is blind TODAY and says so in its own comments: the expected-reds manifest
               ships empty and two loops over it have never examined anything. (3) A sub-class nobody
               had named — two floors that cannot fail, one a literal tautology and one a count
               of a hardcoded array. A decoy floor is worse than a missing one, because it answers
               the question a reviewer came to ask.

    ⚠️ AND    One headline in this document was WRONG and is corrected in place. I said a tautology
    CORRECTED  appeared twice in one file; it appears once — the other occurrence takes an INDEX from
               `String.search`, where `>= 0` correctly means FOUND. I had grepped the assertion text,
               counted two, and classified both without opening either, inside the same sentence that
               claimed I had re-measured rather than relayed. The count was measured; the
               classification was inferred. It also demotes that file from "blind" to "controlled,
               with one redundant line" — it carries four genuine positive controls.

    GAPS       Not covered: 114 more walkers using a different enumeration method or living outside
               tests/ — including the D-3 gate this survey was chosen to precede. Not covered:
               populations that silently FILL rather than empty, which is the sibling class and
               probably the more dangerous one. And the second reading that exposed my instrument's
               ambiguity happened by accident, so nothing here guarantees a third would agree.

    NEED       Which guards get repaired, and in what order. The P1 list is three files.

    RECOMMEND  Do not add floors across the estate. Repair the three P1 files, delete the three
               decoy floors, and adopt the pattern this repository already invented and applied to
               exactly one guard: report what you found but did NOT scan, as its own failure,
               separate from what you scanned and judged. A count floor catches only the last unit
               that stops being measured — which is the guard's own sentence, written before anybody
               went looking for it.
