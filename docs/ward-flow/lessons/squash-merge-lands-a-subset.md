---
name: squash-merge-lands-a-subset
description: 'A squash merge can land fewer files than you pushed while the PR still reads "Merged" — compare file lists, never the status word'
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1fec1161-6bde-4b04-9e73-54ef357db15f
  modified: 2026-09-01T08:31:52.067Z
---

PR #2382 merged. Its branch tip `55ae321fe` changed three files; the squashed commit on `main`
(`02bcdde4e`) changed three **different** files. The handoff document landed; a queued
outstanding-issues request and its snapshot did not, and a review record appeared that the branch
never had. The request exists on `main` in neither its pending nor its `applied/` location.

**Why:** the PR status word reports that _a_ commit merged, not that _your content_ merged.
Between push and merge, a squash can be resolved against concurrently-landed work, or the PR
edited, and the difference is invisible from the PR page and from `gh pr view`.

**How to apply:** after any squash merge, prove the content landed rather than reading "Merged".

```
git show --stat <squash-sha>
git diff --stat $(git merge-base <branch-tip> origin/main) <branch-tip>
```

Compare the two file lists by name. For a file expected to move (an inbox request moving to
`applied/`), check both locations before calling it lost — and check by name, not by count
([[agreeing-checks-with-one-blind-spot]]). The repo's `prlanded` skill exists for exactly this.

This is the same failure family as [[ledger-rows-lag-reality]] and
[[assert-only-about-code-you-opened]]: a status that is true about something adjacent to the thing
you actually care about. Related: [[observations-expire]], [[self-invalidating-pins]].

## "0 unfolded" is equally consistent with your work having been REPLACED — 2026-09-06

Two of us checked the same fold on the same night, both by content rather than by the merge message,
and **both found a file that differed.**

    mine    7 files compared blob-to-blob; 6 identical, 1 DIFFERENT
    peer's  `git rev-list --count` said 0 unfolded; the blob still differed

**Both differences turned out to be additions on top of our work, not losses.** But neither of us
could have known that from the count. **A commit-count of zero says your commits are reachable; it
says nothing about whether the file's contents survived** — and on a rebuilt publication branch the
count is meaningless anyway.

**The check that answers it:** `git rev-parse <ref>:<path>` on both sides and compare the blob, then
diff the two if they differ. Cheap, and it distinguishes the three outcomes a merge message flattens
into one word: intact, added-to, replaced.

**2026-09-06 — the inverse error, and it reads as catastrophe rather than as success.**
`git merge-base --is-ancestor <my-commit> <their-head>` returned false for **all 25** of my commits
after a colleague folded my branch — including ones whose content was demonstrably at their head.
A squash fold lands the content and discards the commits, so **containment is guaranteed to say you
lost everything.** The two wrong methods fail in opposite directions: the word "folded" says you lost
nothing, `is-ancestor` says you lost it all, and neither looked at a file.

**What actually answered it, in two steps.** First compare the blob per file
(`git rev-parse HEAD:<path>` vs `git rev-parse <their-head>:<path>`). Then — and this is the step
that is easy to skip — for any file that legitimately DIFFERS because their line carries other
people's work too, grep their version for **your specific property**, not for the file's sameness.
`delays-screen.tsx` differed and still contained both of my changes; calling that a loss would have
been as wrong as calling the identical files a success without looking.

**A blob comparison answers "is this file the same". Only a property grep answers "is my change in
there", and on a shared file those are different questions.**
