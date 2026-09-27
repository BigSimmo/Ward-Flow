---
name: the-fixture-your-tests-render
description: "A mutation survived because no movement the 50 tests rendered carried the field — the mutant ran, the assertions ran, and the data was never there"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5e393ec4-f01a-41a0-b49b-d6c9d0bca57b
  modified: 2026-09-06T04:47:32.482Z
---

2026-09-06, Ward Flow. I fixed a line that rendered a stored code where a label map existed
(`reason.replaceAll("_", " ")`, on a field whose own doc comment said _"Render
`withdrawalReasonLabels[reason]`, never the code"_). Then I reverted the fix as a mutation.

**All fifty tests stayed green.** Not because the assertions were weak, and not because the mutant
did not execute — the file loaded, the page rendered, every assertion ran. **No movement any of
those tests rendered carried a withdrawn referral at all.** One fixture in fifty did (WF-006), and
nothing had ever rendered it.

This is a distinct failure from [[a-green-mutation-that-changed-nothing]] and
[[a-green-mutation-only-counts-if-the-mutant-ran]]: the mutant ran, and the population it ran
against simply did not contain the case. **A fix with no failing mutation is indistinguishable from
a fix that does nothing**, and the only reason I know the difference is that I ran the mutation
instead of counting the fix as done.

## How to apply

- **Every fix gets a mutation, including the one-liners that feel like plumbing.** This one was a
  single expression on a line I was already editing for another reason.
- **When a mutation survives, the first question is whether the DATA reaches the code**, not whether
  the assertion is strong enough. Grep the fixture for the field: `grep -c "field: \[\]"` against
  `grep -n "field: \[$"` tells you in one line how many carry it.
- **A fix I made in passing, to a line I was not asked to touch, is the likeliest one to have no
  fixture behind it** — precisely because nobody had exercised that path before either.
- Related: [[run-the-mutation-before-relaying]], [[compliance-without-coverage]],
  [[floor-the-denominator-never-the-numerator]], [[fields-with-no-producer]].

## The same session, the other direction

I nearly shipped a control gated on `stage` when it needed `acceptedUnitId`. `STEP_BACK_STAGE`
deliberately never writes `acceptedUnitId`, so a movement can sit at Destination review **with a
ward still named as having accepted it** — and my control would have printed _"No ward has accepted
this patient"_ over a page whose masthead named that ward. **Two clicks apart, on one screen,
reachable only by the two controls I had just built.** Building two controls creates states neither
existed in before; ask what the other one does to your own precondition.
