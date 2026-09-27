---
name: not-an-ancestor-is-not-unfolded-work
description: 'An ancestry check proves a branch is not merged; it says nothing about which side is newer, so a "recover the unfolded work" fold can silently regress a later owner ruling.'
metadata:
  node_type: memory
  type: feedback
  originSessionId: 13c6e0ab-aac1-4d38-bec5-622e555c2b64
  modified: 2026-09-06T21:50:36.860Z
---

**`git merge-base --is-ancestor` answers "is this merged", never "does this hold work we are
missing".** A branch can fail the ancestry test because it is _behind_ — superseded, with the master
line having grown past it — and that looks identical to a branch that is _ahead_.

**The measured instance, 2026-09-07.** A peer correctly reported `codex/ward-management-design` as
unfolded, holding five targeted commits on `ward-priority.ts` including _"define the operational
score with no urgency component"_. I nearly treated it as work to recover. The reverse direction:

    git log --oneline HEAD..<branch> -- <path>     5 commits   (what they have)
    git log --oneline <branch>..HEAD -- <path>     7 commits   (what I have)  <- nobody ran this

One of my seven was `bc7cb70fb`, _"A patient can be flagged urgent, and the flag outranks
everything"_, carrying the owner verbatim from **2026-08-30 — six days after that branch last
moved**. Folding it would have deleted 122 lines and taken the urgency component back out, undoing
a ruling. Corroborating cheap signals: `urgency` mentions 28 on my line versus 3 on theirs, and a
`--stat` whose deletions dwarf its insertions.

**Before folding or "recovering" any branch, run all four:** ancestry, `HEAD..branch`,
`branch..HEAD`, and the branch's last commit **date** against the date of the rulings in the area.

⚠️ **A specific trap: a commit message describing a defect ("drop the fabricated deadline") reads as
a fix we are missing.** It is equally consistent with a defect that was fixed a different way
later — which is what had happened. Check whether the defect exists on the current line before
crediting the branch with its cure.

Related: [[differs-is-not-owns]], [[a-guard-that-defends-a-superseded-ruling]],
[[observations-expire]], [[a-merge-of-a-branch-name-is-a-claim-about-a-moving-target]],
[[ward-flow-branches-off-the-ward-line]].

---

## 2026-09-09 — second instance, and the mechanism is sharper: the file was deleted BY NAME

**Ward Flow.** `claude/Wardquestions` carries a ward route file that the master line does not have.
On non-ancestry alone that reads as _unfolded work to be brought across_. It is the opposite:

    e810ef5895  "remove the old /patients/[patientId] route now that it lives at
                 /movements/[movementId]"

**The master line does not lack that file. It DELETED it, deliberately, and said so in the commit
subject.** Folding on "the branch has something we don't" would have silently resurrected a route
the owner's own restructuring removed.

🔴 **AND NO GATE WOULD HAVE GONE RED.** A resurrected route compiles, renders, and is reachable. The
reachability guard fires on routes pointing at nothing, not on a route that should no longer exist.
**Only the commit message knows, and only if somebody reads it.**

> **A file present on one side and absent on the other is not evidence of direction.** Before folding
> anything on non-ancestry, ask git which side ACTED: `git log --diff-filter=D -- <path>` on the side
> that lacks it. A deletion is an action with an author and a reason; an absence is not.

Recorded in `docs/ward-flow/archive/dated-notes/fold-completion-2026-09-09.md` at `0c64439b90`.
