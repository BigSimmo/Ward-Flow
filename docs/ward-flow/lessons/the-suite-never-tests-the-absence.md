---
name: the-suite-never-tests-the-absence
description: A default parameter is only wrong when omitted and a type-only required field only when absent — the suite exercises the feature thoroughly and never the missing case
metadata:
  node_type: memory
  type: feedback
  originSessionId: db884133-9f0b-4227-abb1-8e177a1270e4
  modified: 2026-08-30T12:35:10.723Z
---

2026-08-30. Two sessions found the same defect shape independently within an hour, on different
surfaces, and neither suite could see it.

**Mine.** `edPressure(now, movements = wardMovements)` defaulted to the frozen seed module. Both
home-page callers had forgotten to pass live state — `FlowDiagram` called `edPressure(now)`, and
`PressureStrip` declared its own prop OPTIONAL and the coordinator screen rendered it without one.

**Ward Core's.** `reason` was declared required on `CANCEL_TRANSPORT`; a caller omitting it wrote
`reason: undefined` into the unwind record with the suite green.

**The common rule:**

> A default parameter is only wrong when **omitted**. A type-only required field is only wrong when
> **absent**. In both cases the tests exercised the parameter thoroughly and **never once exercised
> its absence — the only state in which the bug exists.** That is not coverage. It is a blind spot
> with a high line count.

**The mechanism underneath both: `vitest run` involves no `tsc` at all.** Any guarantee carried by
the type system alone is unenforced at runtime, and the test suite cannot tell you. `npm run
typecheck` is a separate gate and does not cover tests either. So a required field is a comment
until something checks it at runtime — Core's fix was membership in `CANCEL_TRANSPORT_REASONS`.

**When you see a default, ask what tests the call WITHOUT it.** If the answer is nothing, that is
the finding.

## The fix is to remove the optionality, not the injection point

The injection point was never the problem — without it every assertion keys off one fixture where
every department is busy, which is what let three false-positive tests through review. **Making it
OPTIONAL was the problem.** A required argument makes the defect impossible to reintroduce; the
compiler then finds every caller for free.

## A uniform offset is not a uniform error once anything thresholds on the value

Mutation-proving printed the whole thing in one line, including the half I had not predicted:

```
expected [3895, 757, 1915, 1127, 1090, 1016, 979, 905]
to equal [3720, 1740,  952,  915,  841,  804,  730, 582]
```

Every figure inflated by exactly the 175-minute anchor offset, as expected — **but the ORDER moved
too.** `edPressure` sorts worst-first with breach count outranking wait length, so inflating every
wait pushes departments over a deadline they have not passed. The panel exists to answer "which
department is worst, first", and it was answering wrongly.

**So: predicting the magnitude of an error does not mean you have predicted its effect.** Anything
that buckets, thresholds, sorts or ranks turns a uniform shift into a non-uniform outcome.

## The specific Ward Flow shape: a re-anchored clock compared against un-re-anchored data

The provider re-anchors the whole fixture to the hour the demo is opened
(`shiftInstants(seedWardFlowState(), wallClockNow() - NOW_ANCHOR)`). The old code moved only ONE
side of the subtraction. **A default is only one way to get there — passing a seed explicitly
produces the identical bug.**

Every DOM test pins `initialNow`, so the offset is zero and shifted equals unshifted **byte for
byte**. The one condition under which the bug exists is the one condition no test creates.

**The guard that works is an INVARIANCE, not a value:** shift the clock and the data together and
the figures must not move. Pair it with a second half that constructs the stale answer and asserts
it differs, or the first half can pass by being vacuous.

**Measured bound, 2026-08-30 at `09b4a9e87`:** `ward-flow-reducer.ts` is the only production module
under `ward-management/` importing the movements seed, and no seed-module parameter default survives
anywhere in `src/`. The other four seeds were never checked for the same SHAPE.

Related: [[measure-the-thing-not-a-proxy]], [[checks-that-cannot-fail]],
[[read-the-failure-message]], [[restoring-a-mutated-file]],
[[agreeing-checks-with-one-blind-spot]].

## A probe missing an argument returned one right figure and one invented one — 2026-09-06

Checking the ward statistics screens, I called `wardStatistics(unit.id, admissions)` on a function
whose signature is `(unitId, admissions, now)`. **Vitest runs no tsc, so it ran with `now` as
`undefined`.**

    blocked   = 13   ✅ correct — readyToLeaveCannot never reads `now`
    longStays =  0   ❌ fabricated — the band is elapsed-time against `now`

The screens rendered long-stay counts of 3, 2, 4… so my zero looked like **a defect on every ward
page at once**, and I was one message away from reporting it. **What nearly sold it was the figure
that WAS right**: two numbers from one call, one of them checkable against the rendered page and
agreeing, is exactly what a working probe looks like.

**Why:** a missing argument does not fail loudly in an untypechecked test — it silently poisons only
the derived values that depend on it. So a probe's output splits into a correct half and an invented
half **along a line the author cannot see**, and the correct half vouches for the invented one.

**How to apply:** when a probe contradicts a rendered screen, **suspect the probe first** — the
screen has users and tests; the probe was written sixty seconds ago. Before reporting, check the
call against the signature, and prefer calling the SAME function the screen calls with the SAME
arguments the screen passes. A single agreeing number is not evidence the call is right; it is
evidence that one output does not depend on what you got wrong. Related:
[[establish-the-unit-before-counting]], [[measure-the-thing-not-a-proxy]],
[[run-the-mutation-before-relaying]], [[a-bypass-that-runs-a-narrower-check]].
