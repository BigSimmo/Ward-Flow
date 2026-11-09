# Ward Flow: task lifecycle and receipt handoff

Owning repository: `BigSimmo/Ward-Flow`. These rules cover only this project.

_Updated 2026-11-09 - commits and the PR body are the record; receipts optional (D-107); Documentation owns._

**The record of a task is its commits and its PR body.** Receipts, the exporter and Notion
reconciliation are optional in prototype mode (3 October 2026). What is in flight lives in open
pull requests and the **Now** section of [the status page](ward-flow/STATUS.md); the plan lives in
the [roadmap](ward-flow/roadmap.md) (Josh, 7 November 2026). Notion is optional: use it when a task
already has a Notion record, never as the only record of current work.

The optional [Notion task source](https://app.notion.com/p/ba8c768f8b2c49638772b39900cb7ab9) uses data source `collection://ef3ca511-c488-4aba-ba1f-a5e20767a333` and an exclusive Project value `Ward Flow`. Do not add Ward tasks to the inherited PsychSift outstanding-issues system. [The product task ledger](ward-flow-task-ledger.md) keeps dated task detail.

## When a receipt is used

Keep one task identity. A retry or a new turn is not a new task. A short uninterrupted task needs
nothing beyond its commits and PR body; this is the one home of the compact-receipt rule, and other
pages link here. Substantial work that pauses, is blocked or changes hands records its state,
blocker, next action and evidence in the PR body or the existing checkpoint, not a new ledger.

Completion, user acceptance, merge, release and deployment are separate states. Only newly checked
evidence refreshes Last verified; a new timestamp alone does not.

## Local-only receipt bridge

`python scripts/export-task-receipt.py --input <sanitised-metadata.json> --output-directory <private-task-workspace>` writes a deterministic per-project/per-task JSON file. Python 3 is required; no packages, service, network or API key is used. Output stays local; an authorised parent session must verify its destination and reconcile it. Use one exporter writer per task. Do not place private receipt inputs in tracked Git.

Schema version 1: project, repository, source_identity (`repository:task_id`), observed_head, stale_source and task. Task allowlist: task_id, title, status, lifecycle (start/checkpoint/blocked/complete), blocker, next_action, evidence (locations only), last_verified (timezone-aware ISO timestamp or null), source_reference, source_revision, dependencies (project/task_id pairs), sanitised (true). Stable identity must be searched before creating a canonical row. Source reference is the existing task/checkpoint link, not full chat text.

Prepare the input manually or through an observable supported client event. Explicitly sanitise it: no transcripts, patient details, identifiers, credentials, .env contents or full log capture. The allowlist is not a content redactor. The exporter reads only the supplied bounded JSON and Git identity/revision. It does not open evidence locations. It rejects wrong repositories, unsupported fields/statuses, completion without evidence/time, and refreshing Last verified against unchanged evidence and revision. It flags a missing/mismatched source revision as stale; human review must also assess dirty inputs, dependencies and age. A receipt cannot prove its own factual claims.

Since 3 October 2026 the parent's bounded hourly reconciliation is optional, like Notion reconciliation (see the Prototype Mode Note above); when it runs, it covers only accessible task results. Inaccessible desktop, CLI, IDE and other chats have no universal event subscription here: their client must emit the receipt or the owner must hand it over. No real-time coverage or external delivery is claimed. Export success is not reconciliation success.

## Client loading and contributions

Codex and Cursor Agent use the root AGENTS.md. Claude Code uses CLAUDE.md and its @AGENTS.md import. Gemini CLI uses GEMINI.md by default; this adapter directs the session to applicable project safeguards and this procedure. Antigravity supports AGENTS.md/GEMINI.md, but its documented rule-file/aggregate budgets can truncate large project chains; inspect native loaded context before claiming coverage. No Cursor duplicate rule or Antigravity copy is required solely to repeat the same AGENTS guidance.

Use the supported global adapter for shared master preferences; the maintained source is the user's ai-rules/global-rules.md. Propose evidence-backed shared changes to that source's owner; update relevant owned project documentation and the same task receipt locally. Do not copy the master or create another ledger. A source change, a file sync and actual loaded context are separate evidence states.

Load instructions from the current checkout selected as the client's workspace. Record its repository, branch and revision, then start a fresh session or use a supported context reload and verify the loaded instructions. These documents are integrated into the dedicated Ward repository; they do not require a particular historical task worktree. Use reviewed repository integration for any new branch-only changes. An existing chat can retain older context; file changes do not retroactively enforce instructions. No universal event capture is installed.
