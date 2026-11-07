---
name: broken-and-never-worked-look-identical
description: "A check that broke and a check that never worked are the same shape — green, commented, and only a mutation tells them apart; true of prose, tests and safeguards alike"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c0c9bd3a-7216-4498-b69a-3d91db4f68d5
  modified: 2026-09-04T11:55:32.737Z
---

**A thing that went stale and a thing that was never true are indistinguishable to a reader.** Both
are present, both look deliberate, both usually carry a comment describing what they are supposed to
do. **Only suspicion finds the first kind, because staleness leaves a trail in the history and a
never-true artefact leaves none.**

**Why:** we look for decay. We check whether something has fallen behind a change. That method
cannot see an artefact that was wrong on the day it was written, because there is no change to find.

**Established across one night on Ward Flow, 2026-09-04, in three different materials:**

1. **PROSE.** Four false governance sentences. Three had gone stale against a change; one
   (`statistics-screen.tsx:379`) inferred a lifetime total from a per-call cap and **was false the
   day it was written**. The first three want "the rendered page inside the definition of the code";
   the fourth wants somebody to check the reasoning in a sentence before it ships. Different
   remedies, identical appearance.
2. **A TEST.** My own assertion, entailed by its own suite's floor — the suite selected units where
   `held > 0`, then asserted an inequality that `held > 0` guarantees. It could not fail. It read
   exactly like a guard.
3. **A SAFEGUARD.** Guards elsewhere that could not change any outcome: a `Map` whose comment
   claimed it prevented a duplicate, a length check whose first half could not fire, an age
   assertion computing an expected value and then discarding it.

> ⚠️ **The harm is never the missing check. It is a durable false all-clear** — a guard that cannot
> change an outcome READS as a safeguard, so the next person stops looking, and the comment above it
> corroborates the wrong conclusion.

**How to apply:**

1. **Mutate every new guard once before trusting it.** Break the thing it guards, watch it go red,
   restore, prove byte-identity. **None of the four instances that night was found by reading**, and
   two sat under comments that described them accurately as safeguards. See
   [[a-green-mutation-only-counts-if-the-mutant-ran]] and [[checks-that-cannot-fail]].
2. **Watch WHICH assertion goes red, not merely that one did.** Two of my tests went red for one
   edit because the broader one read a container that included the narrower one's element. Two reds
   for one cause is not a stronger signal — it hides which site moved, and the test names claimed a
   precision they did not have.
3. **When a guard's floor selects the population, check the assertion is not entailed by the
   filter.** A filter and an assertion over the same predicate is a tautology wearing the clothes of
   a guard — [[which-assertion-went-red]].
4. **Delete an unfailable check rather than repairing it quietly, and leave a note saying it was
   removed and why.** Otherwise somebody re-adds it in six weeks as an obvious missing check.

⚠️ **THE ATTRIBUTION, BECAUSE I NEARLY ACCEPTED CREDIT I HAD NOT EARNED.** A colleague put this to me
as "you found it in prose, a test and a safeguard". Checked: the prose _distinction_ is mine and the
test is mine; **the inert safeguards were other people's finds.** What is mine is the connection
between the three materials, not three discoveries. **A synthesis handed to you with your name on it
is the least-audited compliment you will get** — restate it as a claim and check it, exactly as with
[[a-correction-that-agrees-with-you]].

**And the count is the argument.** Three sessions produced this class independently on one night.
That is not three careless people; it is a property of how guards get written — which is why the
remedy is a habit (mutate on creation) rather than a rule anybody has to remember.

Related: [[green-mutation-that-changed-nothing]], [[a-guard-that-pins-the-old-wording]],
[[a-property-that-does-not-discriminate]], [[compliance-without-coverage]].
