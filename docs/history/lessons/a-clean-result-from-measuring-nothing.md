---
name: a-clean-result-from-measuring-nothing
description: A runtime crawl with the server down returned "every module never painted" — a complete, tidy confirmation of the hypothesis, produced by measuring nothing
metadata:
  type: feedback
---

Ward Builder Four, 2026-09-06, measuring which ward components no route can reach. **Two first
attempts, both wrong, and the two failure modes are opposites:**

**Runtime crawl:** `routes crawled: 0 of 33`, every module reported _never painted_. The dev
server was down, so every navigation failed. ⚠️ **The output was a clean, complete confirmation of
the hypothesis, produced by measuring nothing** — and the hypothesis was that things were
unreachable, so total failure looked like total success.

**Static scan:** seeded only from `page.tsx` and missed the ward `layout.tsx`, so it reported
**`WardFlowProvider` — the provider every screen depends on — as unreachable.** 🔴 **That
obviously-wrong entry is the only reason the missing edge was found.** A plausible wrong answer
would have shipped.

> **An obviously wrong result is a gift. A plausible wrong one ships.**
> **And a measurement whose failure mode LOOKS LIKE its expected result cannot be read at all
> without a positive control.**

**How to apply:**

- **Every crawl, scan or sweep carries positive controls** — items that MUST come back found. Here
  `capacity`, `delays` and `ward-record-row` had to return RENDERED before any negative meant
  anything. **The eleven negatives are only evidence because the three positives returned.**
- When a result confirms your hypothesis completely and tidily, **ask what a total instrument
  failure would have looked like.** If the answer is "this", you have not measured yet.
- Seed a reachability graph from **every** entry point, not the obvious one. Layouts, providers,
  and wrappers are edges too.
- Count the right unit: a first pass over files _mentioning_ the components gave **165** cases;
  **79** actually test them, the rest naming them as route data. See
  [[establish-the-unit-before-counting]].

Related: [[two-task-lists-one-check]], [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[compliance-without-coverage]].

## The sharpest formulation, and two more instances — same session

> 🔴 **"Three times in this investigation a probe returned a clean negative that meant nothing.
> Every one of those negatives AGREED WITH THE HYPOTHESIS I WAS TESTING."**

Twice the dev server was down mid-crawl; once a guessed selector matched nothing and the click ran
against an empty locator. **The script's own `NONE FOUND — the click below proves nothing` line is
the only reason that third zero was not read as confirmation.**

⚠️ **When you are testing for an ABSENCE, every instrument failure is a false confirmation.** That
is not a bias to resist, it is a structural property of the question — so a probe hunting absence
needs its positive control more than any other kind.

**And a second probe defect worth its own line:** the first pass took **the first `data-testid` in
each file**. In this codebase that is very often a _conditional_ marker, so its absence means _"that
state did not occur"_, not _"the component never rendered"_. **Four of five candidates were the
probe's fault.**

> **A probe built from the first thing you find measures the first thing you find.**

Re-probing with **every** marker a file can emit cleared four at once. The fifth needed a click, and
the working selector came **from the rendered page, not from memory**.

---

## 2026-09-09 — an IGNORED file and a CLEAN file print the same success line, byte for byte

**Found by Ward Builder Three.** `prettier --check` over a path excluded by the ignore list prints:

    All matched files use Prettier code style!

**which is the identical string a genuinely clean file produces.** Nothing in the output says the
matched set was empty. So "formatting is fine" and "formatting was never looked at" are the same
sentence, and the second one is indistinguishable from success at every level a reader sees.

🔴 **THE DISCRIMINATING PAIR, WHICH IS WHAT MAKES THIS ACTIONABLE RATHER THAN A WARNING:**

    prettier --check <path>                        ->  "All matched files use Prettier code style!"
    prettier --check --ignore-path /dev/null <path> ->  FAILS if the file is genuinely unformatted

**If the second command does not flip the verdict, the first one measured something.** If it does,
the first one measured nothing. One extra flag separates a pass from an absence.

⚠️ **Third instance in a single day of a green that meant nothing was measured** — the others being a
pipeline returning `tail`'s exit code, and a `describe.skip` file reporting 20 skipped inside a suite
whose totals still read healthy. **They share no mechanism and one habit defeats all three: check the
POPULATION, not the verdict.** A check that names how many files, tests or rows it examined cannot
hide an empty set; one that reports only a colour always can.

Related: [[compliance-without-coverage]], [[gate-wrappers-mask-exit-codes]], [[checks-that-cannot-fail]].

## 2026-09-09 — five in one day, sharing no mechanism, and the one habit that beats all five

Grepped this store first: the instances exist separately, the FAMILY did not. Recorded with Ward
Builder Two, who hit three of the five.

    1  `npm run gate 2>&1 | tail -40`      read `tail`'s status; `pipefail` off. Reported a
                                           refusal as success, and produced a FALSE FINDING against
                                           a repo gate that two people then endorsed.
    2  `prettier --check <ignored file>`   "All matched files use Prettier code style!" — the same
                                           words for "formatted" and for "skipped, never looked".
    3  `grep -c "<retracted phrase>"`      1 hit — the retraction quoting the phrase inside its own
                                           withdrawal. Retract-in-place defeats every later search.
    4  process filter on `CommandLine`     `Win32_Process` has no working-directory field, so the
                                           filter could not return a hit. Clean negative from an
                                           instrument structurally incapable of a positive.
    5  `npm ci` after a V8 fatal error     exit 0 with `node_modules/.bin` EMPTY.

⚠️ **THEY SHARE NO MECHANISM, WHICH IS WHY NO SINGLE GUARD CATCHES THE CLASS** — a shell option, a
tool's ignore semantics, an honest retraction, a missing OS field, a crashed installer. **What they
share is that the success path and the never-ran path emit the same signal.**

> 🟢 **Check the POPULATION, not the verdict.** How many tests collected, how many files matched, how
> many packages linked, how many rows returned. **A report that names what it examined cannot hide an
> empty set; one that reports only a colour always can.**

That is what protected me on the only one I met head-on: I did not doubt the claim, I ran the guard
directly and saw **13 tests executed in 3.11s** rather than accepting a green. The same habit defends
against a fabricated finding and a real one identically, which is why it beats scepticism aimed at
any particular source. See [[gate-wrappers-mask-exit-codes]],
[[a-clean-negative-that-measured-nothing]], [[compliance-without-coverage]].
