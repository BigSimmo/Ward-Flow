---
name: a-shared-decision-is-not-a-behavioural-property
description: "One source of truth versus three faithful copies produce identical output, so no behavioural test can tell them apart — including the deferral assertion written for exactly that job"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9196936a-67c8-429f-8951-37f5069dea95
  modified: 2026-09-06T04:47:54.236Z
---

On 2026-09-06 I unified three CSS cells onto one helper, `countCellText`, because three copies of
one rule with only one updated was literally how the defect had shipped. A peer then found the
helper was **referenced by zero test files**. Confirmed by mutation: un-wiring one consumer and
hardcoding the rule left **55 tests across four files green**.

**The instruction was to add `expect(freeingCellText(v)).toBe(countCellText(v))` over several
values. I wrote it, with an anti-tautology clause, and re-ran the identical mutation. IT SURVIVED
AGAIN.**

🔴 **A hardcoded copy of the rule is a CORRECT copy.** Both sides genuinely agree, so the deferral
assertion passes. Un-wiring a consumer produces **byte-identical output** — so no behavioural
assertion, rendered or direct, can distinguish _one shared decision_ from _three faithful copies_.

**Why this is its own category:** the usual failure is a check that cannot fail. This is a real
property that behaviour cannot express at all. "There is one place where this is decided" is a
statement about the SOURCE, not about the output, and every output-based method — DOM assertion,
unit assertion, mutation of values — is blind to it by construction. The only thing that sees it is
a source-level check (comments stripped, or the prose explaining the rule satisfies the search for
it).

**How to apply:** when the value of a refactor is _"now they cannot drift apart"_, ask what goes red
if someone re-duplicates it correctly. If the answer is nothing, the guarantee is unguarded and a
behavioural test will not fix it. Keep the deferral assertion anyway — it catches the _other_
direction, a shared decision changing while a consumer does not follow — but add the source check
for the direction it cannot see. **And verify the fix with the same mutation that exposed the gap:**
mine passed review, read correctly, and did not work.

The harness naming the failing assertion (`scripts/ward-flow/mutation-run.mjs`) is what surfaced it.
Hand-rolled, I would have grepped for a red and concluded the fix worked.

Related: [[a-property-that-does-not-discriminate]], [[tests-that-assert-rendering-not-truth]],
[[which-assertion-went-red]], [[a-comment-can-satisfy-a-guard]], [[a-structural-guarantee-is-invisible-behaviourally]] (reviewer perspective on this same incident).
