---
name: subagent-git-must-use-dash-c
description: "Subagent Bash calls reset cwd to the parent session's folder, so an unprefixed git restore can hit ward-lead instead of the agent's worktree; briefs must require git -C <absolute worktree>"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 78e41062-7eb2-4d37-8c9c-e7e559457f17
  modified: 2026-09-16T16:59:57.989Z
---

On 2026-09-17 a Sonnet Ward Flow agent (legal T13) restored a mutated file with an unprefixed
`git show HEAD:<path> > <path>`. The shell cwd had reset to the parent session's folder
(`D:/Worktrees/Database/ward-lead`), so it wrote ward-lead's HEAD version of the reducer over its own
worktree's file. It noticed an unexpected 633-line diff and repaired it; ward-lead itself stayed clean
(checked with `git -C ward-lead status`).

**Why:** the Bash tool resets cwd between calls; "work only in your worktree" in a brief does not
change where a bare git command runs. The same slip in the other direction would write into ward-lead,
the owner's main line.

**How to apply:** every implementer brief says "run git as `git -C <absolute worktree path>` and use
absolute paths for every redirect". After any agent reports a restore slip, check ward-lead with
`git -C D:/Worktrees/Database/ward-lead status --porcelain` before folding. Related:
[[subagent-hides-files-via-shared-exclude]], [[restoring-a-mutated-file]].

## 2026-09-18 — IT IS NOT ONLY GIT. RELATIVE **FILE** PATHS RESOLVE THERE TOO.

I briefed four subagents with "Work ONLY in worktree X" and "use `git -C X`" — and still lost the
work of three, because the FILE paths in the brief were relative (`src/components/ward-management/**`).
Their Read/Edit calls resolved against the reset cwd, so ~20 files landed in `ward-lead` instead.

🔴 **AND IT COST MORE THAN THE WORK.** A peer measured 11 files whose paths matched two agents'
declared scope and told me my agents were writing there; I believed it and **asked the owner for
permission to delete them**. They were not mine — all three agents were already dead and the writes
continued for nine minutes after. Scope-match is not authorship. The withdrawal is what stopped it
costing something.

✅ **What a brief must carry, at the top, not buried:**

- Every Read/Edit/Write path absolute, beginning with the worktree root.
- Every Bash call as ONE command: `cd "<abs>" && ...`.
- `git -C "<abs>"` for every git call.
- **A self-check the agent runs after its first edit:** `git -C "<abs>" status --porcelain` must
  list that file; if it does not, stop and report. This is the only instruction that catches the
  failure from inside.

Re-dispatched with those four and it worked first time.

Related: [[differs-is-not-owns]], [[a-status-claim-about-someone-else-expires]],
[[unattended-tool-folds-during-a-pause]].
