# How these rules are organised

Read and follow [task lifecycle and receipt handoff](docs/task-receipts.md) at task start, checkpoint, blocker, resume and completion. Reuse the original task identity; local receipt export is a handoff, not canonical reconciliation.

This file is the always-loaded Ward Flow core. Some older checks locate policy headings in this
file; the repository boundary above governs their interpretation. Open a reference file only when
its topic applies and its instructions have been verified for this repository.

**Read these first:** the repository boundary above, `# API and provider confirmation boundary`,
and `# Local server safety`. Verify the actual destination before any push, pull request or deploy.

Several `docs/agents/` files were copied from PsychSift. They are background only where they name
another repository, remote, provider or CI workflow. Do not execute their Git or provider procedures
for Ward Flow. The `Run PR` sweep is disabled here until a Ward Flow specific workflow is written.

| Topic                                                                                                                     | Full text                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Gate selection, the verification tier table, the gate arbiter                                                             | [`docs/agents/verification-gates.md`](docs/agents/verification-gates.md)                     |
| Historical PR workflow; do not execute its GitHub procedures in Ward Flow                                                 | [`docs/agents/pull-request-workflow.md`](docs/agents/pull-request-workflow.md)               |
| The `upload` shortcut                                                                                                     | [`docs/agents/upload-shortcut.md`](docs/agents/upload-shortcut.md)                           |
| Button and route wiring, the bundle budget                                                                                | [`docs/agents/wiring-and-bundle-budget.md`](docs/agents/wiring-and-bundle-budget.md)         |
| External skill precedence, evidence and calibration                                                                       | [`docs/agents/external-skill-precedence.md`](docs/agents/external-skill-precedence.md)       |
| Deleting code you believe is dead                                                                                         | [`docs/agents/dead-code-deletion.md`](docs/agents/dead-code-deletion.md)                     |
| Claude Code hook scripts                                                                                                  | [`docs/agents/claude-hook-scripts.md`](docs/agents/claude-hook-scripts.md)                   |
| The `bug-hunter` shortcut                                                                                                 | [`docs/agents/bug-hunter-shortcut.md`](docs/agents/bug-hunter-shortcut.md)                   |
| Repository skills                                                                                                         | [`docs/agents/repository-skills-and-issues.md`](docs/agents/repository-skills-and-issues.md) |
| Codex dependency, review throttling, desktop worktree, reasoning effort, productivity, GitHub review, Cloud; Cursor Cloud | the `docs/agents/codex-*.md` and `docs/agents/cursor-cloud.md` pointers below                |

Some headings remain for existing policy checks, including `## Bare PR publication is not readiness work`,
`# Search chrome behaviour`, `## Anti-conflict and CI-speed operating procedure`, and
`## Codex Cloud environment`. A heading does not make copied PsychSift instructions applicable.

<!-- BEGIN:upload-shortcut -->

# `upload` shortcut

For the `upload` safe Git handoff workflow — protected branches, required inspection, safe versus confirmation-required actions, branch cleanup, syncing, and the final report, see [`docs/agents/upload-shortcut.md`](docs/agents/upload-shortcut.md).
<!-- END:upload-shortcut -->

<!-- BEGIN:run-pr-shortcut -->

<!-- BEGIN:pr-branch-sync -->

## Open PR branch sync (anti-churn)

Inherited PsychSift PR branch sync and sweep automation are retired for Ward Flow.
<!-- END:pr-branch-sync -->

## Run PR and Babysit shortcuts

The inherited PsychSift PR sweeps are disabled. Use only specifically authorised Ward Flow PR tasks; do not babysit CI without user request.
<!-- END:run-pr-shortcut -->

## Automated review coverage

The inherited PsychSift review workflow does not establish Ward Flow review or publication authority.

## PR bundling (reduce one-task-one-PR churn)

Bundle Ward Flow changes only after checking the exact branch, owner and user-authorised scope.
<!-- BEGIN:anti-conflict-speed -->

## Anti-conflict and CI-speed operating procedure

Goal: fewer merge conflicts and faster feedback without weakening required checks or the Ward Flow
repository boundary. Do not touch unrelated active PRs unless the user explicitly asks.

### Prevent conflicts before they start

- Prefer fewer, shorter-lived PRs. Bundle independently low-risk append-only docs/ledger chores (see "## PR bundling") instead of one PR per line.
- Start from this repository's verified `origin/main` on a task branch in an isolated worktree.
- Before calling GitHub `DIRTY`/`CONFLICTING` a real conflict, run `git merge-tree --write-tree origin/main <tip>`. Clean tree + behind = sync; dirty tree = real conflict.

### Speed CI without skipping quality

- Assemble the intended commits before an authorised push. Check the actual Ward Flow remote,
  destination branch, CI triggers and deployment effects before publishing.
- For normal Ward Flow readiness pushes — never an explicit bare PR publication — run the
  selected gate for the actual changed files, then verify the exact pushed commit.
- If a PR has auto-merge armed, its auto-merge state is user-owned and automation must not disable or re-enable it. Ordinary fast-forward pushes, `update-branch`/merge-main-in syncs, and bundled additions may proceed — GitHub re-validates required checks against the new head before merging, so an additive push cannot slip past that. A force-push, history rewrite, or base/target change while armed still hard-blocks with no override; wait for the user to change that state first.
- Missing CI checks are not a green pass. Verify checks against the exact head in the Ward Flow PR.
- Triage and repair actionable review threads early; reply before resolving (`<!-- codex-thread-disposition:resolved -->`). Leave ambiguous or product-sensitive threads open for the owner.
- Babysit dormant: observe fresh CI only at meaningful stage boundaries (at most once every 5 min, ≤30 min per run). If queued/running at limit, record run URL as deferred and continue sweep.
- For sweeps needing local repair, prepare one isolated, exact-lock worktree via `node scripts/setup-codex-worktree.mjs`.
- Treat merge queue state as read-only. Fall back to Actions runs for exact head SHA if `gh pr checks` cannot read check runs.
- Keep Playwright blocking tests at zero retries; quarantine via `tests/flake-ledger.json` only after three reproductions on the same SHA.

### Operator sync (explicit only)

- Leave active PRs alone unless requested. Report: `npm run sync:pr-branches`. Apply with confirmation and human/operator auth: `npm run sync:pr-branches:apply`.

<!-- END:anti-conflict-speed -->

<!-- BEGIN:codex-productivity-defaults -->

## Codex productivity defaults

For Codex-specific productivity shortcuts and operating rules, see [`docs/agents/codex-productivity-defaults.md`](docs/agents/codex-productivity-defaults.md).

<!-- END:codex-productivity-defaults -->

<!-- BEGIN:repo-productivity-skills -->

## Repository productivity skills

For the repo-local skill catalogue and the foundational orchestration skills, see [`docs/agents/repository-skills-and-issues.md`](docs/agents/repository-skills-and-issues.md).
<!-- END:repo-productivity-skills -->

## Codex GitHub review behavior

For separately authorised Ward review handling and historical review provenance, see
[`docs/agents/codex-github-review.md`](docs/agents/codex-github-review.md). The inherited
auto-fix workflow and enforcing checker are absent here; reply markers do not prove closure.

## Codex Cloud environment

For the Codex Cloud environment specification, access profiles, MCP limits, and acceptance checks, see [`docs/agents/codex-cloud-environment.md`](docs/agents/codex-cloud-environment.md).

## Cursor Cloud specific instructions (not Codex Cloud)

For Cursor Cloud agent setup, live-vs-demo mode detection, verification commands, and GitHub
connector guidance, see [`docs/agents/cursor-cloud.md`](docs/agents/cursor-cloud.md).

# Commit as you go — the thing that loses work here is interruption, not carelessness

Preserve coherent work when it becomes ready, at an actual pause/transfer/end, before changing checkout/branch or before risky restoration. When local commits are within the current task authority, commit each coherent owned unit rather than waiting for the whole task. Otherwise keep exact recoverable evidence and report the owned uncommitted paths at that boundary. Ordinary conversation within the same task does not require a half-commit or repeated disclaimer.

Historical recovery incidents are preserved in [recovery-history.md](docs/agents/recovery-history.md).

## The rule

**At coherent completion, a real pause or transfer, task end, checkout/branch change or risky restoration, preserve your owned work and identify any uncommitted paths and blocker in the handoff/checkpoint.** A status answer or ordinary conversation inside the task is not a new recovery boundary. Keep one original task identity and canonical checkpoint; never imply that an unverified commit has passed its gates.

- **Commit each coherent unit** — a module and its test, a fix and its proof, a document. Not the
  whole task.
- **Formatting belongs to the coherent owned unit.** Include all intended formatting in the reviewed candidate and recoverable commit/handoff; do not create a separate commit solely because a formatter ran.
- **A blocked gate stays blocked.** Preserve coherent owned work under the current commit authority and report the exact blocker, unrun/failed evidence and next safe action. Never bypass an ownership guard or label unverified work passing.
- **Never `git add -A`** — another agent may share this worktree, and the wildcard commits their
  in-flight edits under your message.
- **Mutation testing requires committing first.** Restoring a tracked file with `git checkout --`
  also discards any uncommitted fix inside it, and `git checkout --` has no effect at all on an
  untracked file — it leaves the mutation in place and reports an error most drivers never read.

## Why this matters more here than in an ordinary repository

The [recorded worktree losses](docs/agents/recovery-history.md) explain why recoverable commits
and boundary-based handoffs matter. They do not require a commit for every ordinary reply.

## When you genuinely cannot commit

Pre-commit checks the proposed index: staged source roots plus their imported dependencies/config from the same disposable index snapshot, using installed package resolution. Generated-document checks observe that snapshot with `--check`; they do not rewrite working-tree files or stage outputs automatically. Their default advisory or explicit strict result must be reported accurately. Unknown inputs, genuine staged-file/ownership conflicts and required gates still block as their contract requires.

Unrelated dirty or untracked component/test files alone do not freeze every commit. Stage named owned files only; never stage, move, discard or overwrite a peer's changes to clear a hook. If an actual guard blocks your coherent unit, name its exact paths/reason at the recovery boundary and coordinate release or an authorised scoped takeover. Keep the blocker and next action in the existing checkpoint.
