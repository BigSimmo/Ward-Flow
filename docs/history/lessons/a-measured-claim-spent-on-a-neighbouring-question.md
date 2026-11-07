---
name: a-measured-claim-spent-on-a-neighbouring-question
description: "A rigorous measurement answers one question, and the rigour makes it feel safe to report the ADJACENT question it never asked — authorship spent on status, non-matching spent on unguarded."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 13c6e0ab-aac1-4d38-bec5-622e555c2b64
  modified: 2026-09-06T23:25:24.135Z
---

**Four instances in one night on Ward Flow, three by one chat and one by me.** Every time, the
measurement was sound, the control was run, and the _reported claim was a different claim_.

    MEASURED                              REPORTED                         THE GAP
    reflog: this commit is not mine   ->  "this is unfixed"                authorship vs status
    the regex does not match my spec  ->  "the gap is unguarded"           matching vs guarded
    this file has both overflow decls ->  "the forced-auto rule caused it" presence vs cause
    two cases pin one filename each   ->  "caring-contacts has no walk"    these cases vs all cases

⚠️ **THE RIGOUR IS THE HAZARD, and this is the non-obvious part.** _"A sloppy measurement makes me
check; a clean one stops me."_ Having run a proper positive control, the result feels earned — and
that earned feeling attaches to whatever sentence gets written next, including one the control never
touched.

**The check: write the question your evidence answers, verbatim, beside the sentence you are about
to send. If they are not the same sentence, you have not finished.**

## A false negative about a guard is not the safe direction

Over-reporting had felt conservative. It is not. **A working guard is invisible by construction**, so
declaring one missing is cheap to say and expensive to be wrong about: **whoever believes you routes
around it and stops reading its output as meaningful.** Reporting "you have no coverage here" when a
guard exists degrades a control that works, in the name of protecting somebody from its absence.

## Search for the guard by the harm, not by the mechanism

The ward-spec selection guard lives in `tests/playwright-project-isolation.test.ts` — a file no
search for "ward spec selection" surfaces. **Search by the HARM you fear, or by the error message you
would want to see when it fires.**

🔴 **AND THE CLASS THAT PROMPTED THIS WAS GUARDED AT TWO INDEPENDENT LEVELS, NEITHER OF WHICH
EITHER OF US FOUND.** `tests/playwright-project-isolation.test.ts:295` walks `ui-ward-*` and asserts
each is collected; `:354` walks EVERY `ui-*.spec.ts` and fails on any collected by no config at all,
with an anti-vacuity floor and the instruction _"Do NOT silence this by narrowing the disk scan."_
**The top-level `testMatch` is itself an allowlist, so a brand-new spec of any name in any area
reddens.** Both were found only by searching for where a guard would live, never by searching where
the defect lived.

⚠️ **The file had also already written down the exact nuance being doubted** — _"COLLECTED BY SOME
CONFIG IS NOT COLLECTED BY THE RIGHT ONE"_. Whoever built the guard had anticipated the objection.

**Proving a guard exists means running it against an injected bad input** — the guard's own pattern,
its own disk population, one new name; red with that name in the message, plus a control name that
must fail. Reading the assertion is not the same as running it.

Related: [[a-measurement-is-scoped-to-what-it-measured]], [[not-an-ancestor-is-not-unfolded-work]],
[[a-working-safeguard-leaves-no-trace]], [[a-clean-negative-that-measured-nothing]],
[[read-what-the-guard-reports-not-its-source]].
