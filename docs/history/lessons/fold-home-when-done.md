---
name: fold-home-when-done
description: Ward Flow work counts as done only when folded into the newest ward line and brought home to ward-lead; a SessionStart hook now measures the debt.
metadata:
  type: feedback
---

Owner instruction, 2026-09-16: **always fold work into the newest folder once done.** He asked for a
process, not a promise, after finding that Codex and Gemini had built for three days in
`D:/Worktrees/Database/ward-lead` while the ward line advanced in `D:/Worktrees/Database/ward-fixes`.
Measured that day: ward-lead 34 commits behind, 325 uncommitted files, 301 files changed on both
sides — of which 244 were already identical and 57 needed a decision each.

**Why:** staleness is invisible at the moment it matters. Every existing rule about it was prose in a
document nobody opens while working, so nobody chose the mess; it accumulated by default.

**How to apply:** `~/.claude/hooks/ward-fold-debt.sh` (registered in `~/.claude/settings.json`,
SessionStart) prints, from git: this worktree, this branch, the newest ward line and its folder,
BEHIND/UNFOLDED counts and the uncommitted count. It is Ward Flow only and exits silently elsewhere.
Run it any time with `--report`. Fold the newest line IN before building, never after; fold OUT before
calling anything done; if you cannot fold, name the branch and the blocker in the closing message.
Full rule text lives in `~/.claude/CLAUDE.md` under "Work is not finished until it is folded home".
See [[protected-work-and-backups]], [[parallel-chats-and-cross-chat-sync]], [[differs-is-not-owns]].
