---
name: governance-relaxed-owner-decision
description: 'Owner decision 2026-09-17/18 — clinical governance PR paperwork made advisory and verify:cheap cut from 41 gates to 4; do not "restore" either as a fix'
metadata:
  node_type: memory
  type: project
  originSessionId: f7dea8db-82e3-4cc2-83cc-c11937809216
  modified: 2026-09-17T16:29:11.727Z
---

Josh asked for the clinical governance process to be **relaxed for iteration speed** and
approved two changes on 2026-09-17/18. Branch `chore/relax-clinical-governance` in
`D:/Worktrees/Database/relax-governance`, off `origin/main` @ `6f7a694fac`.

**1. No PR-body prose blocks a merge any more.** The seven-item
`## Clinical Governance Preflight` completeness gate and the `RAG impact:` declaration were
both hard blocks in `scripts/pr-policy.mjs`; both now `warnings.push`. Neither ever read a
line of code — they checked that an author had typed the right sentences — while
`clinicalRiskPatterns` matches most meaningful paths, so the block fired on nearly all real
work. **Still failing closed and deliberately untouched:** migration-history immutability,
the owner-approval hold on `supabase/` PRs, required-check forgery, the `PR_POLICY_BODY.md`
transport check, and every behavioural safeguard (owner-scope, query-privacy, live
eval-canary, `tests/rag-imputation-contract.test.ts`).

**2. `verify:cheap` is 4 commands, not 41.** Now parity + lint + typecheck + test. The 38
static gates moved verbatim to **`verify:full`**; they all still run in CI.
⚠️ `check-gate-manifest.mjs` was repointed to read `verify:full:internal` — pointed back at
the cheap chain it would still PASS while silently dropping 38 gates from its one-way
CI-drift invariant. See [[a-guard-that-defends-a-superseded-ruling]].

⚠️ **The auto-mode classifier blocks this work.** Editing `scripts/pr-policy.mjs`,
`package.json` scripts, even a _grep_ of them, got denied as "CI Bypass" / "Security Test
Removal" — Bash and Edit routes both. It is inconsistent (see
[[auto-mode-classifier-is-inconsistent]]) and cleared after Josh took the session out of auto
mode. Do not hunt for a route around it; stop and ask him to switch modes.

⚠️ **I recommended AGENTS.md trimming and CI narrowing and both were already done.**
AGENTS.md is 539 lines on main (the 925 I quoted was the stale
`codex/isolate-sidebar-prototypes` branch — [[a-line-number-is-a-different-number-in-every-tree]]),
and every heavy CI job is already conditional on the `changes` classifier. Measure the tree
you are actually on before promising a cut.
