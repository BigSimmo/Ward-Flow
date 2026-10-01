# Ward Flow rules repair — WF-RULES-20261002

Owning project: Ward Flow. Repository: BigSimmo/Ward-Flow.
Original objective: review the stale Antigravity rules audit and repair confirmed current documentation/tooling inconsistencies while preserving the accepted app design.

## Checkpoint

- Status: In progress.
- Worktree: `C:/Users/joshs/.codex/worktrees/7a69/Ward-Flow`.
- Branch: `codex/chat-ward-rules-repair-7a69`.
- Accepted design/base: local `main`, `981a4a8a52e0c235b888e4c9470c94c34808cf33`.
- No UI, engine, clinical policy, persistence, scheduling or provider changes.
- Reproduced before repair: both selector defaults reference the retired Database branch and fail; explicit `--base origin/main` succeeds. Owner index omits `decisions.md` despite passing its generated-file check.
- Deferred allegations: mask performance and timestamp collisions lack a reproduction. Keep explicit staging, test-deletion safeguards and ownership protections.
- Ownership blocker: AGENTS.md, README.md, docs/hosting.md, docs/ward-flow/RULES.md, scripts/ward-flow/rules-index.mjs, docs/ward-flow/code-map/scripts-and-tooling.md and docs/ward-flow-task-ledger.md have existing claims. Do not edit them without release or exact scoped takeover.
- Next action: repair unclaimed tooling/docs and run focused offline contracts; prepare the bounded document changes for the ownership blocker.
- Last verified: 2026-10-02 (local checkout/ownership inspection only; hosted state unverified).

## Acceptance

Active guidance points to the accepted app, current dedicated-repository selectors work, the index includes the central decisions with source provenance, visual evidence states its checked revision/coverage, and route/ownership guards remain effective. Retain historical records and do not infer fresh visual verification from generated-file checks.

Local receipts are reconciliation handoffs; canonical ledger sync, publication, integration and deployment require their separate authority.
