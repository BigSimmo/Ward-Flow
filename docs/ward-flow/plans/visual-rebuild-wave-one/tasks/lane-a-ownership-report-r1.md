Lane A ownership scout — 2026-09-12

Scope: local worktree/claim/source ancestry only. No claim, worktree, or lease mutation; no tests, browser, server, provider, or remote Git.

Exact current line: `D:/Worktrees/Database/ward-lead` is `codex/task-ward-flow-live-state-20260831` at `1ef9ed3975078b789e9b5d70b3f000c64edc3809`. Its existing dirty scope is documentation/config/test-related and was left untouched.

Lane A worktree: `D:/Worktrees/Database/ward-builder`, branch `ward/lane-a-command-delays-movement-capacity-20260910`, HEAD `43b66b637dbac307e08be8d2a496e28a53ec0c9f`. Its concise porcelain status produced no entries (clean). The local worktree inventory shows it is a distinct checkout, with no move or deletion performed.

Claim evidence: `docs/ward-flow/control/work-claims.md` open-claims row 39 assigns Lane A Command, Delays, Movement and Capacity source/test paths, but explicitly says “I AM NOT BUILDING YET” and that building starts only after the shell/facade/seed phase. This is an exclusive reservation, not evidence of unfinished source edits.

Ancestry evidence: Lane A HEAD `43b66b637d` is an ancestor of current HEAD `1ef9ed3975`; current HEAD is not an ancestor of Lane A. The source diff from Lane A HEAD to current HEAD has only `src/components/ward-management/coordinator/priority-queue.tsx` among the requested coordinator/delays/movements/capacity areas. Lane A’s earlier source commit `09c7416ebc` changed `movements-screen.tsx` (+81/-55) and its DOM contract, demonstrating that at least some Lane A implementation work is already present in the current line.

Conclusion: the Lane A branch’s committed history is folded into the current line; there is no separate uncommitted Lane A source delta in its worktree. The claim row is stale as an active implementation reservation and still needs controller reconciliation before new Command/Delays ownership is treated as available. Current `priority-queue.tsx` ancestry shows later Command changes on the lead line, so the claim cannot be used to infer that the new visual rebuild is complete or that all four designs match. Visual status remains unverified.

Uncertainty: ancestry proves inclusion of commits, not that the present screens satisfy the new design brief. The claim itself was not edited here. If a decision outside this evidence boundary is needed, stop and hand it back.
