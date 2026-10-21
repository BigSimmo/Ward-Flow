# Ward Flow plans

_Updated 2026-10-21 - distinguish commissioned work from dated plans and completed checkpoints; Documentation owns._

Start at the [Ward Flow entry point](../README.md). Current work follows the agreed task scope,
source and [task-receipt contract](../../task-receipts.md); reuse IDs from the
[local task-detail index](../../ward-flow-task-ledger.md). [`STATUS.md`](../STATUS.md) records dated evidence.
This navigation update moves no files.

**Test scope.** The owner's 17 September speed rule in [`HOW-WE-WORK.md`](../HOW-WE-WORK.md) §5 supersedes
every per-task "Mutation:" line and "give every guard a mutation proof" instruction in the plans below.
Helpers run a mutation proof only when their brief names one.
Under the **21 September 2026 visual speed rules** ([`HOW-WE-WORK.md`](../HOW-WE-WORK.md) §5):

- Check only the affected view while working: at most one screenshot on the target viewport (desktop light by default). Never test all 6 viewport/theme combinations during active editing.
- Styling and layout tweaks alone must NEVER trigger the full ward suite (`check-ward-expected-reds.mjs`). Run only the focused component test if DOM structure changed.
- Check mobile (390px) and dark mode only once at the very end, and only if responsive layout rules were actually modified.
- Batch browser tool calls; avoid repeated back-and-forth element probing.

**Line numbers.** Each plan pins the commit its line numbers were read at. Re-find them before editing.

## Current

Current commissioned work is established by the owner's task scope, current source and existing task record under the [receipt contract](../../task-receipts.md). The [task ledger](../../ward-flow-task-ledger.md) indexes existing IDs; [STATUS](../STATUS.md) is dated history. Old plan checkboxes do not establish a current backlog.

- [WF-DOCORG-AUDIT-20261021](2026-10-21-documentation-organisation-repairs.md): local documentation and organisation repairs; the checkpoint records the implementation base, finding dispositions and verification state. Publication remains a separate stage.

## Dated records and previous work

These statuses describe the linked records, not a new assessment of implementation, hosted CI or deployment.

| Record                                                                                              | Recorded status and scope                                                                |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [18 October audit checkpoint](../../superpowers/plans/2026-10-18-full-audit-remediation-results.md) | Dated pre-integration checkpoint; its remaining checks are not a current task commission |
| [16 October audit results](../../superpowers/plans/2026-10-16-audit-resolution-results.md)          | Reconciled 17 October; records merged fixes and one upstream follow-up at that revision  |
| [17 October design audit plan](../../superpowers/plans/2026-10-17-design-audit-resolution.md)       | Dated plan; verify current task scope and source before resuming any item                |
| WF-DOCS-20261008 documentation repair                                                               | Completed local engineering stage, then archived; [restoration record](../../ARCHIVE.md) |

### Earlier historical inputs

- **Completed and archived:** WF-DOCS-20261008 documentation repair (see [ARCHIVE.md](../../ARCHIVE.md)): reviewed current-guidance corrections and maintained documentation gates; same task checkpoint and evidence.
- **Historical owner-answer context:** [Owner answers, second round](../archive/dated-notes/owner-answers-2026-09-17.md) ("Second round" section): R2-1 to R2-24 context; build briefs came from Ward Lead.
- **Historical retirement plan:** Retiring PsychSift from the Ward Flow folder (archived; see [ARCHIVE.md](../../ARCHIVE.md)): what Ward Flow used, what was safe to remove, what had to be untangled first, and the Railway leftovers at that time.
- **Historical removed plan:** Removing the rest of PsychSift, plan v1 (`docs/ward-flow/plans/2026-09-25-psychsift-removal-plan-v1.md`, removed in the 15 Oct 2026 docs trim): where the retirement stood after batch 3a, why the shared building blocks stayed put, the files that dragged PsychSift in, the mixed tests, and the proposed removal pass.

## Folded & Completed (Round 2)

Round 2 folded into the canonical ward line (`codex/task-ward-flow-live-state-20260831`) at commits `a7c7288668` and `6c33169b03`. Kept for historical reference. At that time, active open work and deferred items were tracked in [`STATUS.md`](../STATUS.md) and the task ledger.

| Plan                                                                              | Covers                                               |
| --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [Legal and clinical](2026-09-17-build-plan-legal-clinical.md)                     | Owner answers 1, 2, 4 to 12                          |
| [Referrals, journeys and transport](2026-09-17-build-plan-referrals-transport.md) | Owner answers 14 to 37 and 48                        |
| [Screens, service chooser and wording](2026-09-17-build-plan-screens.md)          | Owner answers 32, 38, 41, 43 to 45, 51, 52, 54 to 56 |

## Superseded (each file carries a banner)

| Plan                                                                                                      | Superseded by                       |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `2026-09-16-fix-plan-clinical-and-legal.md`                                                               | the 17 Sept legal and clinical plan |
| `2026-09-16-fix-plan-referral-model.md` (its R-numbers are still cited)                                   | the 17 Sept referrals plan          |
| `2026-09-16-fix-plan-screens-and-drawings.md`                                                             | the 17 Sept screens plan            |
| `2026-09-16-fix-plan-tests-and-fold-gate.md`                                                              | `HOW-WE-WORK.md`                    |
| `2026-09-16-drawings-new-look-with-rules.md` (restyle never applied)                                      | `STATUS.md`: drawings at HEAD       |
| `2026-09-15-gender-decides-both-bed-checks.md`                                                            | owner item 8, built                 |
| `2026-09-13-*` (command shell, dashboards, movements, navigation, product, full estate)                   | this index                          |
| `2026-09-12-visual-rebuild-wave-one.md`                                                                   | this index                          |
| `2026-09-10-third-edition-build-master-plan.md`, `2026-09-11-…-v2.md`, `2026-09-10-master-plan-errata.md` | this index                          |

Older research, lane and census files (`2026-09-11-*`, `2026-09-12-*`, `2026-09-1x-lane-*`, `2026-09-1x-communication-addendum.md`, the
`research-2026-09-10/` and records folders, and `REQUEST-QUEUE.md`) are historical inputs, not
task-status sources. Many of the plans named in this section were removed in the 15 Oct 2026 docs trim. `../ARCHIVE-NOTE.md` lists what went and how to restore it.

## Adding a plan

For new Ward Flow plans, use this directory regardless of the authoring tool. Link the plan from the
same task record and add a row here with its explicit status and evidence date. Existing plans under
`docs/superpowers/plans/` stay at their paths; do not duplicate or move them for naming consistency.
Mark a replaced plan with its successor. Follow [document conventions](../../DOCS-SYSTEM.md) and
record progress through the [task/receipt contract](../../task-receipts.md), not a new status ledger.
