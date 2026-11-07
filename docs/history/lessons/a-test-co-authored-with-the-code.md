---
name: a-test-co-authored-with-the-code
description: "A test written from the same understanding as the code asserts the half the author remembered; it stands guard over the omission it shares"
metadata:
  type: feedback
---

`RECORD_EXAMINATION` in the ward reducer gives a bed back without deleting the Admission —
the "phantom occupant" its sibling `RELEASE_PULL` was fixed for on 2026-09-01. The fix was
half-ported: the capacity consequence, not the admission consequence.

**A test already covered that transition.** `tests/ward-flow-reducer.test.ts:695` asserts
`allocatable.value` after `RECORD_EXAMINATION` — and never looks at `state.admissions`.

**Why:** the test asserts exactly the consequence its author had in mind while writing the
code. It is not a weak test; against the half it covers it is exact. But a test drawn from
the same mental model as the implementation **inherits that model's omissions and then
certifies them**. Green here never meant "the transition is correct" — it meant "the part
the author thought about still works". The test had been standing guard over the defect
since it was written.

⚠️ **This is worse than no test, for the same reason a written diagnosis is worse than no
comment:** the next reader sees the transition IS covered and moves on.

**How to apply:** when a fix is ported from a sibling, do not ask "is the new site tested?"
Ask **"does the test assert every consequence the SIBLING's fix produced?"** Diff the
consequences, not the coverage. Here that is two lines: capacity changed, admission removed;
the test had one.

And when a claim about a transition cannot be settled by reading — because there is no guard
to read, the check is simply absent — that absence is the answer. **Reading found nothing
because there was nothing; executing found the state in one dispatch.**

Related: [[the-suite-never-tests-the-absence]], [[a-written-diagnosis-does-not-sweep]],
[[run-the-mutation-before-relaying]], [[fields-with-no-producer]].
