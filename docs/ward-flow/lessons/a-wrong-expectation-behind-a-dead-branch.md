---
name: a-wrong-expectation-behind-a-dead-branch
description: "An unreachable test branch does not merely prove nothing — it can hold an assertion that is FALSE, and green reads as settled"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5e393ec4-f01a-41a0-b49b-d6c9d0bca57b
  modified: 2026-09-05T16:27:46.653Z
---

2026-09-05, Ward Flow capacity screen. A test walked every ward row and asserted, on the untracked
arm, that the cell reads `/not tracked/i`. The panel test did the same for its own absence prose.

**Neither arm can run.** `CapacityScreen` reads `bedReleases` from `useWardFlow()`, typed
`BedRelease[]` and never `undefined`, so the derivation always returns a number. Measured: 23 rows,
0 untracked, 15 of them showing a real `0`.

🔴 **And the panel's assertion was FALSE.** Its absence paragraph reads _"Nothing this screen reads
can say how many beds will free up before the day ends…"_ — the words "not tracked" appear nowhere
in it. **That assertion would have failed the first time it ran, and it has never run.**

**Why: a dead branch and a wrong branch are the same colour.** Everyone knows an unreachable branch
proves nothing. The part that catches you is that nobody re-derives whether it is even _correct_,
because it is green and it is specific and it names a real property — so the next reader treats it
as a settled question. **A wrong expectation hidden behind an unreachable branch is worse than no
expectation at all.**

**How to apply.**

- When a test has an `if (x === undefined)` / `else` shape over production data, **go and measure how
  many members take each arm** before trusting either. The count is usually one query.
- **An arm with zero members is a claim nobody has checked.** Read its assertion against the real
  string the code produces, not against what the arm is _about_.
- The fix is not to delete the arm. **Split the decision out of the JSX into a pure function** so
  both answers are directly constructible, prove the PROPERTY there exhaustively, and leave the DOM
  test asserting that the screen defers to it. Same move that made an unreachable arithmetic
  safeguard testable a session earlier.
- **Pin the property, never the phrase** — the copy will be reworded — and run the rewording as a
  CONTROL that must stay GREEN. Ban neither digits nor the word "zero": the honest paragraph here
  says _"A zero here would claim nothing is freeing today"_, mentioning a zero to explain why none is
  shown, and a word-ban goes red on the most careful sentence on the screen.

Related: [[the-suite-never-tests-the-absence]], [[a-guard-that-pins-the-old-wording]],
[[a-fix-can-obsolete-its-own-guards-question]], [[tests-that-assert-rendering-not-truth]],
[[a-mention-is-not-an-assertion]], [[a-property-that-does-not-discriminate]].
