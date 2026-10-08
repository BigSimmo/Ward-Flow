# Ward Flow — how we work

**How any AI builder (Claude, Codex, Gemini, Antigravity or another) picks up, builds, tests, commits and
hands back Ward Flow work.** Written 17 September 2026; repository and integration directions
updated 2 October 2026. The current repository's `AGENTS.md` governs operational safeguards;
this guide supersedes older process notes within that boundary. Start at [`README.md`](README.md).

> **The current rules are in this `BigSimmo/Ward-Flow` repository's `AGENTS.md`**, and Josh's
> standing rulings are in [`decisions.md`](decisions.md). Where this file differs from `AGENTS.md`,
> `AGENTS.md` wins. The former local Ward-line fold queue and lock are historical. Section 4
> describes how to prepare an integration candidate in the dedicated repository.

## 1. Picking up work

1. Read [`README.md`](README.md), then the agreed task scope and existing task/checkpoint
   under [`../task-receipts.md`](../task-receipts.md). Use the ledger
   [`../ward-flow-task-ledger.md`](../ward-flow-task-ledger.md) and relevant [`plans/`](plans/README.md)
   to locate existing IDs and decisions. [`STATUS.md`](STATUS.md) is dated historical evidence,
   not today's implementation state; verify current source before reviving an old task.
2. Check your folder: `git -C <worktree> status` and `git -C <worktree> log -5`. If files you did not
   touch are modified or staged, preserve them and resolve ownership before writes. Former
   Database fold-debt hooks are historical and are not part of this repository's startup.
3. **Prove the task is still outstanding.** Another tool may already have built part of it. Grep for
   the event names, strings and tests the plan names. If it is done, check it against the plan and fix
   gaps instead of rebuilding.
4. Line numbers in a plan belong to the commit the plan names. Re-find them before editing.
5. Build the authorised task and use judgement for routine reversible implementation choices.
   Historical CLARIFY/deferred rows do not commission new work. Preserve unresolved clinical,
   privacy, provider and ownership decisions; if the current task depends on one, record the
   specific blocker and continue independent authorised work.
6. Keep other tools' work. The owner's words: do not remove or significantly alter Antigravity's
   progress, design or builds; fix and perfect them.

### Mockups that become the site

Owner direction, 5 October 2026: create interactive mockups with the site's React/TypeScript
components, Next.js routes and CSS Modules. Reuse the shared synthetic records, provider and
reducer so approval leads to direct integration, rather than an HTML-to-React rewrite. Keep
preview controls separate; shared HTML previews bundle the same React components. Honour an
explicit request for another format. Verify only the affected behaviour and reuse valid evidence
on unchanged code, following the React mockup rule in `AGENTS.md`.

## 2. Branches and worktrees

**Updated 28 September 2026 for the dedicated `BigSimmo/Ward-Flow` repository.**

- Before any Git write, verify `git remote get-url origin` is
  `https://github.com/BigSimmo/Ward-Flow.git`. The old `D:/Worktrees/Database/ward-lead`
  checkout points to the separate PsychSift repository and is not a Ward Flow destination.
- **Every editing thread gets its own worktree and branch**, based on the verified Ward Flow
  `main` tip, so threads never share a working tree. Check the branch, status and base before editing.
  Read-only threads (reviews, questions, reports) need no worktree.
- **Sign out files before editing** in `D:/Repos/ward-flow-logs/sign-out.md` (outside git,
  one copy for every tool). An overlap needs the other owner's release or Josh's explicit scoped
  takeover approval. For a takeover, record each exact file as
  `path/to/file (approved takeover by Josh: <scope>)` on your own line, preserve the other session's
  edits and reconcile them through the authorised integration process. A folder-wide marker does not grant a takeover.
  Once the exact task ownership is handed back or integrated, append `RELEASED <date> | <owner> | <branch> | <reason>; repo=BigSimmo/Ward-Flow` to the shared
  append-only log. Follow [AGENTS.md](../../AGENTS.md) for the single-user exception:
  `SKIP_SIGNOUT_GUARD=1` is an explicit per-commit opt-in, never a hook default. Concurrent
  agent work retains sign-out and overlap protection. On another machine, `WARD_SIGNOUT_FILE`
  selects that environment's shared local log; never treat an unavailable desktop log as clearance.
- Reuse dependencies only from a trusted checkout of the same Ward Flow commit and lockfile.
  Never link to the old Database checkout; follow the current repository setup instructions.
- Within an approved task a thread edits and commits freely on its own branch. It does not touch
  another thread's worktree or branch.
- The shell's working folder resets between commands. Use `git -C <absolute path>` for every git
  command and absolute paths for every file.
- Scratch files go under `$TEMP`, never under `tests/` or `src/`. Never edit `.git/info/exclude`.

## 3. Commits

Format only owned literal candidates with `npm run format -- --files <owned-path> ...`.
The formatter validates ownership and refuses partial-staging overwrite; it does not stage.
Whole-tree formatting is a separately requested operation. Formatter policy/config changes
require a broader check, not implicit writes to other owners' files.

Generated-document commit checks read an index snapshot using `scripts/check-staged-docs.mjs`;
they do not rewrite working-tree generators. Mandatory Ward indexes fail on drift. General
doc checks report their advisory/strict mode, so a warning or skipped check is not a pass.

- Commit each coherent unit as you go, on your own branch only.
- Stage explicit paths. **Never `git add -A` or `git add .`. Never `git stash`.** Verify the
  destination and applicable authority before any push.
- Never merge or rebase other branches into your branch.
- The pre-commit checks inspect a disposable staged snapshot. Unrelated unstaged or untracked
  files do not by themselves block an owned commit. Preserve peers' files. If a real ownership
  conflict or required check blocks the commit, record its exact paths and reason in the existing
  task checkpoint; never overwrite a peer's files to clear a guard.
- Retain the test-deletion/truncation guard. Test-count floors are advisory by default and strict
  with `DIFF_INTEGRITY_STRICT=1`; truncation artefacts and unreadable before-state still fail.
  An approved reduction uses the existing exact record in `diff-integrity.json`. An advisory
  result is not a passing strict result. Use `--base <reviewed base>`.

## 4. Integration in the dedicated repository

- Before integrating, verify the target is `BigSimmo/Ward-Flow`, inspect the exact branch and diff,
  and run the selected checks on the candidate tree (§5). Reuse valid checks on identical inputs.
- Keep integration serial, backed up and reviewable. Follow the current `AGENTS.md` instructions for
  any lock, queue and preflight steps that still apply in the dedicated repository. Never run an old
  local-line fold command from an archived handover.
- A local commit, pull request, merge and deployment are distinct states. Obtain the applicable
  authority for each consequential action, and report which state was actually reached.
- After a pause, refresh the branch and target state before integrating. Preserve other threads'
  changes; do not rebase, force or reset unclear work.
- Historical fold incidents: [`archive/dated-notes/HOW-TO-FOLD-2026-09-10.md`](archive/dated-notes/HOW-TO-FOLD-2026-09-10.md).

- **Review server when visual review is needed** (the steward): `node scripts/ward-flow/review-server.mjs --dist
.next-playwright/<run-id>/dist [--port 3700]` serves a finished journeys build with the same offline
  mockup environment as the journeys, and writes `REVIEW SERVER | port | commit` to
  `ward-flow-logs/gate-running.md` while it runs. Keep that run's build folder for review with
  `PLAYWRIGHT_BUILD_ROOT_ID=<id> PLAYWRIGHT_KEEP_BUILD_ROOT=true`, but never reuse it for a test run.

## 5. Testing

**While editing.**

- Run the changed tests and useful direct importers while editing. For the normal local readiness
  stage, use `npm run verify:pr-local -- --base <actual-base>` in this dedicated repository. Its shared
  classifier selects the full unit population and production Ward journeys for source, tooling,
  unknown, deleted or renamed inputs; a related-test pass cannot supply that broader verdict.
  The legacy `ready-check.mjs` executes selected static/policy/backend compatibility checks on an
  exact merged snapshot only. Its broad READY route is retired with exit 75; it neither approves
  source-code or queued READY nor accepts later FULL/browser receipts. Existing compatibility
  checks still require verified Ward Flow destinations and this worktree's locked dependencies;
  remote-less scratch fixtures require `WARD_FOLD_TEST_FIXTURE=1`. Reuse only still-valid evidence
  for its actual scope at integration.
- No mutation proofs unless your brief names one. This overrides the per-task mutation lines in the
  16 and 17 September plans.
- "focused-test capacity is full" is a shared lock held by someone else. Wait and retry. It is never a
  pass or a fail.
- Run browser journeys when selected by the current gate or needed for the changed interface.
- **Visual & UI checks (owner's speed rule, 21 September 2026):**
  - Check only the affected view while working: at most one screenshot on the target viewport (desktop light by default). Never test all 6 viewport/theme combinations during active editing.
  - Styling and layout tweaks alone do not trigger the full ward suite (`check-ward-expected-reds.mjs`). Run the selected focused checks for the changed screen.
  - Check mobile (390px) and dark mode only once at the very end, and only if responsive layout rules were actually modified.
  - Batch browser tool calls; avoid repeated back-and-forth element probing.

**At an authorised integration (once, against the actual candidate tree).**

- Run `npm run ward:organise:check -- --source index` for staged-content acceptance, or
  `--source working-tree` for a working-tree check, when the selector identifies organisation inputs.
  Record the mode and source fingerprint. Only exit 0 supplies organisation acceptance. Resolve
  newly unclassified items through the reviewed registry or its exact unresolved records, not a
  prior report. This documented checkpoint is not an enforced global Git hook and does not replace
  any gate below.
  New work must use the registered scope or include a reviewed registry update for its new location
  or shared boundary. Retain relevant tests and source/decision links; record suspected documentation
  contradictions in the existing ledger. Organisation findings route work to its owner: they do not
  commission unrelated repairs. Keep deferred defects visible and distinguish an organisation pass
  from the full Ward integration verdict.
  For an exact-rule target rename, update its selector in the same reviewed change; for an exception
  rename, add the explicit rename record. Missing exact targets block acceptance; empty wildcard
  locations may remain registered for future work. Keep representative system mappings and checkpoint
  regressions in `tests/ward-organisation-core.test.ts` when changing organisation behaviour.
- Preview STATIC, FOCUSED or FULL with `node scripts/ward-flow/select-fold-gate.mjs --head <batch>`.
  The default comparison base is the local `origin/main` ref; `--base <ref>` chooses an explicit
  reviewed base. The selector never fetches a remote. Missing refs fail without selecting a gate.
  The selector is a plan, not executed acceptance. Use the normal local readiness command above
  against the actual candidate inputs. The full offline suite runs when FULL is selected or a
  separately authorised full check is required. Read its summary: files handed in must equal files
  that ran. Related tests and selected journeys provide focused diagnosis; they do not approve
  broad source work through the retired READY route. Reuse matching executed evidence only for
  its verified scope; a compatibility ready-check pass is not a FULL/browser verdict.
- For FULL, follow [`full-gate-recheck.md`](full-gate-recheck.md). Keep its per-chunk findings and
  receipt, resume a stopped run only against unchanged inputs, and rerun only the changed failing
  test files when its bounded recheck conditions hold. Source or shared-helper changes need a new
  FULL run after focused diagnosis; never describe a focused pass as a FULL verdict.
- Run tsc only when selected, diff-integrity for test/source deletion, eslint `--max-warnings 0`
  on changed Ward Flow files when selected, and generator checks when their inputs changed:
  `node scripts/ward-flow/<name>.mjs --check` for `screen-map`, `mockup-manifest`, `owner-rulings-index`,
  `screen-verification` and `rules-index`.
- Browser journeys use `select-journeys.mjs`; NONE skips, a list runs those specs, and ALL runs
  `npm run test:e2e:ward-journeys` (the `chromium-mockups` project).

## 6. Owner rules that fail builds or reviews

- **D4:** an unconnected control says exactly "Not wired in this prototype."
- **D5:** no Mental Health Act section numbers or computed legal limits, except the
  [owner-approved D-29 synthetic demo](decisions.md#d-29-act-time-limits-shown-as-a-labelled-synthetic-demo-4-october-2026).
  Only sourced periods and section references in `legal-forms/act-periods-demo.ts` and its
  permitted test are exempt. Show "Synthetic demo, not legally checked". Typed expiry remains
  the record; the engine never writes computed `dueAt`. Everything else in D5 is unchanged.
- **No typed text in browser storage** (called D-11 in helper briefs; owner ruling D-11 itself is the
  two-ledger rule). New events are classified in `ward-flow-persistence-classification.ts`, and any id
  or free-text field needs review.
- **Privacy wording.** Never write that something is not stored, private or anonymised unless a test
  proves it. No patient names or typed text in URLs, logs, screenshots, commit messages or memory.
- **Design tokens only, no hex.** Tap targets 48px via `var(--ward-tap)` or `var(--spacing-tap, 3rem)`.
- **Preserve the accepted app design.** Historical edge-bar, typography, card, masthead, punctuation
  and mockup prescriptions do not authorise reverting it or starting a redesign. Keep synthetic
  disclosure and understandable status. Compact badges still need meaningful accessible labels.
- New events go in EVENT_ROLE (`ward-flow-events.ts`) and `tests/ward-event-permissions.test.ts`.

## 7. Model tiers for helpers and reviews

Use the active host's supported model and delegation controls, applicable shared instructions and
project-required review floors. This document grants no delegation or model-selection authority.
The former Claude-specific Sonnet/Opus prescription and the 10 to 13 September role plans are
historical; they do not govern Codex, Gemini or other hosts. Prefer direct work where delegation
would add overhead, and distinguish requested routing from observed execution.

## 8. Asking and recording owner questions

- **Writing to the owner (25 September 2026, firm):** plain Australian English, answer first, short
  sentences, as few lines as will do, and only what he needs to know, do or decide. Include source,
  paths, commands and uncertainty when they help him assess the result or act. Give the result first.
- The thread that needs the answer asks, in its own thread, as **one numbered list**. Each question is one line in plain English with **one
  recommendation** and a one-word reply he can send. See [`how-to-write-to-the-owner.md`](how-to-write-to-the-owner.md).
- Record his reply **verbatim** in a dated file, `owner-answers-YYYY-MM-DD.md`. A second round on the
  same day is appended under its own heading, numbered `R2-n`. The asking thread's reading of each answer
  follows, marked as a reading.
- In the same commit, add a one-line "Superseded <date> by <file> item N" under every earlier ruling
  it overrides, in that ruling's own maintained file. Update the existing task record/receipt;
  preserve historical `STATUS.md` rather than treating it as a live question queue.
- An item the owner has deferred and told us not to raise again is never re-asked.

## 9. Superseding a document

Never delete a document. Put this banner at the top:

> SUPERSEDED on <date> by <path>. Kept for history; do not follow.

## 10. Protected work

Deleting or moving any Ward Flow document (including superseded ones), handover, worktree, unpushed
ward branch, memory file or backup needs the owner's explicit yes, with exactly what would be lost stated
first. Back up before any cleanup or fold. "Nothing imports it" is never enough.

## 11. If your brief does not cover a decision

Use judgement for routine reversible choices within the authorised outcome. Ask only when
material uncertainty changes scope, product meaning, safety, ownership or authority. Prepare
the concrete question and continue independent authorised work while the dependency waits.
Never infer clinical/privacy/provider approval or an exact-file takeover from silence.

## 12. Completion and handoff by requested stage

Complete the requested stage with its acceptance evidence: a delivered audit, evidenced Fast
Preview or verified local engineering change can complete without integration/publication.
Integrate, publish or deploy only when that stage is authorised and separately verified.
User acceptance, a local commit, hosted CI and deployed behaviour remain separate states.

Preserve useful work and a recoverable point before any authorised replacement/cleanup.
Commit coherent owned units through the current repository contract; coordinate a shared
writer's final commit rather than claiming another owner's changes. If owned edits remain
uncommitted, name them and the reason. Preserve other branches, worktrees, backups and processes.
Release only the claims/locks this task owns when handing it back.

Update the same task identity under [the receipt contract](../task-receipts.md). One final compact
contribution may include start/completion metadata for a single uninterrupted scoped reversible
task with no unresolved ownership, new provider/publication boundary or substantial recovery need.
A real pause, blocker, transfer or scope change needs an immediate update; substantial work keeps
meaningful checkpoints. Newly checked evidence is required for Last verified; timestamp-only
refresh does not establish freshness.

Report the usable result, source identity, owned diff, checks and unverified stages. An actual
remaining acceptance blocker keeps that stage incomplete; an unrequested later stage does not.
