---
name: pr-babysit-marker-vs-protect-hook
description: "Past the 30-min PR babysit budget, gh/Monitor calls are denied; the marker cannot be deleted because protect-ward-flow.sh blocks rm under .git/worktrees — prefix CLAUDE_ALLOW_PR_FOLLOW=1 as the FIRST token instead"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 43862651-3477-40fc-9e10-33df5c9a09e6
  modified: 2026-09-16T21:19:48.158Z
---

`.claude/hooks/pr-handoff-stop.sh` denies `gh pr|run|api`, `Monitor` and `ScheduleWakeup` once a session's own PR is 30 minutes old. Its message offers two escapes, and one of them is blocked by another hook. Observed 2026-09-16.

- **Deleting the marker fails.** `CLAUDE_ALLOW_PR_FOLLOW=1 rm ".../.git/worktrees/<wt>/claude-pr-handoff-<session>"` is refused by `~/.claude/hooks/protect-ward-flow.sh`, which treats any rm under `.git/worktrees` as a worktree deletion.
- **The prefix works only as the very first token of the command.** `cd …; CLAUDE_ALLOW_PR_FOLLOW=1 gh …` is still denied. For multi-step reads, put the gh calls in a script and run `CLAUDE_ALLOW_PR_FOLLOW=1 node script.mjs`.
- **`Monitor` has no prefix escape.** Past the budget, check once with a prefixed `gh` call instead of watching.

**Why:** Josh had explicitly asked for the PR work to continue ("resolve all issues now"). Two hooks each offered an escape, and those escapes contradicted each other.
**How to apply:** only on an explicit user ask to keep following a PR, use the first-token prefix; never edit either hook. Related: [[autofix-vs-babysit-guard-conflict]], [[protected-work-and-backups]].
