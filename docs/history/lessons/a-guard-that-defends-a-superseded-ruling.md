---
name: a-guard-that-defends-a-superseded-ruling
description: A guard written to protect a decision becomes the strongest argument against the next one — it reddens on correct work and cites the owner while doing it
metadata:
  type: feedback
---

**The code did not disagree with the owner's new rulings. The GUARDS did.**
Ward Verifier, 2026-09-06, reading seventeen fresh clinical rulings against the tree.

A test pinned a five-item clinical list to **exact members in exact order**, with a docblock
reading: _"Pinned to the EXACT members in the EXACT owner-approved order, not to a length: a length
check would pass an entry silently reworded, and these words go in front of a coordinator as fact."_

**Correct on 2026-09-03. The owner then said "add those two."**

⚠️ **So it is not a guard lagging a ruling — it is a guard DEFENDING the superseded version and
citing the owner while doing it.** Whoever adds the entries gets a red whose message _and_ whose
comment argue the correct change is a mistake, **wearing the owner's authority.**

> **A guard written to protect a decision becomes, the moment the decision changes, the strongest
> argument against the new one — because it carries rationale, a date, and an authority, and it
> fires exactly when somebody does the right thing.**

**How to apply:**

- When a fresh ruling lands, **read the guards over that area before building**, not after the red.
  List which will fire on correct work, so the builder meets them as expected rather than as
  evidence.
- **Update the expectation in the same commit as the change**, with the new ruling's date on the
  line — see [[a-test-expectation-line-is-a-ruling]].
- ⚠️ **Keep the guard's original REASONING; change only what the ruling changed.** Here the
  exact-members-in-exact-order pin survives the ruling — a length check would still pass a silently
  reworded entry. **"Fixing" the red by loosening it to a count destroys the guard**, and that is
  the repair that makes the red go away.
- **Distinguish a stale guard from a working one that is telling you to stop.** The same session met
  both within an hour: one told a builder to put a discrepancy back to the owner rather than update
  its numbers (right — the ruling had not changed), and one defended a list the owner had just
  extended (stale). **The difference is whether a ruling has arrived since.**

Companion: [[a-record-the-gate-never-consulted]], [[observations-expire]],
[[a-deferral-whose-reason-expires]].
