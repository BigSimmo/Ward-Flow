---
name: a-suite-count-is-an-upper-bound
description: "On this machine a whole-suite red count is an upper bound, not a measurement — and the plausible author of a red is not its author; git blame on the named line is"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d9f6d3ee-6105-489f-896e-5c1538d8238d
  modified: 2026-09-17T20:43:30.449Z
---

**Measured 2026-09-18 on the merged ward tree.** `check:ward-expected-reds` reported **24 ward test
files failing**. Re-running all 24 in isolation and reading each failure for the file it names
changed the picture completely — and the headline number was the least useful thing in it.

🔴 **A whole-suite count here is an UPPER BOUND, not a measurement.** One of the 24
(`ward-legal-figure-guard`) passes on its own, twice, in two groupings. This machine's vitest worker
forks crash under load: the same session saw `ward-flow-chat-control` report 25, 38 and 42 of 44
passing on three attempts **without ever failing an assertion**. See
[[local-test-failures-windows]]. **A red nobody reproduces in isolation is not yet a defect.**

## The attribution trap, which cost the most time

⚠️ **The plausible author of a red is not its author.** `ward-nav`'s community-route coverage moved
from "0 of 64" to "1 of 64". The session had, that same night, pointed the hub at the 64 real
community teams — **and 64 was the number that task produced**, so the red looked unmistakably its
own. It was not. `git blame` put the new concrete href in
`ward-flow-sign-in-data.ts:312`, from another tool's snapshot.

✅ **The procedure that works, in order:** read the failure message for the FILE it names → `git
blame -L <line>,<line>` that line → the commit answers whose it is. Not "which task touched this
area", which is a guess dressed as a finding. Related: [[reflog-answers-whose-commit]],
[[read-the-failure-message]], [[assert-only-about-code-you-opened]].

## Two counts of different trees do not subtract

The protected snapshot was failing ~21 files; the merged tree reported 24. **These were counted by
different methods on different trees; 24 − 21 = 3 is not a fact.** Say what each figure measured and
stop. [[name-the-tree-before-disputing-the-method]], [[establish-the-unit-before-counting]].

## When a guard fires on your own new layer

The reference registry states "Royal Perth Hospital", which reads as a second home for a fact the
one-home guard keeps single. ✅ **The answer was to record it in the guard's allow-list WITH its
reasoning and bump the guard's own canary, never to widen the guard quietly** —
[[a-guard-that-blocks-its-own-purpose]]. It is genuinely not a second home only because it is
generated and a drift gate reddens on any hand-edit; that sentence is what belongs in the entry.

⚠️ **And its mirror, which is the one to refuse:** the same run reddened a clinical-privacy
assertion because another session added a "Change Ward" dropdown listing every ward. **Narrowing a
privacy assertion so a new feature passes is never done by whoever wants the feature.** Record it
and hand it to the owner. [[two-rulings-that-collide]].
