---
name: scrollwidth-fabricates-overflow
description: documentElement.scrollWidth reports overflow on a page that cannot overflow; it re-finds a fixed bug and invites repairing a working scroller
metadata:
  node_type: memory
  type: feedback
  originSessionId: a8d04697-d651-4023-a4c8-7226e9ed0591
  modified: 2026-09-17T16:59:02.963Z
---

`document.documentElement.scrollWidth` is not evidence of horizontal overflow. Measured
2026-09-18 on Ward Flow `/mockups/ward-flow/ed/rph-ed` at tip `6fd766d37c`: it read **2040**
in a 1425px viewport while `document.body.scrollWidth` was **1425** — the viewport exactly —
and a sweep of every element whose right edge passed the viewport found **zero** that were not
inside a scrollable ancestor. Both `html` and `body` are `overflow-x: clip`, so the page
cannot be scrolled horizontally and nothing was cut off. The html figure was reporting an
unclipped descendant box inside a working `overflow-x: auto` scroller.

**Why this is worth writing down: the 17 Sept audit used exactly this metric** (peel-ed 2013,
rph-ed 2513, tablet 1769) and reported "still overflows" as a P1. It had in fact been fixed —
the board table moved into a scrolling wrapper. Re-running that metric reproduces a finding
that is not there, and the "fix" would dismantle a working scroller.

**The two measurements that do discriminate:**

1. `document.body.scrollWidth` vs `documentElement.clientWidth`.
2. Count elements whose `getBoundingClientRect().right` passes the viewport AND which have no
   ancestor with `overflow-x: auto|scroll` that is itself scrolling. Zero means clean.

And prove a scroller really scrolls by setting `scrollLeft` and reading it back — a container
with `overflow-x: auto` that is not actually wider than its content will not move.

⚠️ **The general shape, which is the part that transfers:** a metric that aggregates a
descendant's _layout_ box says nothing about what the user can see, because clipping and
scrolling both happen between the two. Before believing a number that says a screen is broken,
check that the number could have said "fine" for a screen that IS fine.

Same family as [[a-clean-result-from-measuring-nothing]], [[a-clean-negative-that-measured-nothing]],
[[looking-at-the-screen-misattributes]] and [[read-the-failure-message]]. The ruling this nearly
overturned is in [[ward-flow-owner-rulings-2026-09-04-review]]'s successor WLQ-4; see also
[[a-guard-that-defends-a-superseded-ruling]].
