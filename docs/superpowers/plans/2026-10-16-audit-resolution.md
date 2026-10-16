# Ward Flow audit resolution implementation plan

> **For agentic workers:** Execute the six bounded workstreams below with the harness subagent tools. The user explicitly requested planning and implementation with multiple subagents; no additional plan approval pause is needed. Use the existing test, ownership and verification contracts.

**Goal:** Resolve or accurately disposition all 44 retained findings against current main, with reproducible evidence and a reviewable local branch.

**Architecture:** Keep existing Ward Flow reducers, shared client/provider and screen models. Make small fixes at the owning boundary, use pure derivations for consistent figures and retain provider-neutral local integration tests. Integrate independent owned commits serially into the task branch; do not merge or alter unrelated PR branches.

**Tech stack:** Existing Next.js, React, TypeScript, Vitest, Playwright, Node.js and PostgreSQL tooling; exact repository lockfiles.

**Spec:** [audit-resolution-spec](2026-10-16-audit-resolution-spec.md).

## Global constraints

- Base: `c9f271a98c96551bc3b3a725923461c02344a1f2` from verified Ward Flow main; prior appraisal `5ddeb7d5`.
- Work only in task-owned worktrees, with exact file claims in the shared environment log `/home/agent/ward-flow-logs/sign-out.md`; use `WARD_SIGNOUT_FILE` for every formatting/commit command.
- Keep existing design tokens, synthetic-only records, role/place boundaries and D-18 persistence behavior.
- Read installed Next.js documentation before Next/React-facing changes; source/tests outrank generic skill prescriptions.
- No Supabase/Railway/GitHub/GitLab calls, hosted CI, deployment or remote push during local implementation. Registry dependency inspection and disposable loopback services only when needed; retain proxy settings and secret boundaries.
- Run focused tests under the shared task lock `/workspace/ward-flow-audit-implementation/focused.lock`, at most two workers. One wide integration gate at a time after workers finish.
- No deletion, history rewrite or disabling gates. Preserve original checkout, audit artifacts and worktrees.
- Run format on exact owned paths before coherent commits. Stage named paths only; do not bypass ownership hooks.

## Review focus

1. Delayed/refused/conflicted/retried shared commands must never emit accepted feedback or an actionable Undo before acceptance; correlate the terminal result to the exact command.
2. Malformed or legacy restored values must fail at validation or degrade safely, while valid producer state still loads and renders.
3. Scope changes, reset/reload and transfer/release transitions must not reuse stale patient access, bed numbers, prior-world comparisons or discharge metadata.
4. Threshold, weighted-mean and waitlist boundary cases must agree across rendered models; formatting must not change classification.
5. A workflow guard must reject executable omissions/decoys, release failures and missing coverage populations without converting intentionally scoped skips into false failures.

## Workstream 1: domain validation, holds and acknowledgement

**Owner:** domain agent. **Issues:** R02, R05, R06, R07, R10, R24, R25, R44.

**Files:** `ward-flow-storage-validation.ts`, `handover/handover-model.ts`, `delays/delays-derivations.ts`, `ward-demo-network.ts`, `ward-inbox-reducer.ts`, `ward-flow-reducer.ts` and relevant reducer slices/audit helpers under `src/components/ward-management/`; narrow existing or new `tests/ward-*` regressions. Claim exact paths before edits.

**Interfaces:** Preserve public reducer event/state shapes. Validate optional expiry as a finite instant when present; printed due text must tolerate unexpected data. Reuse `bedHoldLapsed`; distinguish stale-only capacity from true no-bed conditions. Audit scope refusal codes without widening permissions. Bind stand-down attribution to the actual role.

- [x] Write/port valid-input regressions: null/NaN expiry and valid control; unknown blocker and known/null controls; stale-only candidate; equality expiry; answered seeded ward recipient; AWOL acknowledgement and nonexisting-row refusal; wrong-ward departure scope code; stand-down actor attribution.
- [x] Run each focused file and confirm the intended assertion fails on this base. A previously fixed case is recorded as baseline verified.
- [x] Implement the smallest changes at the validation/derivation/writer boundary. Retain optional legacy fields only when genuinely supported.
- [x] Run the changed tests plus direct existing importers, format exact files, commit the coherent changes and report ID-to-test evidence.

## Workstream 2: statistics, overdue counts and calendar labels

**Owner:** metrics agent. **Issues:** R03, R04, R08, R09, R13, R27.

**Files:** `statistics/statistics-capacity-chart.tsx`, `statistics/statistics-compare-screen.tsx`, `statistics/statistics-derivations.ts`, `capacity/service-capacity-tracker.ts`, `ward/ward-screen.tsx`, `search/patient-census-view.tsx`; focused statistics/census/ward tests.

**Interfaces:** Share the existing displayed occupancy numerator; classify raw values before rounding. Pool admissions through existing stay statistics rather than averaging averages. Count actual declines without waitlist aliases. Reuse the canonical unfinished-arrival and floored-day helpers.

- [x] Add discriminating fixtures: pulled/occupied sort inversion, a just-under-threshold percentage rounding upward, unequal ward populations, waitlist/no-bed history, arrived movement retaining ETA, and a negative demo instant.
- [x] Observe red assertions before editing.
- [x] Replace divergent calculations with owning pure helpers; preserve labels and layout.
- [x] Run focused tests and changed-file type/lint checks as appropriate, format and commit exact files.

## Workstream 3: confirmed shared outcomes and UI recovery

**Owner:** outcomes agent. **Issues:** R01, R11, R12, R14, R22, R23, R26.

**Files:** `use-undoable-step.ts`, `ward-shared-client.ts`, `use-ward-supabase-shared*.ts`, `ward-flow-provider.tsx`, `coordinator/shortlist-panel.tsx`, `board/ward-board.tsx`, `coordinator/since-last-look*.tsx/ts`, `ward-flow-demo-storage.ts`, `settings/settings-screen.tsx` and focused DOM/client/storage tests.

**Interfaces:** Add or expose a command-specific completion result without breaking ordinary synchronous dispatch callers. The caller receives accepted/refused/failed/cancelled terminal status for its own dispatch; retries reuse the command identity, disposal/role/account changes settle pending results. `useUndoableStep` emits success/Undo only on its own accepted result. Local mode remains immediate and rejection-aware. Do not persist text or outcome payloads.

- [x] Pin delayed 200, 409, 422, 401, 5xx, queued cancellation/disposal and role/account-switch behavior; no early success or Undo, one truthful terminal result.
- [x] Pin shortlist cancellation/escalation feedback, active-transport release precondition and supported departure Undo with stale-record guards.
- [x] Pin save failure retaining old snapshot with an honest last-save label, same-scenario generation/user reset of last-look snapshots, and Perth export date around UTC midnight.
- [x] Implement the additive completion contract and update only owned consumers. Coordinate reducer changes with the domain owner instead of editing their files.
- [x] Run client/provider/hook and affected UI DOM tests, format and commit exact files. Report any necessary interface changes to the parent before integration.

## Workstream 4: CI semantics, CSRF and coverage/quarantine evidence

**Owner:** CI agent. **Issues:** R15, R16, R17, R19, R20.

**Files:** `.github/workflows/ward-flow.yml`, `scripts/ward-ci-public/check-contracts.mjs`, relevant CI planner/check scripts, `scripts/check-coverage-inventory.mjs`, `scripts/coverage-contract.mjs`, `scripts/flake-ledger.mjs`, `tests/api-csrf-proxy.spec.ts`, flake/coverage/workflow tests. Coordinate any root package script change with the dependency owner.

**Interfaces:** Workflow contracts inspect actual executable jobs/steps, predicates and shell status, with bounded YAML parsing or strict structural checks. Required verdict includes release-gate and handles genuine planner skips/reuse explicitly. Coverage inventory compares real executable files against produced LCOV using a declared population. Quarantine metadata binds to actual collected test identity; a valid nonempty ledger is allowed.

- [x] Reproduce the eight accepted broken workflow copies and add controls that distinguish valid scoped skipping from silently omitted work.
- [x] Pin release failure/missing/skipped outcomes, root/file coverage omissions, nonexistent LCOV paths, a real ledger entry, comment-only title decoys and the real protected route's allowed response.
- [x] Strengthen guards and wire required checks without reducing the population or weakening thresholds.
- [x] Run dependency-free CI self-tests and focused Vitest; report browser spec verification separately. Format and commit exact files.

## Workstream 5: documentation, reference-pack integrity and audit promises

**Owner:** docs agent. **Issues:** R21, R28, R29, R30.

**Files:** `docs/testing.md`, `docs/ward-flow-task-ledger.md`, clinical safety case and demonstration script, `docs/ward-flow/reference-data/pack_manifest.json`, `scripts/ward-flow/maintain-docs-and-organisation.mjs`, its focused tests. Coordinate workflow wiring with the CI owner; do not edit CI-owned paths.

**Interfaces:** Document the actual selected gates and selective audit boundary, distinguishing the event log and governance audit. Retain provider truth in DATABASE.md. Manifest integrity covers the declared directory population with explicit justified exclusions and truthful hashes; do not silently bless changed clinical facts.

- [x] Recheck stale prose against current source and identify exact remaining paragraphs.
- [x] Add a manifest omission regression; confirm it fails while known listed-file mismatches still fail.
- [x] Correct actual source references, testing/receipt promises and audit coverage wording. Investigate the two pack-file diffs, then regenerate only the appropriate integrity metadata.
- [x] Run maintained links, commands, fact and manifest checks; format exact files, commit and report any source-sensitive drift rather than changing clinical facts.

## Workstream 6: backend composition, dependencies and landed-fix verification

**Owner:** backend agent. **Issues:** R18, R31, R32, R43; revalidate R33–R42 after merged #365.

**Files:** `backend/ward-flow/*` tests/local test support only as required, package manifests/lockfiles, `docs/dependency-security-exceptions.md`, narrow backend/role-access/client regressions. Own root package files; coordinate script additions requested by other owners.

**Interfaces:** A disposable loopback database test must traverse the actual HTTP handler with authentication and real store, exercise accepted save/reload/conflict and cleanup only its owned namespace. Preserve existing runtime-role safety. Use supported PostCSS/Vite/Codspeed versions and keep Vitest/coverage majors coordinated. No provider credentials or live endpoint calls.

- [x] Inspect the existing portable local PostgreSQL harness and add the missing authenticated-handler/real-store composition test; demonstrate the test detects a broken composition.
- [x] Verify the merged scope, break-glass, held-bed, transfer, diversion, notification, contact and shortcut fixes against current tests and actual producer state. Record R41/R42 as closed only if merge state and their corrected regression cases verify.
- [x] Inspect package constraints and registry-supported patches; update the smallest supported dependency set and exact lock. Check the braces advisory separately; retain a bounded exception when no supported patch exists.
- [x] Run backend composition, relevant dependency/role/shared tests and locked install/audit checks. Do not call a skipped database test passed. Commit coherent changes with exact issue evidence.

## Integration and final verification

**Owner:** parent agent. **Files:** this plan/spec, sanitized implementation receipt, integration-only fixes and coordinated generated indexes.

- [x] Revalidate each worker's diff, red/green logs and exact commits; serialize local cherry-picks into `codex/resolve-audit-20261016`. Obtain claim releases before touching a worker-owned file.
- [x] Resolve integration type/interface differences without overwriting peers; maintain a 44-ID closure table with fixed, already fixed, upstream-blocked or concrete evidence-gap status.
- [x] Execute relevant formatting/lint, typecheck, full unit population and selected offline backend/browser checks; record each result separately in the receipt. Run `npm run ensure` before browser QA and verify `/api/local-project-id`; stop owned processes afterward. Checks were executed, but the complete unit and required browser gates are not passing; see the open verification items below.
- [x] Dispatch a fresh review agent over the complete branch. Fix material regressions with discriminating tests and rerun the affected checks; do not count optional uncommissioned concerns as blockers.
- [x] Check diff integrity, documentation/index/manifest acceptance and a clean owned working tree. Commit each coherent result as it becomes ready.
- [x] Deliver the detailed per-issue closure receipt, exact branch/commits, decisive checks and upstream/provider/browser limits. Do not claim merge, publication, deployment or clinical approval.

Progress and per-ID evidence: [audit-resolution-results](2026-10-16-audit-resolution-results.md). An implemented fix and a completed verification gate are recorded separately.

## Open verification and upstream work

- [ ] R43: adopt a supported patched upstream braces release when available; bounded exception review is due 22 October 2026.
- [ ] Obtain a passing complete unit receipt on the final head. The first complete run reported 16 failures across eight corrected suites; those eight suites then passed all 215 tests. Guarded reuse was refused. A new full attempt reported two timing failures in unchanged tests and was stopped after two completed batches to avoid continuing a known-failed run. No passing full-suite receipt is claimed.
- [ ] Investigate the citation-scan and capacity-observation timeouts without weakening assertions, populations or budgets. Their cause is unproven; both passed the earlier complete run.
- [ ] Complete required browser/build verification after the pinned Chromium download and dashboard readiness blockers are resolved. HTTP-only evidence is separate. Hosted CI, physical Safari and installed-PWA acceptance remain unobserved.
