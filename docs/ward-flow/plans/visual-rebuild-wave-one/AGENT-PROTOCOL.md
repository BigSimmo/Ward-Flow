# Agent working protocol — visual rebuild wave one

Read the [progress ledger](PROGRESS.md) first, then the [plan](../2026-09-12-visual-rebuild-wave-one.md) and only the task-specific brief needed for your assignment. The parent Ward Flow control contract (`docs/ward-flow/control/README.md`) is gone — deleted with WLQ-33; [`HOW-WE-WORK.md`](../../HOW-WE-WORK.md) owns how work is picked up. This folder tracks temporary children of the current task; it does not activate another persistent Lead, Builder or Verifier.

## One owner for each kind of truth

| Information                                                                | Authoritative location                                                                    | Writer                                               |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Requirements, dependencies, model routing and verification budget          | Dated implementation plan                                                                 | Controller                                           |
| Current task states, next action, assignments and message acknowledgements | `PROGRESS.md`                                                                             | Controller                                           |
| Cross-chat source ownership                                                | gone — `control/work-claims.md` deleted with WLQ-33; coordinate via STATUS and the ledger | Controller                                           |
| Exact assignment                                                           | `tasks/task-N-brief-rK.md` in this folder                                                 | Controller                                           |
| Implementation result and proposed handoff                                 | `tasks/task-N-report-rK.md`                                                               | Assigned implementer                                 |
| Independent review                                                         | `tasks/task-N-review-rK.md`                                                               | Assigned reviewer                                    |
| Durable question or cross-task request                                     | `messages/task-N-message-NNN.md`                                                          | Sender; controller records acknowledgement in ledger |
| App/mockup differences and visual verdicts                                 | Existing `screen-verification.json` and linked evidence                                   | Controller after reviewing actual evidence           |
| Programme decisions and unrelated outstanding issues                       | Existing Ward Flow ledger and decision documents                                          | Existing authorised owner                            |

Create task/message files only when needed; do not pre-create empty reports. Keep briefs and reports in this repository folder so a new task can resume without chat history. Temporary full diffs, logs and screenshots can use `.superpowers/sdd/2026-09-12-visual-rebuild-wave-one/`; the durable report must preserve the decisive evidence and link to every required artefact. Do not delete that workspace or any protected artefact. The SDD scratch `progress.md`, if created by a helper, is a pointer to the canonical ledger here and contains no second task table.

## Dispatch and handoff

1. Controller checks current work claims and the applicable lease, then records exact file ownership and task state BEFORE dispatch. A stale-looking claim is not permission to take another worker's files. Never edit another owner's shared file.
2. Controller writes the brief with current plan hash, app HEAD and scoped dirty-diff/file fingerprints. Workers read their brief, not a copied conversation. At most three child agents; explicit model/effort per the plan. No recursive spawning.
3. Worker acknowledges task ID, brief revision and owned paths through the collaboration channel before editing. Controller records that acknowledgement in the ledger. Tool delivery alone is not receipt.
4. Worker changes only owned files. Unbriefed shared changes become a durable message naming the exact requirement; independent work can continue. Clinical/role decisions do not become worker assumptions.
5. Worker saves a report BEFORE sending its completion message. A returned message is a pointer to the report, not the handoff itself. Report includes retained app-only behaviour and every omission/deviation.
6. Controller checks actual diff scope, supplies one frozen diff package and the report to an independent reviewer, then records the review. A reviewer does not repeat unchanged passing tests or expand into unrelated code.
7. Controller alone schedules tests/browser work, records exact commands and runner summaries, and updates task status. Queue requests; never let workers launch competing suites. Reuse evidence unless its relevant inputs changed.
8. Controller updates the checkpoint and append-only activity at dispatch, blocker, handoff, accepted review, verification, plan change and before ending a turn. No per-tool bookkeeping. Finish each update with the next executable action.

## Compact brief template

```text
Task ID / brief revision:
Plan path / SHA-256:
App HEAD / scoped input fingerprints:
Model / effort / routing reason:
Goal and exact acceptance conditions:
Owned source and test paths:
Inputs / shared interface version / dependencies already accepted:
Drawing and current contract paths:
App-only items that must survive:
Authorised checks (controller schedules execution):
Report path:
Stop conditions: ownership conflict, unsupported behavioural decision, provider or destructive action.
No Git writes, no protected moves/deletions, no subagents.
If you reach a decision this brief does not cover, stop and hand it back.
```

## Compact result/review template

```text
Task ID / brief revision / actual agent model:
Status: implemented | partial | blocked | review-approved | changes-requested
Input plan hash / app HEAD / output diff or file fingerprints:
Changed files:
App-only retention and deviations (each with its reason):
Checks: exact command, named input files, decisive summary, evidence path; or unrun with reason.
Visual evidence: actual route, served drawing hash, width/theme cells, state, reviewer identity.
Spec verdict / code-quality verdict (reviewer only):
Human acceptance: pending unless actually obtained.
Open findings / shared-file requests:
Next action and intended recipient:
```

## Resume and drift checks

On resumption, read the checkpoint and inspect branch, HEAD, scoped dirty state and active owners. Compare the plan file's hash to the saved hash below. A changed plan is a reason to reconcile affected briefs, not to repeat the whole programme.

Run this read-only check from the repository root:

```powershell
$waveLedgerPath = 'docs/ward-flow/plans/visual-rebuild-wave-one/PROGRESS.md'
$wavePlanPath = 'docs/ward-flow/plans/2026-09-12-visual-rebuild-wave-one.md'
$waveLedgerText = Get-Content -LiteralPath $waveLedgerPath -Raw
$waveRecordedHash = [regex]::Match($waveLedgerText, 'Plan SHA-256: ([A-Fa-f0-9]{64})').Groups[1].Value
$waveActualHash = (Get-FileHash -LiteralPath $wavePlanPath -Algorithm SHA256).Hash
if (-not $waveRecordedHash -or $waveRecordedHash -ne $waveActualHash) { throw 'PLAN_DRIFT: reconcile changed requirements and affected briefs before dispatch.' }
Write-Output 'PLAN_HASH_MATCH'
$wavePlanIds = @([regex]::Matches((Get-Content -LiteralPath $wavePlanPath -Raw), '(?m)^### Task (\d+):') | ForEach-Object { $_.Groups[1].Value })
$waveLedgerIds = @([regex]::Matches($waveLedgerText, '(?m)^\| (\d+) \|') | ForEach-Object { $_.Groups[1].Value })
if (($wavePlanIds -join ',') -ne ($waveLedgerIds -join ',')) { throw 'TASK_LEDGER_MISMATCH: reconcile the plan and task ledger.' }
Write-Output ('TASK_LEDGER_MATCH=' + $wavePlanIds.Count)
```

When the plan changes, controller records why in the activity log, updates the saved hash, supersedes affected briefs with a new revision and gets acknowledgement from affected active workers. Do not overwrite an issued brief silently. An unchanged completed task stays complete unless the changed requirement invalidates its evidence.

When application files or shared components change, compare the report's scoped input/output fingerprints and reopen only impacted acceptance cells/checks. A clean app HEAD alone cannot describe uncommitted work. Link changed drawing hashes to the existing manifest/verification mechanism; do not weaken it or substitute the plan hash for the drawing hash.

Before reporting readiness, account for every required task, unacknowledged message, open review finding, required check and visual matrix cell. Missing evidence stays missing. This workflow detects recorded inconsistencies; it cannot prove an unrecorded change did not happen, or replace independent looking.
