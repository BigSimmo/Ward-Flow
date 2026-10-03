# Ward Flow plans

Start at the [Ward Flow entry point](../README.md). Current work follows the agreed task scope,
source and [task-receipt contract](../../task-receipts.md); reuse IDs from the
[task ledger](../../ward-flow-task-ledger.md). [`STATUS.md`](../STATUS.md) preserves historical evidence. Rewritten
17 September 2026. Nothing here has been moved or deleted.

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

- [Owner answers, second round](../archive/dated-notes/owner-answers-2026-09-17.md) ("Second round" section): R2-1 to R2-24 context; build briefs come from Ward Lead.
- [Retiring PsychSift from the Ward Flow folder](2026-09-25-psychsift-retirement.md): what Ward Flow uses, what is safe to remove now, what must be untangled first, and the Railway leftovers.
- [Removing the rest of PsychSift, plan v1](2026-09-25-psychsift-removal-plan-v1.md): where the retirement stands after batch 3a, why the shared building blocks stay put, the few files that drag PsychSift in, the mixed tests, and the single removal pass.

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
task-status sources.

## Adding a plan

Create one dated plan here, add a row under "Current", and put a superseded banner (see `HOW-WE-WORK.md`
§9) on any plan it replaces. Record task progress in the ledger, not in a new progress file.
