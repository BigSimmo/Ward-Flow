---
name: a-structural-guarantee-is-invisible-behaviourally
description: "Three columns share one decision" cannot be tested behaviourally — a faithful copy produces identical output, so only a source check sees it
metadata:
  type: feedback
---

A screen's three count columns were unified behind one helper so they **could not disagree by
construction**. I asked for the obvious guard:

    expect(freeingCellText(v)).toBe(countCellText(v))   // over several values

**Ward Builder Three built it, re-ran the mutation, and the mutant survived again.**

**Because a hardcoded copy of the rule is a CORRECT copy.** Un-wire a column and reimplement the
rule inline: both sides still genuinely agree, so the deferral assertion passes. **Un-wiring
produces byte-identical output, so no behavioural assertion — rendered or direct — can
distinguish one shared decision from three faithful copies.** The structural guarantee is exactly
the thing behaviour cannot see.

⚠️ **And it was the fix I would have written unprompted.** It is theatre against this defect —
the second kind of failure in Ward Verifier's framing: _a property nothing asserts and a property
asserted by something that cannot go red are indistinguishable from the suite._

**What actually works:** keep the behavioural assertion (it catches the _other_ direction — the
shared decision changing while a consumer does not follow), and **add a source-level check
requiring every call site**, with comments stripped, plus a control proving a comment-only phrase
does **not** satisfy the strip. Otherwise the prose explaining the rule satisfies the search for
it — see [[a-comment-can-satisfy-a-guard]].

**How to apply:**

- Ask what the mutation would _change on screen_. **If the answer is "nothing", no test can catch
  it and only the source can.**
- Structural properties — "these all route through one place", "nobody imports this directly",
  "the list is derived not typed" — are source properties. Guard them at the source.
- Related: [[a-guarantee-that-holds-one-direction]], [[the-suite-never-tests-the-absence]],
  [[a-property-that-does-not-discriminate]], [[a-shared-decision-is-not-a-behavioural-property]] (author perspective on this same incident).

The mutation harness is what surfaced it: it **named the failing assertion unprompted**, so
"suite is red" could not be mistaken for "my guard caught it". Hand-rolled, the reviewer would
have grepped for `1 failed`, seen red from something else, and moved on — see
[[which-assertion-went-red]].
