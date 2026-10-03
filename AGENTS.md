<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ward Flow repository boundary

This is the dedicated `BigSimmo/Ward-Flow` repository. Before any repository write, confirm that
both the fetch and push destinations are this repository and that the checkout belongs to its Git
history. If either destination is missing or points elsewhere, stop and report it. Never repair a
wrong checkout by repointing a shared remote: use a separate Ward Flow clone or worktree.

Work on a task branch in an isolated worktree created from this repository's verified `main`.
Check the worktree path, branch and base before editing. Keep the main checkout and other agents'
changes intact. Do not create Ward Flow worktrees from a Database or PsychSift checkout, use the
old local Ward line, or link dependencies from that checkout. Use this repository's lockfile for
dependencies. Publication to GitHub or a provider still needs the authority stated below.

# Requested stage, decisions and startup context

Complete the stage Josh requested: an audit is complete when its usable findings/evidence are delivered; Fast Preview when its affected appearance/interactions are evidenced; local engineering when the change and required local gates are verified. Integration, publication, CI observation, merge and deployment require their applicable authority and separate evidence. Local completion does not require a coordinator or provider action that was not requested.

Ask only when material uncertainty changes scope, meaning, safety, ownership or consequential authority; resolve accessible facts and ordinary reversible choices yourself and continue independent authorised work. Preserve direct owner decisions for clinical, privacy, product-sensitive or true ownership conflicts. At startup/resume, read the current entry point, relevant rules, exact task row/canonical checkpoint and scoped code-map section; retain the full ledger/history and primary evidence without reading it all routinely. Follow the existing receipt contract and compact-route qualifications; a timestamp alone is not new verification.

# Prototype Operating Mode & Policy Exemptions (Approved 3 October 2026)

Ward Flow is an engineering demonstration prototype for psychiatric bed flow in Western Australia, executing exclusively on **100% synthetic data** with zero live EHR connections, zero real patient information, and no autonomous clinical decision-making.

To prevent procedural friction and development gridlock, the following exemptions and softenings are permanently enacted:

1. **PsychSift & Database Policy Exemption:**
   - Skills `/clinical`, `/sources`, and `/api` (Database/PsychSift versions), along with references to `workflow:clinical-proof`, live Supabase checks, RAG citations, and `.github/pull_request_template.md`, are **wholly inapplicable** to Ward Flow. Agents must not attempt to execute these workflows or demand clinical proofs for prototype changes.
2. **Clinical Safety Officer & Legal Sign-off Decoupling:**
   - Simulated CSO, Cultural, or Legal JSON approval files (`clinical-safety-officer-signed.json`, etc.) are **not required** for local development, builds, or PR merges. The Clinical Safety Case (`docs/ward-flow/governance/CLINICAL-SAFETY-CASE.md`) and Cultural Safety Charter serve as presentation reference materials for WA Health stakeholders, not blocking technical gates.
3. **Streamlined Git & Push Workflows:**
   - The in-flight CI push blocker in `scripts/guard-push.mjs` is advisory during interactive work; pushes do not need to wait for previous background CI runs unless explicitly requested.
   - The file sign-out clash check (`sign-out.md`) is optional and bypassed for interactive single-user development sessions: the pre-commit guard is skipped by default (`PRECOMMIT_SIGNOUT_STRICT=1` restores it). Concurrent multi-agent work still signs out files as described under "Where work happens".
   - Diff-integrity test floors (`check:diff-integrity`) are advisory by default (`DIFF_INTEGRITY_STRICT=1` restores the hard floor); truncation artefacts and an unreadable before-state still fail. Dead code deletion refusals (`check:dead-code-candidate`) still run and fail closed by default; with Josh's approval a legitimate dead-export cleanup may proceed despite a refusal (`DEAD_CODE_ADVISORY=1`), recorded in the PR.
4. **Historical Checklist & Lesson Retirement:**
   - `docs/ward-flow-safety-checklist.md` and `docs/ward-flow/RULES.md` are **historical post-mortem archives**, not mandatory per-task checklists. Agents must not spend context or turns running through 2,100 lines of checklist rules for everyday coding tasks.
5. **Multi-Agent Swarm Usage:**
   - Swarms (`/review-swarm`, `/evaluator-optimizer-swarm`) are reserved for explicit milestone reviews prior to client demonstrations, not routine feature or bug fix iterations.

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

<!-- BEGIN:dependency-shortcut -->

# Ward Flow — dedicated repository entry point

[`docs/ward-flow/README.md`](docs/ward-flow/README.md) is the product entry point for Ward Flow's
mission and design. Its old worktree, fold and publication instructions are superseded by this
repository boundary. The working engine is authoritative for behaviour and the latest approved app
is authoritative for appearance. For the 2 October 2026 stale-rules repair, the owner reconfirmed
the current local `main` design as the baseline. Historical drawings and token prescriptions do
not authorise restyling it; preserve understandable status and accessible controls.
Synthetic data only. Do not use real patient information before
the separately required clinical, privacy and legal reviews.

### Where work happens

- Work only on your own task branch and worktree in this `BigSimmo/Ward-Flow` Git repository.
  Verify `git remote get-url origin` and the push URL identify `BigSimmo/Ward-Flow` before writing.
  A checkout inside the former Database/PsychSift repository is the wrong project, even if its
  folder name mentions Ward Flow. Do not change that repository's shared Git configuration.
- Before editing an exact file, check the shared sign-out at `D:/Repos/ward-flow-logs/sign-out.md`
  (optional for interactive single-user sessions; see Prototype Operating Mode above).
  An active overlap needs the other owner's release or Josh's scoped takeover approval for that
  exact file. Sign out every file on every task branch, including `codex/*` and files outside the
  old Ward directories. Include `repo=BigSimmo/Ward-Flow` in each new sign-out and `RELEASED` line
  so claims remain attributable if a worktree is later removed. Preserve existing work and keep
  the log append-only; older Database claims remain separate physical files.
- Make small commits on the task branch. Never clean, reset, discard, force-push or rewrite unclear
  work. Stage named files only; never use `git add -A`. Keep a recoverable base before replacing
  files. Use dependencies from this repository's lockfile, not from the former Database checkout.

### Checks and shared run slots

Use the smallest focused checks while editing and the selected public-repository gate before
publication. One wide run at a time across the PC; narrow checks use the shared run slots. For fast
local unit testing during development, run `npx vitest run <path/to/test.ts>` directly (~250ms). It
executes in isolation without waiting on machine-wide heavy locks or `test:focused` selector
restrictions. Reserve `npm run test` (full suite) and `npm run verify:pr-local` for pre-push readiness.
Do not run old Ward Flow scripts that hard-code the former Database worktree or local ward line. Confirm
that a script's checkout, base and provider effects fit this repository before running it. A test
pass in the old checkout does not prove this public repository or a deployed service.
Stop servers, browsers and other processes you started when the task no longer needs them. Check
ownership before stopping a process that might belong to another chat.

### Publication and provider safety

- Before a push or PR, verify the actual Git remote and GitHub target are `BigSimmo/Ward-Flow`.
  Never push Ward Flow work to `BigSimmo/PsychSift` or `BigSimmo/Database`. A wrong or unknown
  destination is a hard stop, including when a command names a repository explicitly.
- `origin/main` here is Ward Flow's public main branch. Do not treat it as the former clinical
  application's production branch. Review the actual workflows and deployment triggers before an
  authorised push or merge. Direct main pushes, merges, deployment, provider calls and access
  changes require their own applicable user authority.
- The Azure Function, Storage and planned PostgreSQL backend are separate from PsychSift's
  Supabase and Railway resources. Verify Azure resource identity before any live mutation. Never
  use PsychSift credentials, deployments or database migrations for Ward Flow.
- Keep browser, server, local PostgreSQL, hosted Azure and deployed behaviour as separate evidence.
  Do not call a backend ready until its authenticated shared save/reload and conflict path pass.

**Writing to Josh:** plain Australian English, answer first, short sentences, and state what is
verified, what remains unverified and any action he must take.

## Dependency shortcut

For the full Codex dependency shortcut workflow, see [`docs/agents/codex-dependency-shortcut.md`](docs/agents/codex-dependency-shortcut.md).

<!-- END:dependency-shortcut -->

<!-- BEGIN:bug-hunter-shortcut -->

## Bug-hunter shortcut

For the `bug-hunter` targeted defect-discovery shortcut, its execution rules, and its scope and safety limits, see [`docs/agents/bug-hunter-shortcut.md`](docs/agents/bug-hunter-shortcut.md).
<!-- END:bug-hunter-shortcut -->

<!-- BEGIN:codex-review-throttling -->

## Codex review throttling and routing

For Codex review throttling, branch routing, and review thread resolution guidance, see [`docs/agents/codex-review-throttling.md`](docs/agents/codex-review-throttling.md) and the historical [`docs/codex-review-protocol.md`](docs/codex-review-protocol.md) (background only, not an active workflow).

<!-- END:codex-review-throttling -->

<!-- BEGIN:local-server-safety -->

# Local server safety

- If the user says `run`, execute `npm run ensure` and return the printed URL.
- If the user asks for UI/frontend changes, browser QA, screenshots, mobile checks, or a local app link, run `npm run ensure` before opening or testing the app, even if the user did not say `run`.
- Never assume `localhost:3000`, `localhost:3001`, or `localhost:3002`.
- Never attach to a local server unless `/api/local-project-id` confirms it is this project.
- Do not kill or modify other projects' local servers. If the stable project port is busy, let `npm run ensure` choose the next safe project URL.
- Do not run a permanent watcher. Only start or verify the server when the current chat task needs the app or the user asks to run it.

<!-- END:local-server-safety -->

<!-- BEGIN:codex-desktop-worktree-setup -->

# Claude Code hook scripts

For the `.claude/hooks/*.sh` contract — the executable bit in the index, hook registration, line endings, failure behaviour, timeouts, and SessionStart output, see [`docs/agents/claude-hook-scripts.md`](docs/agents/claude-hook-scripts.md).

# Codex Desktop worktree setup

For Windows Codex Desktop worktree bootstrap and dry-run instructions, see [`docs/agents/codex-desktop-worktree-setup.md`](docs/agents/codex-desktop-worktree-setup.md).

<!-- END:codex-desktop-worktree-setup -->

# Reasoning effort calibration

For the Codex reasoning-effort baseline, the Cloud `xhigh` confirmation gate, and the
plan-effort/build-effort table, see
[`docs/agents/codex-reasoning-effort.md`](docs/agents/codex-reasoning-effort.md).

<!-- BEGIN:process-hardening -->

# Process hardening phases

## Bare PR publication is not readiness work

When the user says `open PR`, `create PR`, or `publish PR` without also requesting review, validation, readiness, or CI observation, treat it as a request to publish the prepared change promptly. GitHub is the requested verification surface.

- Inspect only what is necessary to avoid publishing the wrong change: the branch, base, staged/unstaged scope, and PR title/body. Reuse an existing dedicated branch or worktree rather than recreating it. Do not fetch, pull, rebase, review the ledger, inventory history, load a release/handover skill, or create a worktree unless it is necessary to keep unrelated work out of the PR.
- Do **not** run or wait for `npm run format`, dependency installation or linking, `npm run verify:pr-local`, tests, lint, typecheck, builds, browser checks, audits, generated-document synchronization, or CI. Do not invoke a release/readiness workflow for this request.
- If a local commit hook or a readiness-only push guard (format or static) is the only blocker, publish with `git commit --no-verify` and that guard's own scoped override (`SKIP_FORMAT_GUARD=1` or `SKIP_STATIC_GUARD=1`, as applicable) instead of `git push --no-verify`; do not spend time preparing dependencies or formatting solely to satisfy the hook. Never skip the push hook wholesale — the auto-merge ownership guard has no override and must never be bypassed, even for a bare-publication request. This exception is limited to the explicit bare-publication request and does not weaken normal-push safeguards.
- Create the PR immediately after the push, using the repository PR template where its policy fields apply. Report the URL and identify all local and hosted checks as unrun by request. Do not babysit CI, amend, or perform follow-up readiness work unless the user asks. This route overrides generic branch-bundling, handover, review, and babysit instructions.

- **For normal engineering pushes, run `npm run format -- --files <exact-owned-paths>` for every owned candidate/pushed file, including docs/config, and commit the result before push.** This rule does not apply to the explicit bare PR publication route above. Formatting is in neither `npm run test`, `npm run typecheck`, nor `npm run lint`, so the ordinary loop can report green while the changed-file CI check or exact-commit pre-push guard fails. Three CI failures on 2026-07-30 came from exactly this (two of them on `ci/circleci: verify`, since removed from the repo by PR #1412). Two traps beyond simply running it:
  - **Formatting without committing does nothing for the push.** A push sends commits, not your working tree, so formatting after committing leaves the unformatted blob on the branch. Amend or add a follow-up commit.
  - **Cover every owned candidate file.** A source-only check misses docs/config in the same push. Use the maintained literal-file formatter contract; `npm run format:all` is a separate whole-tree write requiring explicit scope and ownership. Policy changes also need the applicable explicit tree check. Never format or stage another owner's files to satisfy a gate.

  `.githooks/pre-push` contains the local push guard. Before relying on it, verify that
  `core.hooksPath` points to `.githooks` in this checkout and that the guard checks the actual
  remote URL. A missing hook or a command that bypasses it grants no permission to push to a
  different repository. Keep format and static checks scoped to the pushed commit.

For the verification principle, the tier table, and the rest of the gate-selection rules, see [`docs/agents/verification-gates.md`](docs/agents/verification-gates.md).

## Do not pay twice for the verdict GitHub is about to reach

For current Ward Flow gate selection, selector limits and evidence reuse, see [`docs/agents/task-efficiency.md`](docs/agents/task-efficiency.md). Unknown CI coverage requires running the selected gate or reporting it blocked; a declared workflow is not an observed verdict. The copied gate-claim examples in [`docs/agents/verification-gates.md`](docs/agents/verification-gates.md) require Ward-specific revalidation before use.
<!-- END:process-hardening -->

<!-- BEGIN:page-and-button-wiring -->

# Deleting code you believe is dead

For what must hold before removing an exported symbol, and the `check:dead-code-candidate` refusal list, see [`docs/agents/dead-code-deletion.md`](docs/agents/dead-code-deletion.md).

# Deleting tests, or letting a tool delete them for you

For the 2026-08-31 whole-file truncation incident (`#Y30AXB`), the `check:diff-integrity` test-case floor and truncation-artefact rules, and how a deliberate reduction is recorded in `diff-integrity.json`, see [`docs/agents/test-deletion-guard.md`](docs/agents/test-deletion-guard.md).

# Page and button wiring

For the button, navigation, new-route, and gate rules, see [`docs/agents/wiring-and-bundle-budget.md`](docs/agents/wiring-and-bundle-budget.md).

# Bundle budget

For the three `bundle-budget.json` safeguards, how chunks are attributed, and how to measure them, see [`docs/agents/wiring-and-bundle-budget.md`](docs/agents/wiring-and-bundle-budget.md).
<!-- END:page-and-button-wiring -->

<!-- BEGIN:search-chrome-behaviour -->

# Search chrome behaviour

PsychSift search chrome and clinical UI instructions do not apply to Ward Flow. Follow Ward Flow's approved design and screen verification documents for interface work.

<!-- END:search-chrome-behaviour -->

<!-- BEGIN:external-skill-precedence -->

# External skill precedence

For how repository contracts outrank generic external skills and output-style plugins, see [`docs/agents/external-skill-precedence.md`](docs/agents/external-skill-precedence.md).

## Evidence and calibration are never compressed

For the rules on pasting the decisive gate line, stating verified versus assumed, verifying third-party fix claims, and writing PR titles and descriptions as parsed input, see [`docs/agents/external-skill-precedence.md`](docs/agents/external-skill-precedence.md).
<!-- END:external-skill-precedence -->

<!-- BEGIN:ward-flow-provider-safety -->

# Ward Flow provider safety

Ward Flow does not use PsychSift's Supabase or Railway resources. A separate Ward Flow Railway
target was documented on 27 September 2026 in `docs/hosting.md`; those dated records do not prove
its current deployment state. Do not apply PsychSift migration, RAG or clinical database instructions
to Ward Flow. For any provider action, verify the named Ward Flow resource, data boundary and user
authority before acting.

<!-- END:ward-flow-provider-safety -->

<!-- BEGIN:api-confirmation-boundary -->

# API and provider confirmation boundary

- Never run, modify, test, or otherwise interact with Azure, GitHub/GitLab, hosted CI, production-like services, or provider-backed workflows without explicit user confirmation.
- Treat indirect API usage inside scripts, tests, release checks, PR tooling, and review automation as confirmation-required too.
- Prefer local, static, mocked, or offline checks. If a recommended verification would touch a provider, report the command and ask before running it.
- Live PR/CI tooling, Azure resource checks, and release gates that call providers are not automatic.
- The inherited `Run PR` shortcut is disabled in this repository; it targets PsychSift's PR queue.

<!-- END:api-confirmation-boundary -->

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

**Historical recovery incident — 29 August 2026; evidence for the current boundary-based rule below.** The
observed failure, 2026-08-29: seven files were formatted, the verifying test run was refused because
another worktree held the machine-wide lock, and attention moved to answering other sessions. The
files sat uncommitted for an hour, through a dozen unrelated commits, and were found only because an
unrelated status check happened to list them. Nothing about that hour felt like carrying risk. **The
work was finished and the mind had moved on — that combination is the hazard.**

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

**A worktree under `.claude/worktrees` has twice been removed mid-session on this machine** by
unrelated cleanup sessions. A commit is what makes that survivable: the branch ref and the objects
live in the shared repository at the top level, not in the worktree folder, so losing the folder
costs nothing but a fresh checkout. **An uncommitted file is the only thing that does not survive it.**

## When you genuinely cannot commit

Pre-commit checks the proposed index: staged source roots plus their imported dependencies/config from the same disposable index snapshot, using installed package resolution. Generated-document checks observe that snapshot with `--check`; they do not rewrite working-tree files or stage outputs automatically. Their default advisory or explicit strict result must be reported accurately. Unknown inputs, genuine staged-file/ownership conflicts and required gates still block as their contract requires.

Unrelated dirty or untracked component/test files alone do not freeze every commit. Stage named owned files only; never stage, move, discard or overwrite a peer's changes to clear a hook. If an actual guard blocks your coherent unit, name its exact paths/reason at the recovery boundary and coordinate release or an authorised scoped takeover. Keep the blocker and next action in the existing checkpoint.
