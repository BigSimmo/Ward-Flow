---
name: a-cast-plus-a-runner-that-does-not-typecheck
description: "An `as` cast plus a test runner that never typechecks makes a MALFORMED event indistinguishable from a correct one — and the test goes green by falling into the right branch for the wrong reason"
metadata:
  node_type: memory
  type: feedback
---

2026-09-04, Ward Flow. A test dispatched `RECORD_EXAMINATION` with `admissionNeeded: false`.
**That is not a field of that event** — the real one is `outcome: "inpatient_order" | "community_order"
| "revoked"`. `as WardFlowEvent` silenced tsc, and **vitest runs no tsc**.

🔴 **AND IT PASSED.** `outcome` arrived `undefined`, missed the `=== "inpatient_order"` branch, and
fell into the closing branch **by accident**. The movement closed, the assertion on `closure` held,
green. **It exercised the right path for the wrong reason and never dispatched the event its own
comment described.** Two people wrote this same defect independently within six hours.

> **A cast plus a runner that does not typecheck makes a malformed event indistinguishable from a
> correct one.** Neither half is dangerous alone. Together they remove the only check there was.

## The repair is to delete the cast, not to fix the field

Six of seven casts in the file were simply removable — pure risk, no benefit. **The seventh existed
for a real reason and that reason was itself the defect:** the action was typed
`WardFlowEvent["type"]`, the whole 40-member union, which cannot narrow, so the generic dispatch
needed a cast _to compile at all_.

```ts
type OfficerEvent = Extract<WardFlowEvent, { type: "TRANSPORT_ACCEPTED" | … }>;
const event: OfficerEvent = { type: action, role: "officer", now, movementId };
```

⚠️ **A cast that is load-bearing is a signal the TYPE is too wide, not that the cast is needed.**

**Prove the repair, not just that it compiles:** put the malformed field back and confirm tsc now
names it (`TS2353 … 'admissionNeeded' does not exist in type …`). A repair that merely compiles is
untested.

## 🔴 CHANGING THE DRIVER INVALIDATES THE PROOF OF THE THING IT DRIVES

The corrected event is a different input, so **every mutation proof that ran through the old one is
void.** Re-run them. Mine still went red naming the defect — but I did not know that until I ran it
again, and "it passed before" was not evidence about the new driver.

Related: [[the-suite-never-tests-the-absence]] (vitest runs no tsc, so a type-only requirement is
already optional), [[a-green-mutation-only-counts-if-the-mutant-ran]],
[[a-guarantee-that-holds-one-direction]], [[a-bypass-that-runs-a-narrower-check]].

## Recurred 2026-09-07 as a WHOLE TEAM'S GREEN, which is the expensive version

Ward Lead ran a roll call declaring the ward line green: _"331 files, 3869 passed, 0 failed."_ It was
a true statement about vitest. **`tsc --noEmit` was red on that same line the entire time** —
`tests/ward-length-of-stay-population.dom.test.tsx` cast a fixture with `sex: "female"` where `SEXES`
is `["Female", "Male"]`. Found only because merging that line into another branch ran a typecheck
that nobody had run there.

⚠️ **The tell is the sentence, not the code.** "The suite is green" was read — by its author, by me,
and by the owner it was written for — as "the tree is sound". Same shape as two of my own defects the
same night: a token guard asking "declared somewhere" read as "resolves here", and a count test
computing its expectation by calling the function under test. **Three checks, three summaries wider
than the check.**

**How to apply:**

1. **`npx tsc --noEmit -p tsconfig.json` belongs beside the suite in any statement that a line is
   green**, and it is one command and a couple of minutes. A suite result alone should be reported as
   _"the suite is green"_, never as _"it is green"_.
2. **A merge is a typecheck of the other branch.** If a fold surfaces a type error in a file the merge
   did not touch, **attribute it before fixing it**: `git cat-file -e <base>:<path>` and
   `diff <(git show <theirs>:<path>) <path>`. Identical + absent from your side means it was already
   red on theirs, which is a finding about their gate, not about your merge.
3. **Say the finding back to the branch that owns it.** Fixing it silently leaves the gap that
   produced it open, and the gap is worth more than the fix.

Related: [[a-summary-line-over-a-broken-run]], [[a-measurement-is-scoped-to-what-it-measured]],
[[declared-somewhere-is-not-resolvable-here]], [[a-baseline-from-the-subject-vouches-for-it]].
