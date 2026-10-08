# WF-DOCS-20261008 — documentation review and repair

Original objective: review Context7 and the repository documentation, then implement the
reviewed fixes requested by the owner on 8 October 2026. This checkpoint continues that
objective; it is not a new task/status ledger.

- Repository: `BigSimmo/Ward-Flow`.
- Base: `e7b7f325346ea7abb5004bd2e60e63f64f5c9f95` (`origin/main` inspected locally).
- Branch: `codex/documentation-repair-20261008`, isolated from the original checkout.
- Stage: local implementation and verification; publication and deployment are separate.
- Status: In progress. No ownership conflict; exact owned files are signed out in the
  execution workspace's local log through `WARD_SIGNOUT_FILE`.
- Scope: nine documentation findings, maintained Context7 guidance, navigation and
  targeted maintenance improvements. Preserve historical records and approved product rules.
- Next action: preserve the implementation in a clean local commit, then execute the full
  unit and browser gates. Investigate existing application failures separately from doc repairs.

## Evidence contract

Record newly executed checks, failures and unrun stages here. A documentation generator's
passing structural check does not refresh a visual verdict or prove hosted behaviour.
Use the existing [task-receipt contract](../../task-receipts.md).

## Maintenance dispositions

The existing organisation `canonicalSources` remains the reviewed reference registry; no
unsupported schema fields or competing manifest were added. Always-loaded incident narrative
was extracted to `docs/agents/recovery-history.md`, retaining core operational rules and headings.
The client must reload instructions to observe these file changes; no live client-load claim is made.

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
| `docs/wiring-conventions.md`                                                         | 13          | Mixed legacy examples; use the maintained Ward wiring guide, not foreign catalogue paths.          |
| `mockups/README.md`                                                                  | 4           | Retirement/index examples; missing retired assets do not commission restoration.                   |

## Implementation checkpoint

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
which has no changes from the task base. Typecheck is running separately. The FULL unit gate
requires a clean committed candidate and will follow the implementation commit.

The pinned Chromium download returned HTTP 403 (`Domain forbidden`). The repository-supported
executable override can use installed Chromium 151.0.7922.173 for local journey evidence;
that evidence does not establish the pinned browser revision or hosted CI. No hosted actions,
publication, merge, deployment or visual-verification refresh have been performed.
