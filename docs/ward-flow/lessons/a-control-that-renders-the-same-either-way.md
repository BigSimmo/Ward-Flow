---
name: a-control-that-renders-the-same-either-way
description: "A controlled <select> holding an invalid value renders its FIRST option, so it looks exactly like 'nothing chosen' — the rendering is identical in the healthy and the defective case, and a mutation deleting the validation survived all 16 tests"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 375480d8-c65a-4a85-9c03-411b49e19410
  modified: 2026-09-11T13:23:37.912Z
---

**A controlled `<select>` whose `value` matches none of its `<option>`s renders its FIRST option.**
Ward Flow lane C, 2026-09-11, task 14: the intake form's first option is the "unanswered"
placeholder, so an unvalidated `?source=gp` — a value the model cannot hold — rendered as
_"Choose one"_, which is precisely what a correctly-rejected value renders as.

🔴 **THE MUTANT RAN AND SURVIVED.** Deleting the `REFERRAL_SOURCES.includes(...)` membership check
entirely left **all sixteen cases green**, including the four written specifically to prove the
rejection. After moving the assertion, the identical mutant gave **3 failed | 13 passed**.

⚠️ **The defect the test was blind to is worse than "no validation".** The draft still held `gp`,
invisibly — so the form showed a safe empty state, carried the bad value into the submission, and
the reducer refused it, leaving the referrer staring at a rejection naming a source they never
chose and could not see on the form.

## The shape, stated generally

**An assertion about what is RENDERED, used as evidence about what the component's STATE holds.**
The two coincide in the healthy case and diverge in exactly the defective case, so the assertion is
green either way. Other members of the same family:

- A `<select>` falling back to its first option (this one).
- An input whose invalid value is formatted away on display.
- A control disabled for one reason being read as proof of a different reason.
- Any placeholder that doubles as the empty state — **the mask and the correct answer are the same
  pixels.**

## 🔴 Two assertions are not two kinds of evidence when both read the rendering

Measured the same day, in the same file, by a sweep of all 154 ward DOM test files (1480 cases;
only 16 used a rendered-value matcher at all). **I fixed the masking for one field and left its two
siblings untouched in the file carrying my own comment explaining the mechanism.** The worse of the
two had TWO assertions and the defect satisfied both:

    a slip writing teamId into the origin-site slot sets the draft to "CT-07"
      → not a member of the option list, so the select renders unanswered   (assertion 1 green)
      → nothing then DISPLAYS the string, so queryByDisplayValue finds none (assertion 2 green)

⚠️ **The second assertion felt like corroboration and was the same witness.** Count KINDS of
evidence, not assertions.

✅ **And the exposure is worth measuring before the alarm is raised.** An enumeration of all 47
`<select>` elements in that module found every one controlled and only TWO taking a value from
outside the component — both already fixed. **The mechanism is general; the exposure was not.**

## How to apply

- **Assert on something computed from the state, not from the control.** Here the working assertion
  was the Send button's own unavailability reason, which is derived from `fieldIsUnanswered` over
  the draft. It cannot be satisfied by a rendering fallback.
- **Ask of every render assertion: what ELSE renders this way?** If a defect renders identically to
  correctness, the assertion is decorative. This is the cheap version of the check and it would have
  caught it before the mutation did.
- ⚠️ **A boundary case that cannot discriminate is not a failure of the test — but do not count it as
  proof.** `source=""` stayed green under the mutant, correctly: an empty string is unanswered under
  both versions. Keep it, label it, and never count it among the cases that killed the mutant.
- **The placeholder-first pattern is worth enumerating across a codebase, not fixed once.** Any
  control whose value can arrive from OUTSIDE the component — a URL parameter, a prop, restored
  state — can hold something its own options never offered.

Related: [[tests-that-assert-rendering-not-truth]],
[[a-green-mutation-only-counts-if-the-mutant-ran]], [[a-property-whose-operands-can-coincide]],
[[an-absence-promoted-to-a-headline]], [[the-suite-never-tests-the-absence]].
