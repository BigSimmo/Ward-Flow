---
name: publication-branch-overwrites-remote-fixes
description: "A publication branch rebuilt from a working tree silently discards fixes made on the branch itself; check by tree, not by commit message"
metadata:
  node_type: memory
  type: project
  originSessionId: 2b6afefc-3c5d-42e8-9a09-d310ecde7e2f
  modified: 2026-09-03T10:43:10.890Z
---

Ward Flow could not push its working branch (a 124 MB recovery bundle in history, and git objects
are content-addressed so no reachable branch is pushable). The workaround is a **publication
branch**: `git read-tree` the working HEAD, `update-index --force-remove` the bundle, `commit-tree`
onto the published tip.

⚠️ **That rebuilds the WHOLE tree from the working branch, so any fix made on the published branch
is silently overwritten by the next publication commit.** On 2026-09-02 a cloud session fixed a gate
failure there (`4473ebd9e`, restoring a route as a redirect). The next publication commit wiped it,
and nothing reported a conflict — the tree simply came from elsewhere.

**How I caught it:** `git ls-tree -r --name-only <ref> -- <path>` showed the file present at the fix
commit and absent at the branch tip. The commit message said it had been restored; the tree said
otherwise. `git show <ref>:<path>` was useless here — a path containing `[patientId]` made git fall
back to showing HEAD, printing a _different commit_ with no error.

**Rules that follow:**

- Never fix anything on the publication branch. Fix on the working branch and republish.
- Before publishing, `git diff --name-only <remote tip> <new tree>` and read the list — it is the
  only thing that shows what you are about to discard.
- Parent the publication commit to the published tip so the push is a **fast-forward**. A
  force-push is hard-blocked while auto-merge is armed, and rightly.

Related: [[squash-merge-lands-a-subset]], [[assert-only-about-code-you-opened]],
[[observations-expire]].

## The same trap in the reassuring direction: "my fix was never needed" — 2026-09-06

Known form: a fix made on the branch vanishes when the publication line is rebuilt. The form I
actually hit was the mirror image, and it is harder to notice because it arrives as good news.

`merge-base` put the master line only four commits ahead of my base, all of them docs and
snapshots. Grepping the master tip for the three retired phrasings I had repaired returned
**zero**. The obvious reading — _master never carried those violations, so I repaired something
that was not there_ — is FALSE, and it is the reading that closes the inquiry.

**Comparing blobs said the opposite: all five repaired files were byte-identical to mine.** My
work was already on the line. Ancestry had told me nothing, because a rebuilt publication line has
no honest ancestry to report.

⚠️ **The tell is that an empty grep was exactly the answer I was hoping for**, so I controlled the
pathspec before believing it (202 files matched on that ref, and a word certain to be present did
hit). The control is what let the zero mean something — but the control only proves the search
worked, never that the conclusion drawn from the zero is the right one. Those are two steps and I
nearly stopped after the first. See [[a-control-must-test-the-premise-not-the-measurement]],
[[check-the-conclusion-that-flatters-the-theme]], [[a-correct-diagnosis-that-stops-the-inquiry]].

**How to apply: against any rebuilt or republished line, `rev-list`, `merge-base` and
"N commits ahead" are not evidence about CONTENT — only `git rev-parse <ref>:<path>` blob
comparison is.** And use `git cat-file -e` to test presence: `rev-parse` prints the unresolved
string and exits 0 for a path that is not there, which in this very check silently mislabelled the
one file that genuinely differed.
