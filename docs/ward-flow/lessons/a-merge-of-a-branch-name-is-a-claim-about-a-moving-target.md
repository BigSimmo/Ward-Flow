---
name: a-merge-of-a-branch-name-is-a-claim-about-a-moving-target
description: "A fold message asserting a peer's finding can be false on arrival, because merging a branch takes whatever its tip is at that instant"
metadata:
  node_type: memory
  type: feedback
  originSessionId: b1ace96a-832b-4e38-9f46-6c2896334ea0
  modified: 2026-09-04T10:14:07.273Z
---

2026-09-04. I reported a provenance verdict as INFERRED, then measured further, weakened it to
UNTRACEABLE, and committed the correction on my branch. The integrator had already merged — by
branch NAME, at the moment its tip happened to be — and the fold commit's own message asserted the
stronger word.

**The merge took a tip that had moved while the message was being written.** So a commit message
recorded a verdict its own successor withdrew, and neither party did anything careless.

⚠️ **A fold message is a CLAIM. A claim made from a branch name is a claim about a moving target.**
Merging `<branch>` and writing prose about what it contains are two operations separated by however
long the prose takes, and a peer's branch is exactly the thing that moves in that window.

⚠️ **IT HAPPENED AGAIN THE SAME DAY, AFTER THIS WAS WRITTEN.** A second fold
(`b5c395082`) took four of my five commits and missed the fifth — the one adding the census's
measured-at line and the note that another branch's rename supersedes one of its rows. So the landed
copy of a document whose FIRST SECTION warns that a census without a date reads as complete… has no
date on it. **Naming the trap did not prevent the trap.** Detected by
`git merge-base --is-ancestor <each sha> <fold>` per commit, and confirmed independently by grepping
the folded file for a string only the missing commit adds — two methods, because a single
ancestor check answers a question about commits, not about content.

**How to apply:**

- When folding a peer's work and describing its findings, merge a NAMED COMMIT, and quote that SHA
  in the message. `git merge <sha>` says what you actually took.
- Before writing prose about what a branch concluded, re-read its tip — the conclusion is the thing
  most likely to have been refined, because a peer who is still working is a peer still checking.
- When you correct your own finding, say so to the integrator FIRST and name the commit, before
  extending the correction anywhere else. I sent the correction after committing it; a minute
  earlier would have been ahead of the fold.

**And the repair was right: mark the earlier commit SUPERSEDED, do not amend it.** An amended history
makes the mistake unfindable, and here the mistake is the useful part — it is the only record that
the two verdicts were ever different, which is what tells a later reader the question was
re-examined rather than merely answered.

Related: [[observations-expire]], [[squash-merge-lands-a-subset]], [[relayed-numbers-lose-attribution]],
[[a-humble-conclusion-is-under-audited]], [[verify-in-head-not-the-working-tree]].
