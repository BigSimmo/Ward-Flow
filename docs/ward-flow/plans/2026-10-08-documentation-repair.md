# WF-DOCS-20261008 — documentation review and repair

Original objective: review Context7 and the repository documentation, then implement the
reviewed fixes requested by the owner on 8 October 2026. This checkpoint continues that
objective; it is not a new task/status ledger.

- Repository: `BigSimmo/Ward-Flow`.
- Base: `e7b7f325346ea7abb5004bd2e60e63f64f5c9f95` (`origin/main` inspected locally).
- Branch: `codex/documentation-repair-20261008`, isolated from the original checkout.
- Stage: local engineering completed.
- Status: Completed. All nine documentation findings and the reported lint blocker are repaired;
  the corrected candidate passed every selected local gate. The two existing UI wiring gaps
  exposed by the cleanup are explicitly recorded below. Exact file claims are recorded through
  `WARD_SIGNOUT_FILE` and released at handoff.
- Scope: nine documentation findings, maintained Context7 guidance, navigation and
  targeted maintenance improvements; the requested continuation clears the reported lint blocker.
  Preserve historical records and approved product rules.
- Next action: none for this local implementation stage. Publication, hosted CI observation and
  deployment remain separate stages.

## Evidence contract

Record newly executed checks, failures and unrun stages here. A documentation generator's
passing structural check does not refresh a visual verdict or prove hosted behaviour.
Use the existing [task-receipt contract](../../task-receipts.md).

## Maintenance dispositions

The existing organisation `canonicalSources` remains the reviewed reference registry; no
unsupported schema fields or competing manifest were added. Always-loaded incident narrative
was extracted to `docs/agents/recovery-history.md`, retaining core operational rules and headings.
The client must reload instructions to observe these file changes; no live client-load claim is made.
The general wiring catalogue now links directly to the maintained Ward guide and preserves its
original body behind paired historical markers, keeping foreign paths out of current instructions.

The 204 code-span path candidates occur in 35 documents. They are not 204 broken links.
The structural gate checks links, not arbitrary code spans or incident quotations. No missing
foreign module is recreated and no retirement/incident record is rewritten. The scoped
current wiring guide is `docs/agents/wiring-and-bundle-budget.md`; foreign examples in the
older wiring catalogue are background. Dated code maps and completed registers remain history.

| Candidate document                                                                   | Occurrences | Disposition                                                                                        |
| ------------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------- |
| `docs/agents/test-deletion-guard.md`                                                 | 3           | Quoted truncation incident and historical test paths; preserve evidence.                           |
| `docs/agents/verification-gates.md`                                                  | 1           | Explicitly absent foreign workflow; preserve the explanation.                                      |
| `docs/design-system/COMPONENTS.md`                                                   | 9           | Historical PsychSift design/specification evidence; current Ward appearance remains authoritative. |
| `docs/design-system/DECISIONS.md`                                                    | 2           | Historical PsychSift design/specification evidence; current Ward appearance remains authoritative. |
| `docs/design-system/FIX-GUIDE.md`                                                    | 4           | Historical PsychSift design/specification evidence; current Ward appearance remains authoritative. |
| `docs/design-system/SPEC.md`                                                         | 14          | Historical PsychSift design/specification evidence; current Ward appearance remains authoritative. |
| `docs/design-system/sweep-fix-visible-live-regions.md`                               | 28          | Historical PsychSift design/specification evidence; current Ward appearance remains authoritative. |
| `docs/mockup-retirement-policy.md`                                                   | 6           | Retirement/index examples; missing retired assets do not commission restoration.                   |
| `docs/ward-flow-phase-3-workspace/progress.md`                                       | 3           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow-phase-3-workspace/task-12-addendum.md`                               | 1           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow-phase-3-workspace/task-4-report.md`                                  | 1           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow-phase-3-workspace/task-4-review.md`                                  | 1           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow-phase-3-workspace/task-6-report.md`                                  | 2           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow-phase-3-workspace/task-8-report.md`                                  | 3           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow-safety-checklist.md`                                                 | 1           | Retired checklist; now visibly historical with paired markers.                                     |
| `docs/ward-flow-task-ledger.md`                                                      | 19          | Task history and former source references; not a current executable path contract.                 |
| `docs/ward-flow/PARALLEL-MULTI-AGENT-BUILD-PLAYBOOK.md`                              | 1           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/cleanup-awaiting-approval.md`                                        | 2           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/code-map/frame-and-psychsift.md`                                     | 10          | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/code-map/overview.md`                                                | 1           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/code-map/screens-b.md`                                               | 1           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/code-map/scripts-and-tooling.md`                                     | 28          | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/code-map/tests.md`                                                   | 2           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/merge/playwright-config-resolution.md`                               | 4           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/plans/visual-rebuild-full-estate/PROGRESS.md`                        | 3           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/plans/visual-rebuild-wave-one/PROGRESS.md`                           | 3           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/register/ward-builder-one-findings.md`                               | 1           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/register/ward-builder-two-findings.md`                               | 1           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/retired-psychsift-code.md`                                           | 10          | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/sdd-rescued/ward-statistics-skeleton/task-register-repair-report.md` | 1           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/triage/reexport-blindness-sweep.md`                                  | 19          | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/triage/wf-build2-006-batch-b.md`                                     | 1           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/ward-flow/triage/wf-build2-006-batch-c.md`                                     | 1           | Dated report, source snapshot or retirement record; preserve the original path evidence.           |
| `docs/wiring-conventions.md`                                                         | 13          | Ward guide linked directly; original mixed catalogue preserved behind paired historical markers.   |
| `mockups/README.md`                                                                  | 4           | Retirement/index examples; missing retired assets do not commission restoration.                   |

## Documentation-stage implementation checkpoint

Current guidance, source/version documentation, architecture sections and local/CI gate wiring
are implemented. The exact locked installation passed parity (Next 16.3.8, Vitest 4.1.11).
Focused checker/policy regression run: 9 files, 71 tests passed, including missing/reversed
architecture boundaries. Owned tooling lint and formatting passed. Architecture coverage,
CI contracts and inventory passed; the final inventory is 161 script files and 118 npm scripts.
The maintained-section link gate checked 1,319 tracked Markdown files with zero broken links
and 30 advisory references outside supported validation. The historical Ward path gate passed.

Selected acceptance against the actual base completed runtime, formatting, diff integrity,
all documentation gates, installed-lock parity, CI scope and 24 backend tests. It stopped at
lint: 34 unused-code warnings in `src/components/ward-management/ward/ward-screen.tsx`,
which has no changes from the task base. The remaining selected gates were executed separately.

The pinned Chromium download returned HTTP 403 (`Domain forbidden`). The repository-supported
executable override used installed Chromium 151.0.7922.173 for local journey evidence;
that evidence does not establish the pinned browser revision or hosted CI. No hosted actions,
publication, merge, deployment or visual-verification refresh have been performed.

## Documentation-stage execution evidence — 8 October 2026

The implementation was preserved as `92d198fc4cf21189a7153c6d09564e11b85f9aa3` before the
clean-tree FULL gate. Its evidence is local and scoped to that commit:

| Check                              | Result                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| Root typecheck                     | Passed                                                                                            |
| FULL unit gate                     | 926 files; 10,697 executed tests passed; 146 collected tests skipped; zero failures               |
| Production browser build/typecheck | Passed; 50 static pages generated                                                                 |
| Ward browser journeys              | 120 passed, one existing skipped probe, zero failures; 7.5 minutes                                |
| Browser skip                       | `ui-ward-forced-colors.spec.ts:306`, the existing unresolved custom-property probe                |
| Commit hooks                       | Staged scan, nine tooling lint files, four scoped typecheck files and generated-doc checks passed |
| Broad lint                         | Blocked: 34 warnings in unchanged `src/components/ward-management/ward/ward-screen.tsx`           |

The documentation-stage follow-up at `58322f4` changed only this checkpoint and
`docs/wiring-conventions.md`; documentation gates and owned formatting covered it. At that
commit, source, tooling and tests were identical to the unit/browser-verified implementation. The browser runner and the temporary
identity-verified development server were stopped; the original checkout remains untouched.

Execution logs and the immutable FULL receipt are retained in the execution workspace at
`/workspace/review-artifacts/`, including `docs-repair-full-unit-receipt.json`,
`docs-repair-browser.log` and `docs-repair-acceptance.log`. The initial acceptance log stopped
at lint; the separate logs above supply the later typecheck, FULL and browser evidence.

## Owner-requested continuation — clearing the lint blocker

The owner requested implementation again after the blocker was reported. Continue the same
`WF-DOCS-20261008` task and branch; no publication or deployment was requested.

Removed unreachable private handlers, their unused state/derived values and unused imports from
`ward/ward-screen.tsx`. Shared exports, reducers, models and styles remain intact. All 28 retained
function declarations are structurally unchanged. The six JSX roots are unchanged apart from one
obsolete local observation update in the capacity reset button; its active value/revision updates
remain intact. Existing arrival, discharge, capacity, refusal and focus paths retain their handlers.

The focused screen lint passed with zero warnings. Eight existing test files passed, covering
64 tests across the Ward screen, morning rollup, refusal, bed release, daily-return rows, leave
records and day-aware release parsing. No tests were deleted or lint rules weakened.

The first continuation candidate, `d819367011e4518c2c8db146f193c97666fe43cc`, passed all selected
static/documentation/backend gates, including broad lint and root typecheck. Its complete FULL
run covered 926 files and 10,697 executed assertions, but failed in two contract files (three
assertions). Browser journeys were not reached. The immutable failed receipt is
`/workspace/review-artifacts/docs-repair-lint-full-unit-receipt.json`.

The contracts exposed stale evidence in the unused scaffolding. `RECORD_LEAVE_BED` and
`RECORD_WARD_INTAKE_CONSTRAINTS` had no rendered callers before this cleanup; their private
handlers had falsely satisfied the source-name scan. They are now recorded in the existing
known-gap register with reasons and explicit closure conditions. These two existing UI gaps
remain open; this repair does not claim to implement their missing controls.

The preparation-control statistics claim's page prose was retired under Q004 on 13 September.
Its remaining citation pointed to the unused `dischargedBedReleases` filter. Removed that
obsolete claim rather than redirecting it to unrelated code, retaining the retirement reason.
The exact model/retired counts move from 80/54 to 79/53; all 26 active page claims and their
checks remain. Corrected Ward comments that still described the removed forms. No reducer,
permission, expected-red manifest or rendered interaction changed in this follow-up.

The coherent correction was committed before fresh selected acceptance against `origin/main`.
The source-register change required fresh FULL evidence rather than the test-only bounded recheck.
New evidence is stored under `/workspace/review-artifacts/docs-repair-lint-*`, including
`docs-repair-lint-structure.json` and `docs-repair-lint-focused-tests.log`.

## Completed continuation — local acceptance evidence

The corrected candidate is `b8cc97793d2036b9da2a5425a24ecc0c622ffec6`. The selected local gate
against `origin/main` passed all 15 selected commands with no failures or unreached commands:

| Check                                                              | Result                                                               |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Runtime, formatting and diff integrity                             | Passed                                                               |
| Documentation links, script references, architecture and inventory | Passed; zero broken maintained links                                 |
| Installed-lock parity and CI scope                                 | Passed                                                               |
| Backend checks                                                     | 24 passed                                                            |
| Repository-wide lint                                               | Passed with zero warnings; the earlier 34-warning blocker is cleared |
| Root typecheck                                                     | Passed                                                               |
| Fresh FULL unit gate                                               | 926 files; 10,697 passed; 146 collected tests skipped; zero failures |
| Production browser build/typecheck                                 | Passed; 50 static pages generated                                    |
| Ward browser journeys                                              | 120 passed; one existing skipped probe; zero failures; 7.5 minutes   |

The two corrected contract files also passed their focused run (22 tests). The fresh FULL
run includes those corrections and all earlier passing files; no failing test was placed in the
expected-red manifest. The known-gap register records the missing leave-recording and
intake-constraint controls as open gaps, not implemented features.

Local browser evidence used installed Chromium 151.0.7922.173 through the supported executable
override after the pinned revision download was blocked with HTTP 403. The unchanged skipped
probe is `tests/ui-ward-forced-colors.spec.ts:306`. This is selected local Ward journey evidence;
it does not establish the pinned browser revision, hosted CI or a new visual-verification verdict.

The immutable passing receipt is
`/workspace/review-artifacts/docs-repair-lint-final-full-unit-receipt.json`; the complete selected
run is `/workspace/review-artifacts/docs-repair-lint-final-acceptance.log`. The earlier failed
receipt/log are retained as failure evidence. The browser runner and identity-verified local
servers have stopped. The original checkout remains clean and untouched.

The completion follow-up changes only this checkpoint. Source, tooling and tests remain identical
to the verified candidate above; final documentation checks and formatting cover the record update.
No publication, merge, deployment or provider mutation was performed.
