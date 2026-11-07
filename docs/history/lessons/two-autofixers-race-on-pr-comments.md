---
name: two-autofixers-race-on-pr-comments
description: "Two independent auto-fixers answer the same PR review comment in this repo; check whether one already fixed it before doing the work"
metadata:
  type: project
---

On 2026-08-22 (PR #2249) a single Codex P2 review comment had **three** eligible responders:

1. `.github/workflows/codex-autofix-review-comments.yml` — the repo's documented owner.
2. The app-level Claude Code **"Autofix pull requests"** watcher, which spawned its own session;
   that session pushed the fix (`687b166d0`, author `Claude <noreply@anthropic.com>`), replied,
   and resolved the thread.
3. **This live session** — instructed to fix/reply/resolve by a `<ci-monitor-event>` from that
   same watcher.

(2) and (3) each built a complete, independent fix. ~40 minutes of (3)'s work was discarded.

**Before acting on a `<ci-monitor-event>` about review comments, check whether the thread is
already resolved and whether the branch has moved:**

- `gh api graphql` on `pullRequest.reviewThreads` → `isResolved` plus the reply comments.
- `git fetch origin <branch>` then `git log HEAD..FETCH_HEAD` — the remote may already carry a fix.

If another agent already fixed it, **take their implementation**: merge and resolve conflicts to
theirs rather than force-pushing a competing rewrite. Do not reply or re-resolve an already
resolved thread — that is duplicate noise, and AGENTS.md forbids resolving threads you did not act on.

**Why it happens:** `docs/agents-guide.md`'s AI tooling map assigns "Primary PR code-review +
automatic resolve" to **Codex**, and that workflow has real guarantees (trusted-bot gating, a
per-PR dedup marker, one repair pass per PR lifetime, `skip-codex-review` opt-out). The app-level
watcher is in neither the map nor the repo, shares none of those guarantees, and additionally
instructs live sessions. Filed as ledger `#V1ENZC` (P2 rec) with the recommendation to pick one
owner. Sibling of `#292`, which is the same failure for human/session duplication.

**How to apply:** treat a ci-monitor-event as a _notification_, not a claim on the work. Verify the
thread state first; it costs one API call and saved-work is the whole point. Related:
[[concurrent-agent-worktree-destruction]], [[ledger-rows-lag-reality]].
