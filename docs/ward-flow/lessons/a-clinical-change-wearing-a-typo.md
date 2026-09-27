---
name: a-clinical-change-wearing-a-typo
description: "A comparison against a string the type union does not contain is a DECISION until proven otherwise — the Ward Flow instance is now resolved, but the rule that found it stands"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2d57ae3e-f800-40ce-8184-f96d852a4bbe
  modified: 2026-09-20T15:38:21.423Z
---

## The general rule, which is the durable part

🔴 **In this codebase, a comparison against a string literal that the type union does not contain is
a DECISION, not a slip, until proven otherwise.** It cannot be true, so it is dead code with a live
meaning: the expression already reduces to its other operand, and "correcting" the string does not
restore intent — it **selects a different population**. Look for a ruling before touching one.

⚠️ **A cast that hides the comparison from the compiler is the tell that somebody meant it.** A real
typo reddens the build; this one had `as unknown as string` around it.

## The Ward Flow instance — RESOLVED 2026-09-20, no longer a hazard

`ward-derivations.ts`, `shortlistCandidates`, compared `movement.legalStatus` against `"Involuntary"`
— not a member of `LegalStatus` (`Voluntary`, `Referred for psychiatric examination`,
`Detained awaiting examination`, `Involuntary inpatient`). It therefore meant
`security === "Secure"` and nothing else, matching **Josh's 2026-09-18 ruling: no catchment-priority
ordering for detained patients "for now"**, reaffirmed 2026-09-19 after a build changed it and it was
returned. Spelling it correctly would have turned the ordering ON for involuntary inpatients and OFF
for a patient detained awaiting examination in a secure unit.

✅ **Josh asked for the bait removed on 2026-09-20 and it is gone** (`1cfc6f4582`). The dead
comparison and its cast were deleted, behaviour unchanged, the flag renamed
`catchmentPriorityApplies`, and the ruling is now guarded by
`tests/ward-shortlist-candidates.test.ts` — "catchment-priority ordering" — which reddens on two
assertions if the comparison is ever reinstated. **Proved by mutation, not assumed.**

⚠️ **So do not restore the old line, and do not read the earlier "do not fix line 931" instruction as
current** — it protected a ruling that a test now protects better. The question to bring back, if the
ordering is ever wanted for a legal status, is WHICH STATUSES.

## What made it dangerous, and what replaced that

**A comment asking people not to make a change is not a check.** Two sessions read the comment and
"fixed" it anyway, and one of those fixes also cleared the last of ten typecheck errors, which made
it look even more correct. The fix was to remove the thing that invited the edit, not to warn harder.

Related: [[a-comment-that-asserts-an-absent-guard]], [[a-guard-that-defends-a-superseded-ruling]],
[[a-test-expectation-line-is-a-ruling]], [[judgement-is-overridable-a-fact-is-not]],
[[a-cast-plus-a-runner-that-does-not-typecheck]], [[the-suite-never-tests-the-absence]].
