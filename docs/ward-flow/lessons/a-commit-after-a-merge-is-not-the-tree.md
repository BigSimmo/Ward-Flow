---
name: a-commit-after-a-merge-is-not-the-tree
description: "After `git merge --no-commit`, a bare `git commit` commits the MERGE'S INDEX — any edit you made after the merge is silently left behind, and a green test run vouches for the tree rather than the commit"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c186bff2-76e5-4e1f-b211-8b26b7fbdcab
  modified: 2026-09-11T06:14:42.580Z
---

Ward Flow, 2026-09-11. Twice in one day.

    git merge --no-ff --no-commit <branch>
    <edit a file to fix what the merge exposed>     <- working tree only, never staged
    git commit -F msg.txt                           <- commits the MERGE'S INDEX. Edit NOT in it.

**The commit message asserted the fix. The commit did not contain it. The line stayed red on the
exact assertion the message quoted as closed.**

🔴 **And the verification was honest about the wrong object.** The suite ran 4453 passed / 0 failed
— **against the working tree, which had the fix.** The tree was green; **the commit was not the
tree.**

## Why the second one survived and the first did not

**First instance:** caught, because `git status` still listed the file afterwards and I looked.
**Second instance:** not caught, because the suite had just gone green and I stopped checking.

⚠️ **A green run makes the next check feel unnecessary. That is precisely the moment the orphan
survives.** Found hours later by a peer who synced to the folded head and got back the identical
failure I had reported as fixed.

## How to apply

**After ANY `merge --no-commit` in which you edit anything: run `git status` BEFORE committing, and
name the paths explicitly in the commit.** A bare `git commit` after a merge is a commit _of the
merge_, not _of the tree_.

**And when you report a fix, say which object you verified.** "The suite is green" is a claim about
a working tree. Only `git show <sha>` is a claim about a commit.

Related: [[a-measurement-is-scoped-to-what-it-measured]],
[[the-artefact-you-search-is-not-the-artefact-that-runs]], [[a-declaration-is-not-an-effect]],
[[restoring-a-mutated-file]], [[differs-is-not-owns]].
