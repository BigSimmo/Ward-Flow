---
name: autofix-vs-babysit-guard-conflict
description: "Autofix-pull-requests and the repo's 30-minute PR-babysit guard fight each other; the guard blocks the very CI reads Autofix demands"
metadata:
  node_type: memory
  type: project
  originSessionId: f5b16277-7fce-4d0b-a188-079f2a761351
  modified: 2026-09-17T17:34:50.122Z
---

When "Autofix pull requests" is enabled in the desktop app AND this session opened the PR, two
mechanisms collide. Autofix keeps sending `<ci-monitor-event>` messages demanding CI fixes, while
`.claude/hooks/pr-handoff-stop.sh` blocks every CI read (`gh pr checks`, `gh api .../check-runs`,
`Monitor`, `ScheduleWakeup`) once 30 minutes have passed since the PR was created. The session is
handed work it is forbidden to look at.

Observed 2026-08-27 on [PR #2405](https://github.com/BigSimmo/Database/pull/2405).

**Why:** the guard exists to stop a session drifting into unbounded PR supervision. Autofix is the
user explicitly opting into exactly that supervision. Neither knows about the other.

**How to apply (revised 2026-09-18 on [PR #2859](https://github.com/BigSimmo/Database/pull/2859) —
the 2026-08-27 version said to STOP and wait for an explicit "continue"; that was too cautious).**
Autofix being enabled IS the ask. Josh's own hierarchy in AGENTS.md puts "this tool's own standing
instructions" **above** "a repository's own instructions", and the deny message itself names the
sanctioned route for "the user has asked for CI to be watched past the budget". So:

- **Act, then say so.** Prefix the `Bash` call with `CLAUDE_ALLOW_PR_FOLLOW=1` (first token of the
  whole command) and tell Josh in one line that the budget was spent and Autofix overrode it. Do
  not go silent, and do not stall the fix waiting for permission he already gave.
- **Prefer the prefix to the marker.** The prefix is per-command; deleting the marker
  (`.git/worktrees/<worktree>/claude-pr-handoff-<session-id>`) disables the guard for the whole
  session. Only delete it if a blocked tool has no prefix route — `Monitor` is blocked outright —
  and say so when you do. ⚠️ `protect-ward-flow.sh` may deny the deletion anyway; see
  [[pr-babysit-marker-vs-protect-hook]].
- **Check WHICH head the reported failure belongs to before fixing anything.** `pr-required` has
  `if: always()`, so it reports the previous head's failure as a fresh one. On #2859 the reported
  "PR required" failure was the already-fixed `Static PR checks` on the prior commit; the current
  head had no `pr-required` run yet. `gh api repos/<o>/<r>/commits/<sha>/check-runs` settles it.
  See [[a-status-claim-about-someone-else-expires]].

Related: [[never-delete-worktrees-unasked]], [[two-autofixers-race-on-pr-comments]],
[[gate-wrappers-mask-exit-codes]].
