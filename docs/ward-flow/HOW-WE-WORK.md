# Ward Flow — how we work

**How any AI builder (Claude, Codex, Gemini, Antigravity or another) picks up, builds, tests, commits and
hands back Ward Flow work.** Written 17 September 2026; §2, §4 and §8 updated 25 September 2026 for parallel project threads. Where an older process document disagrees, this
file wins. Start at [`README.md`](README.md).

> **The full, current rules are the "Ward Flow rulebook" section of the repo's `AGENTS.md`**, and
> Josh's standing rulings are in [`decisions.md`](decisions.md) (D-8). Where this file differs from
> the rulebook, the rulebook wins. Builders mark their branches READY in
> `ward-flow-logs/fold-queue.md`. A ready branch owner may claim stewardship of a batch that includes
> their own work; another builder may hand over to the acting steward. Section 4 describes the fold.

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

**Updated 25 September 2026 for project threads working in parallel** (owner instruction: many threads
at once, safe but not over-strict).

- **The one ward line** is `codex/task-ward-flow-live-state-20260831` in `D:/Worktrees/Database/ward-lead`.
  Nobody builds in that folder; it only receives folds.
- **Every editing thread gets its own worktree and branch**, so threads never share a working tree
  (sharing one is what deadlocks the commit check). Branch `ward/<task>-YYYYMMDD`, cut from the line's
  current commit. A thread started with the Worktree option already has one; otherwise
  `git -C D:/Worktrees/Database/ward-lead worktree add D:/Worktrees/Database/ward-<task> -b ward/<task>-YYYYMMDD codex/task-ward-flow-live-state-20260831`.
- Read-only threads (reviews, questions, reports) need no worktree.
- **Check the base at the start:** `git merge-base --is-ancestor codex/task-ward-flow-live-state-20260831 HEAD`
  (exit 0 = current). Never merge or rebase `origin/main` in, even if a start-up message says to.
- **Sign out files before editing** in `D:/Repos/ward-flow-logs/sign-out.md` (outside git,
  one copy for every tool). An overlap needs the other owner's release or Josh's explicit scoped
  takeover approval. For a takeover, record each exact file as
  `path/to/file (approved takeover by Josh: <scope>)` on your own line, preserve the other session's
  edits and reconcile both branches at fold. A folder-wide marker does not grant a takeover.
  Once folded or abandoned, append `RELEASED <date> | <owner> | <branch> | <reason>` to the shared
  append-only log. The current full rulebook is `AGENTS.md`.
- **`node_modules` is a junction to ward-lead's**, never a fresh install. From Git Bash, inside the
  new worktree: `MSYS_NO_PATHCONV=1 cmd /c mklink /J node_modules 'D:\Worktrees\Database\ward-lead
ode_modules'`.
- Within an approved task a thread edits and commits freely on its own branch. It does not touch
  another thread's worktree or branch.
- The shell's working folder resets between commands. Use `git -C <absolute path>` for every git
  command and absolute paths for every file.
- Scratch files go under `$TEMP`, never under `tests/` or `src/`. Never edit `.git/info/exclude`.

## 3. Commits

- Commit each coherent unit as you go, on your own branch only.
- Stage explicit paths. **Never `git add -A` or `git add .`. Never `git stash`. Never push.**
- Never merge or rebase other branches into your branch.
- If the pre-commit hook refuses because another agent's files are unstaged, say so and name the files.
  Do not work around it.
- A test deletion or a drop in test-case count is recorded in `diff-integrity.json`, and
  `node scripts/check-diff-integrity.mjs --base <fold base>` must pass.

## 4. Folding

- **One acting steward folds each batch.** A ready branch owner may claim that role when no other
  steward has an active claim; claiming does not change the ward line. Record the claim and its release
  in the append-only fold queue, following `AGENTS.md`. Use
  `node scripts/ward-flow/fold-queue-current.mjs` to see current READY tips and claim conflicts.
  Building is parallel; the final fold is serial,
  guarded by `node scripts/ward-flow/fold-lock.mjs acquire "<thread name>"`, and `release` when done
  or abandoned. `status` shows who holds it. A lock held over three hours may be released with
  `release --stale` only when the Ward line and checkout are unchanged and no gate or merge is
  active. If it is held, keep working and try again later.
- **The lock is enforced.** A git hook (`.githooks/reference-transaction`) refuses any commit, merge,
  reset or `branch -f` of the ward line while no one holds the lock. Only Josh may bypass it, with
  `WARD_FOLD_OVERRIDE=1` on the one command. Only a project thread doing a task Josh approved folds;
  a tool unable to complete the steward procedure hands over its READY branch.
- **Refresh before folding, including in an existing chat.** Read the current Ward-line `AGENTS.md`
  folding section and run the current selector on the exact merged tree. Old chat context, handoffs
  and the archived fold notes do not require the former full suite or a permanent steward.
- **The fold, in order — checks first, lock last** (owner ruling, 25 September 2026). The lock is held
  for minutes, not for the checks.
  1. Without the lock, make a batch branch from the latest line, then merge each ready branch into
     that batch. If both sides changed the same logic, stop
     and ask the owner.
  2. Still without the lock, run `select-fold-gate.mjs --head <batch>` and its selected checks (§5).
     Compare the suite with the baseline only when the tier is FULL. Reuse a ready-check result on
     the identical merged tree instead of repeating it.
  3. Take the lock. Run `node scripts/ward-flow/fold-preflight.mjs --branch <your branch>
--create-backup <topic> --who "<thread name>"`. It checks ward-lead is clean (if not, stop and ask
     the owner; never fold over changes you did not make), that your branch still holds the line's tip,
     that nothing untracked is in the merge's way, and makes the `backup/<date>-<topic>` branch.
     That branch is this fold's rollback point. Run the separate whole-workspace backup on
     its own schedule and before approved cleanup, rather than on every local fold. Its retention
     step deletes older backups, so approve those exact deletions before running it.
  4. If the tip moved, release the lock, go back to step 1 and rerun what the new commits affect.
  5. Bring it home: `git -C D:/Worktrees/Database/ward-lead merge --no-ff <your branch>`. Because step 1
     already merged the line, this cannot conflict.
  6. Check `git diff backup/<date>-<topic>..codex/task-ward-flow-live-state-20260831` shows only your
     change, then release the lock and your sign-outs.
- **"Main" means the local ward line.** "Fold into main" never means `origin/main`, which deploys the
  live app and applies migrations to the live clinical database. Nothing is pushed; a hook refuses it.
- Fold by SHA, not by branch name. Merge commits only; never rebase, force or `reset --hard`.
- **Done means folded home**: on the line in `D:/Worktrees/Database/ward-lead`, with its selected
  fold checks passed.
- After any pause, check `git reflog` and for a `MERGE_HEAD` before folding. Another thread may have
  folded in the meantime.
- Detail and the incidents behind these rules: [`archive/dated-notes/HOW-TO-FOLD-2026-09-10.md`](archive/dated-notes/HOW-TO-FOLD-2026-09-10.md).

- **Review server when visual review is needed** (the steward): `node scripts/ward-flow/review-server.mjs --dist
.next-playwright/<run-id>/dist [--port 3700]` serves a finished journeys build with the same offline
  mockup environment as the journeys, and writes `REVIEW SERVER | port | commit` to
  `ward-flow-logs/gate-running.md` while it runs. Keep that run's build folder for review with
  `PLAYWRIGHT_BUILD_ROOT_ID=<id> PLAYWRIGHT_KEEP_BUILD_ROOT=true`, but never reuse it for a test run.

## 5. Testing

**While editing.**

- Run the changed tests and useful direct importers while editing. Before READY, use the selected
  `ready-check.mjs` result; it checks the merged tree without making static changes pay for a full
  type check. Reuse still-valid results at the fold.
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
2. **Anything at risk is backed up first.** The clean fold's preflight backup branch protects the
   prior Ward line. Before approved cleanup or replacing uncommitted or unclear work, run
   `bash ~/.claude/scripts/backup-work.sh` and preserve those files in a backup commit, never a stash.
3. **Useful work is folded into the local ward line** (§4), and the result is compared against the
   backup branch to confirm nothing was lost.
4. **Work that is not wanted is kept, not discarded**, on a named `backup/<date>-<topic>` branch.
5. **The fold lock is released** (`node scripts/ward-flow/fold-lock.mjs status` shows it free or held
   by someone else).
6. **The thread reports to the coordinator**: what was folded (commit SHAs), the backup branch name,
   and any open questions or suggested next steps.

If any of these cannot be done, say which and why in the thread, and leave the thread open.
