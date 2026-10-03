# Focused Ward Flow tasks

On-demand guidance for `BigSimmo/Ward-Flow`. Follow [AGENTS.md](../../AGENTS.md) and
[How we work](../ward-flow/HOW-WE-WORK.md). Keep one original objective across
repairs, retries and review; completion, user acceptance, merge and deployment are
separate states.

Complete the requested stage with its evidence: delivered audit, evidenced Fast Preview and
verified local engineering do not require unrequested integration/publication/deployment.
Use judgement for routine reversible choices; ask only when material uncertainty changes scope,
meaning, safety, ownership or authority, and continue independent authorised work. Read the
current entry/relevant rules/exact task row or checkpoint and affected code-map sections;
retain full history without making every task reread it.

## Task brief

```text
Objective/task ID: one observable user outcome and its original ID.
Repository/base: BigSimmo/Ward-Flow; worktree, branch and actual task base.
Scope/non-goals: owned files, permitted changes and explicit exclusions.
Acceptance: behaviour, required checks and independent review evidence.

Follow current instructions and domain rules. Inspect the minimum context that
establishes the failure and affected scope. Implement the smallest coherent
correction. Reuse existing selectors, coordination and valid receipts. Broaden
verification when policy or the failure class requires it. Do not duplicate
completed investigation, weaken gates or refactor unrelated code. Stop when
acceptance is evidenced or a precise blocker is reached. Report changed files,
check results, limitations and delivery state.
```

## Ward verification entry points

Inspect each script and its hooks before execution. Select checks for the actual
diff using [public CI policy](../ward-flow/PUBLIC-CI.md) and the declared
[workflow](../../.github/workflows/ward-flow.yml). The [hosting record](../hosting.md)
records disabled Actions at setup on 27 September 2026; a read-only GitHub check on 2 October 2026 found Actions enabled and Ward Flow CI active. Current-head results and deployment remain separate evidence.
Known maintained-policy changes use the shared local/CI classifier: installation/parity,
policy-contract tests, local doc links/commands and changed-file static checks. That scope
does not itself select the full unit/browser suites. Unknown paths, source or deleted files
retain conservative full selection; inspect the actual planner output and required gate.

- `node scripts/ward-ci-public/check-contracts.mjs` checks local workflow and scope
  contracts. `npm run docs:check-scripts` validates maintained npm command references.
- `npm run test:related -- --base <task-base> --dry-run` previews existing unit
  selection, including working-tree inputs. Fan-out caps leave work to the batch
  gate; focused results never prove the whole suite.
- `node scripts/ward-flow/select-journeys.mjs --base <task-base> --head HEAD --json`
  previews committed browser scope. Include pending edits before relying on that
  selection. `npm run test:e2e:ward-journeys` runs the Ward journey lane. Inspect
  selected journey and shared-foundation requirements in How we work. For browser
  work, first use `npm run ensure` and its verified project URL.
- `npm run receipts` inspects existing local receipts. Reuse only matching source,
  dirty/untracked inputs, command/selector, lock/dependencies, toolchain, fixtures
  and environment; artifact-dependent checks also need their artifacts. Record
  reused versus newly executed evidence. Unknown validity requires a run or blocker.

`npm run verify:pr-local -- --base <task-base> --dry-run` previews the shared classifier's
local commands; omit `--dry-run` for the normal selected local readiness stage. Source, tooling,
unknown, deleted or renamed inputs retain the full unit population and production Ward journeys.
The legacy `ready-check.mjs` runs exact merged-snapshot static/policy/backend compatibility checks
only. Its broad READY route is retired with exit 75; it cannot approve source-code or queued READY,
or consume later FULL/browser receipts. A compatibility pass supplies only its stated scope.
The Ward gate arbiter still runs locally when required; a declared workflow
does not supply an observed equivalent CI verdict or authorise implicit provider reads.
When browser work is selected, the local planner uses `test:e2e:ward-journeys`; `--extended`
is retained for compatibility and does not change its coverage.

CI observation is separately authorised and provider-gated. Any permitted evidence reuse or
deferral needs the exact Ward repository, head, `ward-flow.yml` workflow and check scope;
workflow declarations/job names alone are not equivalent coverage. Unknown, unavailable or
mismatched CI identity supplies no reusable verdict. Declared coverage, authorised pending
deferral and completed passing evidence are distinct; a skipped or deferred check is never a pass.

For owned formatting, use `npm run format -- --files <owned-path> ...`: literal selected paths,
ownership validation and partial-staging protection; no automatic staging or whole-tree write.
`format:all` is a separate explicit operation. Changed formatter policy/configuration requires
the broader format check, not a broader write. Generated-doc commit verification reads an index
snapshot via `scripts/check-staged-docs.mjs`; it does not regenerate the working tree. Mandatory
Ward indexes fail on drift; general documentation checks report advisory versus strict mode.

## Continue one task record

Follow the [task/receipt workflow](../task-receipts.md). For a simple uninterrupted
task, contribute a brief update to its existing receipt; no separate checkpoint is
needed. Substantial work reuses one canonical checkpoint or handover under the
original task identity, keeping private evidence in its existing workspace. The
[local task index](../ward-flow-task-ledger.md) links task detail; the canonical
source owns current status. Do not create another status ledger.

The compact route requires the receipt workflow's ownership, provider/publication
and recovery conditions. A pause, blocker, transfer or scope change still needs a
prompt update; file claims and project gates remain binding.

```text
objective/task ID | repo/worktree/branch/base/HEAD | owned files + diff hash
constraints | decisions + rejected hypotheses | checks/receipts + input identity
primary evidence paths/hashes | blocker | next exact action
```

Resume: read this checkpoint and applicable instructions. Validate relevant drift
and receipt inputs. Resume from the next action. Reopen completed investigation
only when evidence, acceptance or relevant inputs changed. Keep primary evidence;
a summary cannot replace it.

## Private measurement

Keep actual account/session observations outside tracked Git, in the existing
private task workspace or ignored `.local/`. Link them from the same checkpoint.
Manually record original objective ID; repo/base/result revision; task class;
requested/observed routing when exposed; acceptance; observed credits and source;
retries, child sessions and reviews; checks run/reused; elapsed time; human
corrections. Missing values are `unknown`, never zero.

Within a defined cohort, include failed and abandoned attempts. Divide observed
total credits by accepted original objectives; no accepted objectives means an
undefined ratio. Deduplicate cumulative telemetry and overlapping account
intervals. Keep token estimates, external cash and local/CI compute separate.
Collect during ordinary future work only when telemetry is already available;
no paid replay or account scraping. Document size is only a proxy. These edits
establish neither global Codex setting changes nor realised credit savings.

For a single uninterrupted scoped reversible task without unresolved ownership, a new provider/
publication boundary or substantial recovery need, one final compact lifecycle contribution can
carry start/completion metadata. Update immediately at a genuine pause/blocker/transfer/scope
change, and at meaningful checkpoints for substantial work. Reuse the original task identity;
Last verified needs newly checked evidence, such as a new immutable run-evidence location in
that same record. Timestamp-only refresh is invalid.
