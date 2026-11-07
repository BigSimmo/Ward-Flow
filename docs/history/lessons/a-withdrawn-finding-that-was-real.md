---
name: a-withdrawn-finding-that-was-real
description: "I measured a real defect twice, then withdrew it because four sibling cases showed nothing — and their showing nothing was a consequence of the defect's own mechanism"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 4f18cd31-6a33-4c8c-adaa-ba332e583ab7
  modified: 2026-09-05T11:18:24.959Z
---

**A finding that four sibling cases fail to reproduce is not refuted. Ask whether the mechanism
predicts exactly that pattern before you drop it.**

Ward Flow, 2026-09-05. I opened the community index and measured a team name sitting under a sticky
letter heading: **`Albany`, 18px of its 20px row covered.** Measured twice, consistently, on a fresh
load. Then I checked B, C, E and G, got **zero overlap on all four**, noticed my "first row" selector
was not comparing like with like across groups, and **withdrew the finding.** I told the owner in as
many words that I was not claiming it and it might be nothing.

**It was a team on the page that could not be clicked.** Ward Builder Three looked properly:
`elementFromPoint` at the centre of that row returned the `<h3>`, whose gradient painted over the
name. The cause was `position: sticky; top: 6rem` against a `main` scroll container, which pinned
**the first group's heading 39px below its own section's top — inside the list.**

⚠️ **That cause predicts my four zeros exactly.** Only the FIRST group can have its heading land
inside its own rows; every later heading has content above it and behaves normally. **The pattern I
read as a refutation was the mechanism's signature.** I had both halves — a solid measurement and a
puzzling distribution — and treated the second as cancelling the first instead of as the thing to
explain.

**How to apply:** when a measured finding fails to reproduce on siblings, write down what would have
to be true for BOTH observations to hold. If a plausible mechanism explains the asymmetry, the
finding is live and narrowed, not dead. And when the withdrawal is what lets you stop working, that
is the moment to be slowest — mine arrived at the end of a long night with everything else finished.

⚠️ **Second half, and it is about the instrument, not the judgement: my selector was inconsistent
ACROSS the cases I compared** (row heights came back 40, 40, 40, 254, 176 — some were containers,
not rows). **An inconsistent comparator produces zeros that look like evidence of absence.** Both of
tonight's other false conclusions had the same shape. See
[[establish-the-unit-before-counting]], [[measure-the-thing-not-a-proxy]],
[[a-correct-diagnosis-that-stops-the-inquiry]], [[a-measurement-is-scoped-to-what-it-measured]].

**And the reason it mattered here:** no test could see it. `getAllByTestId` returns 65 links whether
or not something is painted on top of them, and jsdom computes no geometry. A second defect on the
same page — a team name rendering as a one-character-wide vertical column at 390px — was invisible
the same way. **Both were green in every suite and found by opening the page.**
[[tests-that-assert-rendering-not-truth]], [[ward-journeys-run-in-neither-loop]].
