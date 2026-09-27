---
name: a-declaration-is-not-an-effect
description: "Reading something that declares a behaviour and asserting the behaviour happened — three times in one session, all while issuing rulings others acted on"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c186bff2-76e5-4e1f-b211-8b26b7fbdcab
  modified: 2026-09-10T17:15:41.107Z
---

Ward Flow, 2026-09-11. Three errors in one session, all mine, all the same shape. Each was caught by
someone else **measuring**; none was caught by a gate, and none could have been.

    a COMMENT describing a guard    -> asserted the guard exists.  It is not in the tree.
    a TOKEN named in my finding     -> asserted the component reads it.  It reads one of two.
    a CSS RULE in a media block     -> ruled on its effect.  Inert: a bare rule 139 lines later wins.

**Why:** two of the three are not CSS at all. The common factor is the **role** — a ruling is acted
on immediately by somebody who cannot check it. A lane that misreads a declaration finds out when its
own test fails. **A coordinator that does it ships the error into every brief.** And the CSS one is
the worst, because the fix commissioned from it was faithful and well built: **a wrong ruling does
not look like a wrong ruling, it looks like a completed task.**

**How to apply:** before ruling on an _effect_, run the thing that produces it. A comment naming a
test → open the test. A token named in a finding → grep the component for it. A CSS rule → measure
it, or read the **whole cascade** for that selector, never the one rule you found. **A positive
control is what makes a negative mean anything** — prove the search can find a real instance
elsewhere first, or "I looked and found nothing" and "my search was broken" are the same sentence.

Where no behavioural test can reach the class — `vitest` loads no CSS in this repo, so an inert
stylesheet rule is invisible to every test — **the catcher has to be static, and it must be proved
against the pre-fix state.** A guard written after the fix has never seen the defect.

Related: [[assert-only-about-code-you-opened]], [[declared-somewhere-is-not-resolvable-here]],
[[a-written-diagnosis-does-not-sweep]], [[a-clean-negative-that-measured-nothing]],
[[right-conclusion-wrong-evidence]], [[tokens-that-read-correct-and-paint-wrong]].
