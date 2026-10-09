# Ward Flow recovery incidents — historical evidence

The current recovery rule lives in [AGENTS.md](../../AGENTS.md). These records explain it;
they are not additional per-task gates. Extracted on 8 October 2026 to reduce always-loaded context.

<!-- docs-script-refs:historical-start -->

**Historical recovery incident — 29 August 2026; evidence for the current boundary-based rule below.** The
observed failure, 2026-08-29: seven files were formatted, the verifying test run was refused because
another worktree held the machine-wide lock, and attention moved to answering other sessions. The
files sat uncommitted for an hour, through a dozen unrelated commits, and were found only because an
unrelated status check happened to list them. Nothing about that hour felt like carrying risk. **The
work was finished and the mind had moved on — that combination is the hazard.**

## Why this matters more here than in an ordinary repository

**A worktree under `.claude/worktrees` has twice been removed mid-session on this machine** by
unrelated cleanup sessions. A commit is what makes that survivable: the branch ref and the objects
live in the shared repository at the top level, not in the worktree folder, so losing the folder
costs nothing but a fresh checkout. **An uncommitted file is the only thing that does not survive it.**

<!-- docs-script-refs:historical-end -->
