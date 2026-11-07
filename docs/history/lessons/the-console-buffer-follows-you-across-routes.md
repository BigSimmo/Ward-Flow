---
name: the-console-buffer-follows-you-across-routes
description: "Browser console reads accumulate across in-tab navigations, so every later page inherits the first page's errors and a one-page defect reads as tree-wide"
metadata:
  node_type: memory
  type: reference
  originSessionId: 5e393ec4-f01a-41a0-b49b-d6c9d0bca57b
  modified: 2026-09-05T17:20:38.573Z
---

2026-09-06. Found a React hydration failure on the Ward Flow board, then navigated the same tab to
capacity, governance and network and read the console at each. **All four reported it.** I was one
message from telling the coordinator "every ward route fails hydration on every load".

**A fresh tab on `/delays` was clean. A fresh tab on the BOARD was clean too.** The error had been
logged once, on the very first load, and `read_console_messages` was returning the tab's whole
accumulated buffer every time — so each new route inherited the previous route's errors.

**The real finding was the opposite shape: an INTERMITTENT defect, not a universal one.** Both
claims are "the board fails hydration"; only one of them is a reason to stop a release.

## How to apply

- **One route per fresh tab** when attributing a console error to a page, or read the buffer, clear
  the attribution, and re-read after the navigation.
- **Establish a clean baseline in the new tab first** — a route you expect to be quiet. If the tab
  reports nothing there, a subsequent error is genuinely that page's.
- **A defect that appears on every page you visit, in visit order, is a buffer artefact until
  proven otherwise.** Real tree-wide defects also appear on the FIRST page you visit in a fresh tab.
- **Reproduce before reporting frequency.** "Every load" and "sometimes" are different severities,
  and the accumulating instrument only ever errs toward the alarming one.

Related: [[observations-expire]], [[measure-the-thing-not-a-proxy]],
[[a-correct-diagnosis-that-stops-the-inquiry]], [[caveat-only-in-the-report]],
[[establish-the-unit-before-counting]].

## The defect underneath, worth its own line

`useState(() => wallClockNow() - NOW_ANCHOR)` runs on the server during SSR **and again on the
client during hydration**. Any minute boundary between them shifts the value — and in Ward Flow
that offset feeds `shiftInstants(seed, offset)`, so a one-minute straddle moves every timestamp in
the whole seeded world at once.

⚠️ **Nothing caught it because every test passes `initialNow`, the argument that short-circuits the
wall clock — the suite exercises precisely the branch where the bug is impossible.** jsdom tests
never server-render either. Related: [[rsc-boundary-invisible-to-gates]],
[[the-suite-never-tests-the-absence]], [[the-artefact-you-search-is-not-the-artefact-that-runs]].
