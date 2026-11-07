---
name: a-baseline-from-the-subject-vouches-for-it
description: "A drift check whose baseline was captured from the file under test inherits whatever is already wrong with it, then reports IDENTICAL while the file is in breach"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2b6afefc-3c5d-42e8-9a09-d310ecde7e2f
  modified: 2026-09-04T20:25:08.052Z
---

**A baseline taken from the thing under test inherits its defects and then vouches for them.**
Measured 2026-09-04 on Ward Flow. A builder hashed a mockup's shared style block against a `.bak` it
had taken of that same file before editing. The block was already in breach — two properties had been
added inside a section the design language forbids touching. **The check reported IDENTICAL twice
while the file was non-compliant the entire time.**

**The method was sound and the scope was wrong.** It could only ever answer _"has this changed since
I arrived?"_, and it was read — by the builder and by me — as _"is this correct?"_. Both readings
produce the word IDENTICAL, so nothing distinguishes them at the point of reporting.

⚠️ **The defect was found by the OTHER session, which compared against the canonical source instead
of a local snapshot.** That is the comparison that can fail. Same file, same property, two
methods — only one of them could ever have disagreed with the file.

**Why:** self-comparison is a tautology with a delay in it. It is the [[checks-that-cannot-fail]]
family, but with a specific and seductive shape: the baseline artefact is _real_, it was captured
honestly, and its timestamp makes it look like independent evidence. Nothing about a `.bak` announces
that it is a photograph of the defendant.

⚠️ **This was one edit away from becoming a committed gate.** The planned contract test was going to
check each route's token block against the copy that route already carried — the same comparison,
promoted to CI, green on every build forever. **The test would have been written, reviewed, passed
and trusted.**

**How to apply:**

1. **Ask what the baseline is a copy of.** If the answer is "the file I am checking", the check
   measures your own edits and nothing else. Say so in the report rather than reporting a pass.
2. **Drift is measured against one canonical declaration**, and every other copy must be absent, not
   merely equal. "Declared exactly once, everywhere else zero" can fail; "all copies agree" cannot
   catch a defect present in all of them — which is the state a shared block drifts into.
3. **Detection and compliance are two claims. Retract them separately.** The builder's
   concurrent-write detection was real and worth keeping; only the compliance claim was void.
   Collapsing both into "my check was wrong" throws away the true half.
4. **A green from a self-baseline is worth less than no check**, because its pass gets spent as if it
   meant something — see [[a-working-safeguard-leaves-no-trace]] for the reverse error.

Related: [[a-property-that-does-not-discriminate]], [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[compliance-without-coverage]], [[which-assertion-went-red]].

## Recurred 2026-09-05, with a new and much likelier trigger

A mutation-battery script crashed mid-run — a Windows cp1252 decode error on an em-dash in a test
name — **after applying the mutation and before putting the file back**. The next run read that file
as its baseline. Control red, all four mutants red for the same unrelated reason, reported as
**"4 caught"**. The fix under test happened to be correct, so nothing would ever have contradicted it.

**The control is the only thing that revealed it**, which is the whole argument for running one even
when the mutants are the interesting part.

**Fix applied:** the harness now takes its baseline from `git cat-file blob HEAD:<path>`, never from
the file under test, and **refuses to start when the working file already differs from HEAD**. A
mutation driver without both of those can be poisoned by its own previous crash.

## Recurred 2026-09-07 as a TEST EXPECTATION, which is the cheapest way to write it

Ward Flow's sidebar counts. The DOM test computed its expected values by calling
`wardNavCounts(...)` — the function under test — and asserting the rendered link matched. It read as
a real check and was written deliberately: _derived, not typed_, which is the correct instinct and the
usual advice in this repo.

**It could not fail.** Mutating `movements.filter(isOpen).length` to `movements.length` inside
`wardNavCounts` moved the expectation and the render together; all fifteen cases stayed green.
Measured, not reasoned about — the mutation was run.

**"Derived, not typed" is only half the rule. The other half is _derived by a path that does not go
through the subject_.** The fix was to re-derive each figure in the test from the primitive
derivations it is supposed to read (`serviceRollup`, `delayGroups`, `referralState`), never via the
module. Both mutants then died and named the right defect (43 open vs 50 total).

⚠️ **The tell is that the test imports the thing it is testing and uses it on the expectation side.**
That is visible at a glance in the import list, and it is worth checking for whenever a test's
expected value is computed rather than written down.

**A literal is not the alternative** — a literal ages and gets edited until nobody reads it. A second
independent derivation is.
