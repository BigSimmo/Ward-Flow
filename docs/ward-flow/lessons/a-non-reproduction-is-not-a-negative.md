---
name: a-non-reproduction-is-not-a-negative
description: "A failed reproduction only counts as evidence when the attempt could have succeeded — and an expiry rule keyed on 'it did not recur' retires exactly the load-dependent faults that hide"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 78a1f8ba-8ebd-47af-9e6c-674b54499d41
  modified: 2026-09-07T06:33:54.009Z
---

**A non-reproduction is evidence only if the attempt was capable of reproducing.** Otherwise it is a
**null** measurement, and counting nulls as negatives is how a hiding defect gets retired.

Measured 2026-09-07, Ward Flow. `ward-mutation-harness-reachable.test.ts` failed once inside a
340-file run and passed in isolation. I wrote an expiry rule: _"retire it if it does not recur on the
next full-suite run."_ Ward Builder Two killed it in one sentence:

> _"If the expiry rule keys on 'fails only under load, passes alone', it will retire this one every
> time — and the thing it is measuring is specifically a load-dependent inability to measure."_

🔴 **The rule was self-defeating and I had written the counter-argument myself, in an earlier message,
and then applied the rule anyway.** _"A green re-run under lighter load is exactly what a
load-dependent defect produces"_ — my words, one message before I used quiet-machine greens as
evidence of absence.

## And the reproduction attempt was aimed at the wrong pressure

Thirteen attempts caught nothing: three full-suite runs, then the target run standalone against one
and then **two** concurrent suite runs. All green. **I was loading the CPU.** The real trigger was
**import pressure** — the observed failure came from a 40-file batch with `import 40.56s` against
`tests 96.24s`. Truncated subprocess stdout, not contention for cycles.

**So all thirteen were nulls.** They looked like a mounting body of negative evidence and were not
evidence at all.

**How to apply:**

1. **Before treating a failed reproduction as a negative, name the mechanism you were stressing and
   check it is the one the defect needs.** CPU saturation, memory pressure, import/IO pressure,
   filesystem contention and wall-clock timing are different stressors and do not substitute.
2. **An expiry condition must not key on the defect's own signature.** "Retire if it does not recur"
   is fine for a fault with no pattern; it is exactly wrong for one whose pattern is _appears only
   under a condition your retirement test does not create_.
3. **Count attempts by shape, not by number.** Thirteen runs of one shape is one attempt repeated,
   and reporting it as thirteen overstates the evidence to yourself first.
4. ⚠️ **The tell is a rule that would produce the same verdict whether or not the defect is real.**
   Same family as [[checks-that-cannot-fail]] — applied to a retirement decision instead of an
   assertion.

Related: [[a-clean-negative-that-measured-nothing]], [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[a-correct-diagnosis-that-stops-the-inquiry]], [[a-deferral-whose-reason-expires]].
