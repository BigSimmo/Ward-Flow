---
name: identical-work-produces-no-conflict
description: "duplicated effort is invisible by construction — git keeps both copies or neither complains; compare blobs, and the odd file out is the finding"
metadata:
  type: feedback
---

**Consolidated 2026-09-06 from 2 separate memories on one subject**, written from different chairs across a night of six parallel sessions.

⚠️ **Nothing is summarised — each section below is its original entry verbatim.** The merge exists because the index
that points at these has a hard size limit: 2 index lines for one subject crowd out 1 unrelated
memories, which then do not load at all. The only thing given up is recalling one of these without the others.

---

# identical-work-produces-no-conflict

> Two sessions doing the same rename converge to identical bytes, which no merge tool can report — and the ONE file that differs is where the defect is

2026-09-04, Ward Flow. Two sessions independently derived the same class rename and applied it to the
same four files. **The blobs are byte-identical** — `dce2f3e80`, `a23d317b5`, `ebecfb3d4`, `cf3510b55`.

> ⚠️ **No merge tool will ever report this. Identical content produces no conflict, so duplicated
> effort is invisible BY CONSTRUCTION** — the cleaner the duplication, the more silent it is.

**Detect it by comparing blob hashes across branches**, never by merging:
`git rev-parse <branch>:<path>` on each side and compare. It costs one line per file.

## 🔴 THE FILE THAT DIFFERS IS THE FINDING

Of five files reported as identical, four were and one was not. **The outlier is where the
information is**, and it inverted the conclusion from "wasteful duplication" to "the other branch's
rename is incomplete":

```
their register  3 remaining `styles.field}`      their screens  0 `field}`, 22 `fieldName`
base            10                                mine changed all 10, theirs 7 of 10
```

Those three are **locators a test resolves against the screen** (`countOccurrences(surface, rendered)`),
so they should be RED over there. ⚠️ **Predicted, not run** — executing another session's branch means
checking it out, which is not mine to do. Say which it is.

**And check who the merge favours before raising an alarm.** `git merge-tree` reported no conflict on
that file: the other side left those lines at their base value and I changed them, so the merge takes
the repair. Nothing to do. **A finding about a fold is only actionable once you know which side wins.**

## The companion: test every PAIR, not every branch against the trunk

    A <-> B   2 conflicts        A <-> M   1 conflict        B <-> M   1 conflict (a different file)

⚠️ **One file conflicted A↔B while merging cleanly against M from both sides.** A fold that validates
each branch against the trunk in turn **never sees it**. And a file that conflicts with two others may
still be one side against a consensus the other two already share — which decides who resolves it, and
in which direction. `git merge-tree --write-tree` on all three pairs, not on two.

## Why it was undetectable at all

The document that should have prevented it — the adoption playbook, recording which screens are done
onto which names — **exists on one branch only** (verified absent from four others). ⚠️ **A plan that
lives on one branch cannot record what the other branches did.** That is the cause; the duplication is
the symptom. Do not "fix" it by copying the file around.

Related: [[squash-merge-lands-a-subset]], [[a-folds-cost-is-the-union-of-both-red-gates]],
[[publication-branch-overwrites-remote-fixes]], [[parallel-chats-and-cross-chat-sync]].

---

**2026-09-06 — the same thing again, and TWO new edges worth more than the duplication itself.**
The coordinator handed census §8 to two builders. Mine landed first; the other builder's version was
structurally better (a shared `countCellText` all three columns route through, rather than three
spellings fixed one by one) and went in on top.

**Edge 1 — the duplicate looked like MY OWN work by construction.** I had written census §8 hours
earlier. Being asked to fix §8 read as continuity, not as a fresh assignment, so nothing about it
felt claimable by anyone else. **"I wrote the thing this task refers to" is the strongest possible
false signal of ownership**, and no amount of care from me would have caught it — only the
coordinator's own register could.

**Edge 2, and this is the transferable one — a MERGE CAN SILENTLY REVERT A RULING.** Three separate
decisions landed in the same five files within hours. Some of the affected assertions were not new
cases but **changed EXPECTATIONS inside existing ones** — `toHaveTextContent("0")` becoming
`("none")`, an equality's expected value flipping. **In a merge those look like ordinary line edits.**
Taking the other parent's version reverts the decision, and everything stays green, because the
assertion moved back with the code.

**How to apply when reconciling two branches that touched the same tests:** enumerate, per commit,
which assertion belongs to which DECISION — a file-level or even case-level view is not enough when
several rulings share a file. **Diff the case NAMES, never the counts** (a re-pointed case leaves the
count unchanged while the claim moves). And hand the other party the list unasked: the mapping from
line to ruling exists only in the head of whoever made the change, and it is invisible in the diff
they are about to resolve. Related: [[a-guard-that-pins-the-old-wording]],
[[squash-merge-lands-a-subset]].

---

# identical-work-merges-without-conflict

> Two sessions adding the same helper produce no merge conflict — git keeps both copies, and only the typechecker sees it

Ward Flow merge, 2026-09-04. Both sides had independently added the same `referral()` factory to
`tests/ward-eligibility.test.ts`. **Git reported no conflict.** It combined both additions, leaving
two implementations of one function, and only `tsc` caught it — as a duplicate implementation, well
after the merge was called clean.

**Why:** a conflict requires the same region to be changed DIFFERENTLY. Two sessions adding
equivalent code to different parts of a file are, to git, two compatible additions. **The more
alike the work, the less likely it is to conflict.**

⚠️ **This is the same reason a defect patched independently on four branches produced zero merge
signal all night: disjoint file sets, nobody editing the same lines, so `merge-tree` stayed quiet
and every session believed it had fixed "the" defect.** Convergent effort is invisible to the tool
we use to detect collisions.

**How to apply:** after any fold between sessions that may have worked on the same problem, run the
typechecker and the suite — a clean merge is not evidence of a coherent tree. And when several
sessions are told to fix one class of defect, expect duplication rather than conflict, and check for
it by symbol name rather than by diff.

Related: [[a-folds-cost-is-the-union-of-both-red-gates]], [[squash-merge-lands-a-subset]],
[[publication-branch-overwrites-remote-fixes]], [[compliance-without-coverage]].

---

**2026-09-07 — THE WORST EDGE YET, AND `tsc` DOES NOT CATCH THIS ONE.** Two sessions fixed the same
guard defect _differently_: master blanked comments across every `.ts/.tsx/.css` file; the peer used
the canonical helper scoped to `.css` only, because the wide version swallows real code. **`git
merge-tree` predicted no conflict, and the auto-merge kept BOTH** — the peer's scoped `readable()`
four lines above master's whole-file blanker, which was still the one actually applied.

🔴 **The result compiled, the suite was 48/48 green, and the guard was blind.** Unlike the
duplicate-helper case above, there is no second implementation for the typechecker to object to —
just a dead one and a live one, both syntactically fine. **The only thing that found it was
injecting the defect the guard exists to catch:** the same undeclared token gave `48 passed` under
the merged blanker and `1 FAILED` under the peer's.

⚠️ **AND THE HYBRID IS WORSE THAN EITHER PARENT, WHICH IS THE PART TO REMEMBER.** The peer's long,
accurate, measured comment explaining why the scope was narrowed came through the merge intact and
now sat directly over the wide blanker that ignored it. **A fluent correct rationale standing over
live broken code is harder to catch than broken code alone** — the reader's question ("is this
right?") is answered by the comment before they reach the line.

**How to apply.** When two branches fixed _the same defect_, a clean merge is a red flag, not a
green one — **a conflict would have been the safe outcome, because a conflict asks somebody.** Do not
let `merge-tree`'s silence end the check. Instead: (1) `--no-commit`, (2) grep the merged file for
both sides' identifiers and confirm only one survives, (3) **re-inject the original defect and prove
the merged result still fails.** Nothing cheaper than step 3 distinguishes a real fix from a fix
whose call site was merged away.

Related: [[a-test-expectation-line-is-a-ruling]], [[a-comment-can-satisfy-a-guard]],
[[a-green-mutation-only-counts-if-the-mutant-ran]], [[a-fix-that-states-a-falsehood-more-confidently]].

## 🔴 PARTITIONING THE WRONG DIMENSION: I split the work by TEST file; the collision surface was the COMPONENTS. 2026-09-09.

I dispatched three chats across 22 test files, carefully arranged so no two shared a file —
because the pre-commit hook deadlocks two chats in one tree. **The partition was irrelevant.**

Ward Builder Two: _"This work mutates PRODUCTION COMPONENTS, not test files. Test-file ownership does
not describe the collision surface at all."_ Each arm edits a real sentence in a real component,
runs, and restores it. So the surface is the thirteen components they transiently mutate — and
three of those are shared:

    ward-derivations.ts           referenced by 59 files under ward-management
    ward-eligibility.ts           referenced by 19
    ward-management-console.tsx   referenced by 3

⚠️ **So an overlap does not require overlapping test files at all.** Two chats with a
perfect, disjoint test-file partition still collide in `ward-derivations.ts`, and when they do
[[restoring-a-mutated-file]] applies: both restore a pristine copy, both trees end clean, no
conflict, no red, no trace — and whichever run straddled the other's mutation silently measured
the wrong component.

**How to apply.** Before partitioning work between chats, ask **what does this task WRITE TO**, not
what it is _about_. A task named after test files can be owned entirely by the source tree:

- mutation/arm work → the components mutated, including shared helpers
- snapshot or fixture work → the fixture, which many suites share
- codemod/rename → every importer

🔴 **The tell that I had the wrong dimension: my partition was effortless.** Splitting 22 test
files three ways was arithmetic. **A partition that costs nothing to draw is usually drawn on the
wrong axis** — the real surface here was thirteen files deep in a shared tree and would have been
visibly hard. See [[a-measurement-is-scoped-to-what-it-measured]] for the same shape in claims.
