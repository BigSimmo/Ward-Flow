---
name: git-checkout-ref-path-also-stages
description: "git checkout <ref> -- <path> writes the file AND stages it, so a later commit quietly includes files you never named in git add"
metadata:
  node_type: memory
  type: reference
  originSessionId: fa69685a-38db-4370-b1f2-c9129a7318f0
  modified: 2026-09-17T13:49:49.270Z
---

`git checkout <ref> -- <path>` does two things: it writes the file into the working tree AND
adds it to the index. So a later `git commit` with an explicit `git add a b c` commits a, b, c
**plus everything any earlier checkout staged**.

2026-09-17: took 7 files from a branch with `git checkout <branch> -- <path>`, then staged 5 of
them explicitly and committed. The commit contained all 7. No harm that time — all 7 belonged
in the PR — but the commit message named 5, and a doc went in as its pre-edit text because the
checkout had staged it before the edits were made.

**How to apply:** after any `git checkout <ref> -- <path>`, run `git status --short` and read
the **left-hand (staged) column**, not just the right. Files show as `A ` or `M ` with the
change in the staged column already. Either `git restore --staged <path>` what you do not want
in this commit, or accept it deliberately and write the message for what is actually staged.

This matters more here than in an ordinary repo because the rule is **never `git add -A`**
(another agent may share the worktree) — that rule creates false confidence that naming paths
explicitly bounds the commit. It does not.

Verify what landed, never assume: `git show --stat --format="" <sha>`.

Related: [[a-commit-after-a-merge-is-not-the-tree]], [[a-clean-worktree-is-not-an-empty-one]],
[[squash-merge-lands-a-subset]].
