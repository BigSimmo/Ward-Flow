---
name: ward-flow-task-ledger-is-not-outstanding-issues
description: 'In Ward Flow worktrees, "the issue/task ledger" means docs/ward-flow-task-ledger.md on the ward line, never docs/outstanding-issues.md — the SessionStart hook points at the wrong one'
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7fa82e0f-4502-4bae-aa4a-ba3bea87428a
  modified: 2026-09-16T13:09:04.432Z
---

**When Josh asks for "the issue ledger" or "the task ledger" from a Ward Flow worktree, he means
`docs/ward-flow-task-ledger.md` on the ward line** (WF-01..WF-52 families, I-01..I-14 invariants,
DECISION-xx questions; companion list `docs/ward-flow/PROJECT-ISSUES.md`). Not the repository's
`docs/outstanding-issues.md` on origin/main.

**Why:** 2026-09-16 I read "open the issue ledger" in `ward-lead`, followed the `issues` skill and the
SessionStart hook (which prints outstanding-issues counts in every worktree), set up an origin/main
worktree, dispatched eight readers over 85 repository rows, and asked to push PRs. Josh: "I also only
wanted you to get the Ward Flow task ledger." The ledger's own header already says the owner flagged
this exact confusion. Owner Ruling 14 / D-11 (2026-09-16) moved Ward Flow inbox items out of the
repository ledger for the same reason.

**How to apply:** in any Ward Flow context, open `docs/ward-flow-task-ledger.md` at the newest ward line
(run `bash ~/.claude/hooks/ward-fold-debt.sh --report` to name it). Treat the `[issues]` SessionStart
output as the repository's list, not Ward Flow's. If a request is ambiguous between the two, ask in one
line before doing anything. Related: [[ward-flow-ledger-system]] (the decisions register is a third,
separate file), [[ledger-rows-lag-reality]].
