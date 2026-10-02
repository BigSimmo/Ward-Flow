> **Historical source boundary — 2 October 2026.** The preserved material below
> describes the former Database/PsychSift workflow or a completed task. Its commands,
> hosting and appearance claims are not current Ward instructions. Use the
> [repository boundary](../AGENTS.md) and [Ward entry point](ward-flow/README.md) for current work.

<!-- docs-script-refs:historical-start -->

# Productivity workflows

For current Ward Flow work, use the on-demand [task brief, verification and continuation convention](agents/task-efficiency.md).

> **Historical reference, revalidated 1 October 2026:** The entire command list and execution
> descriptions below belong to the former Database/PsychSift workflow. Its 35-skill catalogue,
> planner scripts and npm planner commands are unavailable in this dedicated Ward Flow repository.
> They are retained as historical background and must not be executed here. Ward Flow's
> `origin/main` is a different repository history; it does not supply those tools.

The former seven offline-first planners used `scripts/ci-change-scope.mjs` to print verification
sequences and a provider approval section. Their historical interface was:

| Command                                         | Purpose                                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run workflow:flightplan`                   | Classify the current diff and select the smallest appropriate verification ladder.     |
| `npm run workflow:triage`                       | Classify a saved or recent workflow failure before attempting a fix.                   |
| `npm run workflow:clinical-proof`               | Produce clinical-governance, privacy, source, rollback, and verification requirements. |
| `npm run workflow:design-sweep`                 | Plan the live route, breakpoint, accessibility, and Chromium sweep.                    |
| `npm run workflow:rag-lab`                      | Select focused retrieval tests, offline RAG evaluation, and gated live evaluations.    |
| `npm run workflow:operator-closeout`            | Inventory and deduplicate pending operator or confirmation-required actions.           |
| `npm run workflow:lifecycle -- --phase <phase>` | Plan `status`, `start`, `reconcile`, `handoff`, `landed`, or `cleanup` lifecycle work. |

## Historical execution interface

- Planning is read-only by default.
- Add `-- --run` to run only the printed local/offline checks.
- Provider-backed commands are never executed by the planner, even with `--run`.
- Add `-- --write-evidence` to save structured evidence under ignored `.local/workflow-evidence/`.
- Add `-- --json` for machine-readable output.
- Use `-- --files pathA,pathB` to plan an explicit proposed change before editing.
- Use `workflow:triage -- --log <path>` to classify a captured failure.
- Use lifecycle phase `reconcile` for broad multi-worktree work. It selects the report-only
  `node scripts/reconciliation-preflight.mjs` and
  `node scripts/reconciliation-evidence-pack.mjs --output .local/reconciliation-evidence/pack.json`
  locally and keeps `git fetch --prune origin` approval-gated. Add
  `--include-processes` to the preflight only when process ownership may block cleanup; it never
  serializes raw command lines. Lifecycle `start`/`cleanup` select
  `node scripts/primary-checkout-lease.mjs --check` so primary writes fail closed under another
  owner or dirty/operation state without blocking read-only or feature worktrees.

The former shared `workflow:run`, `workflow:status`, `workflow:verify`, `workflow:deps`, `workflow:clean-state`, `workflow:export`, and `workflow:handoff` commands resolved their implementation through that repository's Git common directory. Its `CODEX_LOCAL_WORKFLOW_ROOT` override was part of that interface, not a Ward Flow setup instruction.

The matching agent skills lived in that repository's `.agents/skills/`; their historical presence
does not establish availability in this checkout or the current agent environment.

<!-- docs-script-refs:historical-end -->
