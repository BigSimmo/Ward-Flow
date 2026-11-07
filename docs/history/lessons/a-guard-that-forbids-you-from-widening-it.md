---
name: a-guard-that-forbids-you-from-widening-it
description: "A guard whose failure message names who must decide, not what to change — and the trap of arriving at a defensible conclusion BEFORE it runs, so its verdict reads as an obstacle to argue past rather than a question you are not the one to answer"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 375480d8-c65a-4a85-9c03-411b49e19410
  modified: 2026-09-11T06:51:28.464Z
---

Ward Flow, 2026-09-11. I built a sentence telling a coordinator that a referral for this person is
already open. Before any gate ran I had assembled a genuinely good argument that it was safe:
**FD-23 is ward-facing only; the ruling says the coordinator sees everything; the screen already
holds unprojected referrals; my sentence names no destination.** Every clause of that was true and
checked.

Then `ward-patient-link-default-deny.test.ts` went red, and its message did not say what to change:

> _a ward-management file outside the D-14 allowlist reads `.patientId` …_ **Hand this back to Ward
> Lead rather than deciding it is fine and widening the allowlist yourself.**

🔴 **Having the argument ready first is what makes this dangerous.** The allowlist was one line away
and I could have written a defensible reason beside it. **The guard does not exist because my
reasoning was bad — it exists because a privacy boundary must not move on the reasoning of whoever
happens to be touching it that day**, however good. A guard that names WHO decides is enforcing a
procedure, and arguing with it on the merits is the failure mode it was written for.

⚠️ **Then reading the guard's own reasoning showed my conclusion was ALSO wrong.** Its allowlisted
entries are permitted at a stated granularity — _"one person's own single linked referral, never a
history across several."_ My function filtered **across several** of one person's referrals. **The
distinction the allowlist is actually built on was the one my argument had never considered**, and I
would not have found it by arguing, only by reading.

**The habits worth keeping:**

- **When a failure message names a person or a role, that is the finding.** Stop and route it.
  Do not compose the justification; you are not the one the message is addressed to.
- **Read the guard's rationale, not just its verdict.** It usually states the property, and the
  property is sharper than the check. Mine named a granularity I had not thought about.
- **Revert rather than hand over a red gate.** Commit the work first so it is recoverable by name,
  then revert, then say in one line how to restore it. A branch handed over green with a named
  blocked task is worth more than one handed over red with a good explanation.
- ⚠️ **Notice when you reached the conclusion BEFORE the check ran.** That ordering is the tell. A
  conclusion formed in advance turns every subsequent gate into an obstacle to get past.

Related: [[a-correction-that-agrees-with-you]], [[arguing-for-your-own-file]],
[[read-what-the-guard-reports-not-its-source]], [[a-guard-that-blocks-its-own-purpose]],
[[judgement-is-overridable-a-fact-is-not]], [[a-folds-cost-is-the-union-of-both-red-gates]].
