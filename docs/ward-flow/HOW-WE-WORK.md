# Ward Flow — how we work

**How any AI builder (Claude, Codex, Gemini, Antigravity or another) picks up, builds, tests, commits and
hands back Ward Flow work.** Written 17 September 2026; repository and integration directions
updated 28 September 2026. Where an older process document disagrees, this
file wins. Start at [`README.md`](README.md).

> **The current rules are in this `BigSimmo/Ward-Flow` repository's `AGENTS.md`**, and Josh's
> standing rulings are in [`decisions.md`](decisions.md). Where this file differs from `AGENTS.md`,
> `AGENTS.md` wins. The former local Ward-line fold queue and lock are historical. Section 4
> describes how to prepare an integration candidate in the dedicated repository.

## 1. Picking up work

1. Read [`README.md`](README.md), then [`STATUS.md`](STATUS.md), then the ledger
   [`../ward-flow-task-ledger.md`](../ward-flow-task-ledger.md), then the plan for your task in
   [`plans/`](plans/README.md).
2. Check your folder: `git -C <worktree> status` and `git -C <worktree> log -5`. If files you did not
   touch are modified or staged, stop and hand back. In Claude Code, also read
   `bash ~/.claude/hooks/ward-fold-debt.sh --report`.
3. **Prove the task is still outstanding.** Another tool may already have built part of it. Grep for
   the event names, strings and tests the plan names. If it is done, check it against the plan and fix
   gaps instead of rebuilding.
4. Line numbers in a plan belong to the commit the plan names. Re-find them before editing.
5. Build only what the plan and the owner's answers decide. Anything marked CLARIFY, "waits on the
   owner" or deferred in `STATUS.md` is not built. If your task depends on one, stop and hand back.
6. Keep other tools' work. The owner's words: do not remove or significantly alter Antigravity's
   progress, design or builds; fix and perfect them.

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
  edits and reconcile both branches at fold. A folder-wide marker does not grant a takeover.
  Once folded or abandoned, append `RELEASED <date> | <owner> | <branch> | <reason>` to the shared
  append-only log. The current full rulebook is `AGENTS.md`.
- Reuse dependencies only from a trusted checkout of the same Ward Flow commit and lockfile.
  Never link to the old Database checkout; follow the current repository setup instructions.
- Within an approved task a thread edits and commits freely on its own branch. It does not touch
  another thread's worktree or branch.
- The shell's working folder resets between commands. Use `git -C <absolute path>` for every git
  command and absolute paths for every file.
- Scratch files go under `$TEMP`, never under `tests/` or `src/`. Never edit `.git/info/exclude`.

## 3. Commits

- Commit each coherent unit as you go, on your own branch only.
- Stage explicit paths. **Never `git add -A` or `git add .`. Never `git stash`.** Verify the
  destination and applicable authority before any push.
- Never merge or rebase other branches into your branch.
- If the pre-commit hook refuses because another agent's files are unstaged, say so and name the files.
  Do not work around it.
- A test deletion or a drop in test-case count is recorded in `diff-integrity.json`, and
  `node scripts/check-diff-integrity.mjs --base <fold base>` must pass.

## 4. Folding

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

- Run the changed tests and useful direct importers while editing. Before READY, use the selected
  `node scripts/ward-flow/ready-check.mjs --onto origin/main` result; it checks the merged tree without making static changes pay for a full
  type check. It requires verified Ward Flow fetch and push destinations and the worktree’s own
  locked dependencies. Retired fold-lock and fold-preflight commands remain unavailable in linked
  repositories. Remote-less scratch tests require `WARD_FOLD_TEST_FIXTURE=1`.
  Reuse still-valid results at the fold.
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

**At the fold (the folding thread, once, in its own worktree after merging the line in).**

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
- Select STATIC, FOCUSED or FULL with `node scripts/ward-flow/select-fold-gate.mjs --head <batch>`.
  The full offline suite runs only for FULL and the daily night-shift line check. Read its summary: files
  handed in must equal files that ran. FOCUSED uses related tests and selected journeys. Reuse an
  identical passing ready-check verdict; do not pay for a second type check on the same tree.
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
- **D5:** no Mental Health Act section numbers, and no computed legal time limits. The app shows only
  times a person typed.
- **No typed text in browser storage** (called D-11 in helper briefs; owner ruling D-11 itself is the
  two-ledger rule). New events are classified in `ward-flow-persistence-classification.ts`, and any id
  or free-text field needs review.
- **Privacy wording.** Never write that something is not stored, private or anonymised unless a test
  proves it. No patient names or typed text in URLs, logs, screenshots, commit messages or memory.
- **Design tokens only, no hex.** Tap targets 48px via `var(--ward-tap)` or `var(--spacing-tap, 3rem)`.
- **No coloured edge bars or top highlights** on cards, rows or panels.
- New events go in EVENT_ROLE (`ward-flow-events.ts`) and `tests/ward-event-permissions.test.ts`.

## 7. Model tiers for helpers and reviews

The global rule governs (`~/.claude/development-system.md` §1). **Sonnet is the default** for anything
whose result can be checked by looking: a test passes, a file exists, a count matches. **Opus needs a
written veto:** the output is a clinical, legal or privacy judgement; it is the last review before a fold
nobody else reads; it designs a check; it debugs an unknown cause; it writes a plan or decision record; or
it combines several agents' findings. State the tier in every brief and report. Older role and tier
rules in `control/README.md` (gone — deleted with WLQ-33) and the 10 to 13 September plans are retired.

## 8. Asking and recording owner questions

- **Writing to the owner (25 September 2026, firm):** plain Australian English, answer first, short
  sentences, as few lines as will do, and only what he needs to know, do or decide. No jargon, commit
  ids, file paths or command names unless he asks. Give the result, not the process.
- The thread that needs the answer asks, in its own thread, as **one numbered list**. Each question is one line in plain English with **one
  recommendation** and a one-word reply he can send. See [`how-to-write-to-the-owner.md`](how-to-write-to-the-owner.md).
- Record his reply **verbatim** in a dated file, `owner-answers-YYYY-MM-DD.md`. A second round on the
  same day is appended under its own heading, numbered `R2-n`. The asking thread's reading of each answer
  follows, marked as a reading.
- In the same commit, add a one-line "Superseded <date> by <file> item N" under every earlier ruling
  it overrides, in that ruling's own file. Then update `STATUS.md` "Needs the owner".
- An item the owner has deferred and told us not to raise again is never re-asked.

## 9. Superseding a document

Never delete a document. Put this banner at the top:

> SUPERSEDED on <date> by <path>. Kept for history; do not follow.

## 10. Protected work

Deleting or moving any Ward Flow document (including superseded ones), handover, worktree, unpushed
ward branch, memory file or backup needs the owner's explicit yes, with exactly what would be lost stated
first. Back up before any cleanup or fold. "Nothing imports it" is never enough.

## 11. If your brief does not cover a decision

Stop and ask the owner in your thread. Do not guess.

## 12. Before a thread is resolved (owner rule, 25 September 2026)

A thread is not finished, and must not be resolved, until all of this is true:

1. **Everything useful is committed** on the thread's own branch. The worktree shows no uncommitted
   changes (`git -C <worktree> status --short` is empty).
2. **Anything at risk is backed up first.** Preserve a recoverable point before replacing the
   integration target. Before approved cleanup or replacing uncommitted or unclear work, run
   `bash ~/.claude/scripts/backup-work.sh` and preserve those files in a backup commit, never a stash.
3. **Useful work is integrated into its authorised Ward Flow destination** (§4), with the exact
   resulting tree compared against the reviewed candidate.
4. **Work that is not wanted is kept, not discarded**, on a named `backup/<date>-<topic>` branch.
5. **Any integration lock is released** under the current repository rulebook.
6. **The thread reports to the coordinator**: what was integrated (commit SHAs), the backup branch name,
   and any open questions or suggested next steps.

If any of these cannot be done, say which and why in the thread, and leave the thread open.
