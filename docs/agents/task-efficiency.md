# Focused Ward Flow tasks

On-demand guidance for `BigSimmo/Ward-Flow`. Follow [AGENTS.md](../../AGENTS.md) and
[How we work](../ward-flow/HOW-WE-WORK.md). Keep one original objective across
repairs, retries and review; completion, user acceptance, merge and deployment are
separate states.

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
says Actions is disabled; live settings and runs remain unobserved. Its planner recognises only
`README.md` and Markdown under `docs/ward-flow/` as documentation-only; other
guidance paths retain conservative full CI selection. This page changes no gates.

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

The inherited arbiter currently reads an absent `ci.yml`; its fallback establishes
no CI coverage and keeps gates running. Ward's workflow declares PR, merge-group and manual events,
changed-file lint, generated route types with `tsconfig.json`, and reconciled unit
shards. These are not established equivalents of local gates. Do not infer
deferral from filenames or job names. Declared coverage, authorised pending
deferral and completed passing evidence are distinct. Unknown conditions remain
conservative; a skipped or deferred check is never a pass.

## Continue one task record

Reuse the task's existing checkpoint or handover; otherwise keep one checkpoint
in its private workspace. The [task ledger](../ward-flow-task-ledger.md) remains
the product task index; link relevant IDs without creating another status ledger.

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
