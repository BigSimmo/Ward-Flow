---
name: a-push-after-the-merge-recreates-the-branch
description: 'A PR can merge while you are still working its branch; the next push silently RECREATES the branch GitHub deleted, and "[new branch]" in the push output is the only tell'
metadata:
  node_type: memory
  type: feedback
  originSessionId: f7dea8db-82e3-4cc2-83cc-c11937809216
  modified: 2026-09-18T12:36:02.181Z
---

On [PR #2859](https://github.com/BigSimmo/Database/pull/2859) I merged `origin/main` into the
branch, ran gates, and pushed. The push said:

```
 * [new branch]            chore/relax-clinical-governance -> chore/relax-clinical-governance
remote: Create a pull request for 'chore/relax-clinical-governance' on GitHub by visiting: …
```

The PR had **already squash-merged** 20 minutes earlier and GitHub had deleted the branch. My
push recreated it, pointing at a merge commit that is now pure noise.

**Why:** a push to a deleted branch succeeds — it is a create, not a conflict — so there is no
error to notice. `[new branch]` on a branch you have pushed twice already is the signal, and it
is one quiet line in the middle of dependabot chatter. A long-running task can easily outlive
its own PR, especially with auto-merge armed.

**How to apply:**

- **Before any push to a PR branch, re-read the PR's state, not just its checks.**
  `gh pr view <n> --json state,mergedAt,headRefOid`. `state=MERGED` means stop.
- **Read the push output.** `[new branch]` on a branch that already existed means the remote
  one was deleted underneath you.
- **Then verify what landed by CONTENT, never by commit id** — a squash rewrites the SHAs, so
  `origin/main..HEAD` will always list your commits as "not on main" and prove nothing. Diff
  the actual files: `git diff --stat origin/main HEAD -- <the files you changed>`; empty is the
  proof. See [[squash-merge-lands-a-subset]] and the `prlanded` skill.
- The leftover remote branch and worktree are **deletions** — ask Josh, never tidy them away.
  See [[protected-work-and-backups]].

⚠️ Auto-merge state can change under you, and the ordinary reason is that Josh changed it. I
disabled it on #2859 at his request and verified `autoMerge=OFF`; **he re-enabled it himself**
20 minutes later (confirmed by him) and the PR merged. Nothing was wrong — but I had already
pushed on the assumption that a setting I verified was still true. Re-read state before acting
on it, and when an actor shows up as `enabledBy: BigSimmo`, the first hypothesis is Josh, not a
rogue tool: say what the data shows and ask, rather than leading with a security worry.
See [[observations-expire]] and [[a-status-claim-about-someone-else-expires]].
