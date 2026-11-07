---
name: subagents-write-into-the-parent-worktree
description: "Subagents' cwd resets to the parent worktree between calls, so two of four agents edited ward-lead instead of their own worktree — and the verification, not the edits, is the damage"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d9f6d3ee-6105-489f-896e-5c1538d8238d
  modified: 2026-09-18T10:15:55.476Z
---

**Measured 2026-09-18 18:05, from both sides in the same minute.** A session dispatched four
subagents into `D:/Worktrees/Database/ward-remeasure-20260918` with carefully disjoint scopes. Its
own worktree held **4** modified files — one agent's, correctly scoped.
`D:/Worktrees/Database/ward-lead` held **11**, mtimes seconds old, and they were exactly two other
agents' declared scope.

🔴 **A subagent's working directory resets to the parent session's worktree between Bash calls on
this machine.** A relative `src/components/...` in a brief resolves in the PARENT worktree. This is
the same root cause as [[subagent-git-must-use-dash-c]], which was written after an unprefixed
`git restore` hit the wrong worktree — the earlier memory framed it as a git-command rule, and it is
wider than that: **it applies to every path in a brief, edits included.**

## How to apply

- **Absolute paths for every edit; `git -C "<absolute worktree>"` for every git command.** In the
  brief, not as a preamble the agent may skip.
- 🔴 **Confirm from the OUTSIDE.** `git -C <the intended worktree> status --porcelain` and
  `git -C <parent worktree> status --porcelain`. An agent's report of where it wrote is the one
  thing that cannot detect this failure, because the agent believes it.
- **Check file mtimes, not just counts** — `stat -c '%y %n'` over `git status --porcelain` output
  shows whether writing is still happening and where.

## The damage is the verification, not the misplaced edits

⚠️ **The edits are recoverable; the conclusion is not.** A suite run in the intended worktree does
not contain them, so its result describes a tree nobody edited — **a green and a red are equally
meaningless**. A dispatching session reading "still red" would re-dispatch work already done; one
reading "now green" would believe a fix landed that its own tree has never seen. Same shape as
[[a-clean-result-from-measuring-nothing]] and [[a-baseline-from-the-subject-vouches-for-it]].

## And do not "fix" it by reverting

The misplaced files are another session's agents' work with nothing behind them. ✅ **Capture a patch
outside both worktrees, confirm it applies in the intended one, and only then restore the parent** —
and the session whose agents wrote them does the moving, not the session that found them. See
[[controller-staging-claims-subagent-work]] and [[protected-work-and-backups]].
