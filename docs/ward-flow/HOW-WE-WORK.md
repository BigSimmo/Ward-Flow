# Ward Flow — how we work

**How any AI builder (Claude, Codex, Gemini, Antigravity or another) picks up, builds, tests, commits and
hands back Ward Flow work.** Written 17 September 2026; repository and integration directions
updated 2 October 2026. The current repository's `AGENTS.md` governs operational safeguards;
this guide supersedes older process notes within that boundary. Start at [`README.md`](README.md).

_Updated 2026-11-09 - working rules audit (D-107): design follows the design review prompt, one home each for claims, protected work and receipts, old plan references point to docs/history; Documentation owns._

> **The current rules are in this `BigSimmo/Ward-Flow` repository's `AGENTS.md`**, and Josh's
> standing rulings are in [`decisions.md`](decisions.md). Where this file differs from `AGENTS.md`,
> `AGENTS.md` wins. The former local Ward-line fold queue and lock are historical. Section 4
> describes how to prepare an integration candidate in the dedicated repository.

## 1. Picking up work

1. Read [`README.md`](README.md), the **Now** section of [`STATUS.md`](STATUS.md) and the agreed
   task scope. Work in flight is in open pull requests; the plan is in [`roadmap.md`](roadmap.md);
   every decision is in [`decisions.md`](decisions.md). Check the latest decisions before treating an
   old item as outstanding. Task metadata, owner decisions and verification evidence are separate.
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

### Design work

Every design task, from a one-line fix to a new page, follows the
[design review prompt](../design/design-review-artifact-prompt.md) (Josh, 9 November 2026, D-107).
It builds in the real app from before screenshots and asks Josh once before anything is published.
[DESIGN-SYSTEM.md](../design/DESIGN-SYSTEM.md) is the design record.

## 2. Branches and worktrees

**Updated 28 September 2026 for the dedicated `BigSimmo/Ward-Flow` repository.**

- Before any Git write, verify `git remote get-url origin` is
  `https://github.com/BigSimmo/Ward-Flow.git`. The old `D:/Worktrees/Database/ward-lead`
  checkout points to the separate PsychSift repository and is not a Ward Flow destination.
- **Every editing thread gets its own worktree and branch**, based on the verified Ward Flow
  `main` tip, so threads never share a working tree. Check the branch, status and base before editing.
  Read-only threads (reviews, questions, reports) need no worktree.
- **Your branch and its open PR are your claim** (Q374, 3 Nov 2026). This is the one detail home
  for claims; [AGENTS.md hard rule 7](../../AGENTS.md#hard-rules) is the rule. Before editing, check
  open PRs and branches for one already changing the same files. An overlap needs the other owner's
  release or Josh's scoped takeover. Write no claim lines, claim files or issue comments.
- **Optional shared log.** An existing log outside Git can still hold files: the commit hook blocks a
  file another branch holds there, and a missing log does not block. `WARD_SIGNOUT_FILE` selects its
  path; otherwise `WARD_FLOW_LOGS/sign-out.md`, then `D:/Repos/ward-flow-logs/sign-out.md` on Windows
  or `~/ward-flow-logs/sign-out.md` elsewhere. An unreadable log or claims folder blocks. Where a
  group uses one, release a branch with
  `RELEASED <date> | <owner> | <branch> | <reason>; repo=BigSimmo/Ward-Flow`, or add
  `files=<path>, <path>` before the reason to release only those files. Record a taken-over file as
  `path/to/file (approved takeover by Josh: <scope>)` on its own line, the format the commit hook reads;
  a folder-wide marker grants nothing. Do not start a new log.
  Cloud threads: [Cloud ownership](../agents/cloud-ownership.md).
- **Document handoffs.** Josh's standing document permission covers routine exact-file handoffs within
  an authorised task's project, purpose and audience. Prefer task-owned
  [draft copies](../agents/document-drafts.md) and the
  [document coordination procedure](../agents/shared-context-and-memory.md#autonomous-document-coordination).
  The single-user exception (`SKIP_SIGNOUT_GUARD=1`, per commit) is defined in
  [AGENTS.md hard rule 7](../../AGENTS.md#hard-rules).
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
- Do not merge other task branches into your branch or rebase your branch. An already-authorised
  merge of current main into a task branch follows the narrower exception in
  [git-publication.md](../agents/git-publication.md#normal-pushes-and-prs). Preserve its ownership, confirmation and
  auto-merge restrictions; this exception does not grant general integration or history-rewrite authority.
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
- Integration is a reviewed pull request into `main` with green CI. This repository has no
  integration lock or fold queue; never run an old local-line fold command from an archived handover.
- A local commit, pull request, merge and deployment are distinct states. Obtain the applicable
  authority for each consequential action, and report which state was actually reached.
- After a pause, refresh the branch and target state before integrating. Preserve other threads'
  changes; do not rebase, force or reset unclear work.
- **Daily release (Josh, 24 Oct 2026).** Railway deploys the live site from the `live` branch, not
  `main`. Merging into `main` does not change the live site. At 6 am Perth the
  [daily release workflow](../../.github/workflows/daily-release.yml) fast-forwards `live` to the
  newest CI-passed `main` commit and writes a GitHub Release tagged `live-<sha>` (the full commit
  id) and named "Live release YYYY-MM-DD-HHMM (Perth)", with a short "what changed" note; the coordinator posts its New and Fixed lines in project chat. "Release now"
  for an urgent fix means a manual run of that workflow after Josh says so. Never push to `live` by
  hand; rolling back to an earlier `live-*` tag needs Josh's yes, and starts by pausing the daily
  release with the `WARD_RELEASE_PAUSED` repository variable
  ([runbook](OPERATIONS-RUNBOOK.md#rolling-back-the-app)).
- **One claim board across machines: GitHub.** Claude threads and Codex work on different
  machines, so the open PRs and branches are the shared claim board (Q374). Comments on the pinned
  issue "Who is editing what" are no longer needed.

## 5. Testing

**While editing.**

- Run the changed tests and useful direct importers while editing. For the normal local readiness
  stage, use `npm run verify:pr-local -- --base <actual-base>` in this dedicated repository. Its shared
  classifier selects the full unit population and production Ward journeys for source, tooling,
  unknown, deleted or renamed inputs; a related-test pass cannot supply that broader verdict.
  Reuse only still-valid evidence for its actual scope at integration.
- No mutation proofs unless your brief names one. The mutation lines in the September plans (now in
  `docs/history/plans-2026-09/`) are history.
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
- Use the normal local readiness command above against the actual candidate inputs; its
  `--dry-run` output is a plan, not executed acceptance. The full offline suite runs when that plan
  selects it or a separately authorised full check is required. Read its summary: files handed in
  must equal files that ran. Related tests and selected journeys provide focused diagnosis only.
  Reuse matching executed evidence only for its verified scope.
- For FULL, follow [`full-gate-recheck.md`](full-gate-recheck.md). Keep its per-chunk findings and
  receipt, resume a stopped run only against unchanged inputs, and rerun only the changed failing
  test files when its bounded recheck conditions hold. Source or shared-helper changes need a new
  FULL run after focused diagnosis; never describe a focused pass as a FULL verdict.
- Run tsc only when selected, diff-integrity for test/source deletion, eslint `--max-warnings 0`
  on changed Ward Flow files when selected, and generator checks when their inputs changed:
  `node scripts/ward-flow/<name>.mjs --check` for `screen-map`, `mockup-manifest`, `owner-rulings-index`,
  `screen-verification` and `rules-index`.
- Browser journeys run with `npm run test:e2e:ward-journeys` (the `chromium-mockups` project) when
  the changed interface needs them; CI selects them through `scripts/ward-ci-public/plan.mjs`.

## 6. Owner rules that fail builds or reviews

- **D4:** an unconnected control says exactly "Not wired in this prototype."
- **D5:** no Mental Health Act section numbers or computed legal limits, with no exception.
  [D-70](decisions.md#d-70-no-computed-mental-health-act-periods-show-only-the-recorded-due-time-20-october-2026)
  removed the D-29 Act period demo: screens show only the due time a person recorded
  (`legalForm.dueAt`), or say none is recorded. Never compute an end, expiry or under-18 period,
  and never order a list by a computed time. Everything else in D5 is unchanged.
- **No typed text in browser storage** (called D-11 in helper briefs; owner ruling D-11 itself is the
  two-ledger rule). New events are classified in `ward-flow-persistence-classification.ts`, and any id
  or free-text field needs review. [D-67](decisions.md#d-67-recover-synthetic-form-drafts-within-the-browser-session-17-october-2026)
  permits bounded recovery of explicitly opted-in synthetic referral and legal form session drafts
  for human review. D-72 separately permits a scrubbed submitted-state device copy after typed
  events. Original typed values remain excluded from that copy; if a safe, valid copy cannot be
  made, saving stops. See [current persistence guidance](STATUS.md#remaining-work-and-local-remediation).
- **Privacy wording.** Never write that something is not stored, private or anonymised unless a test
  proves it. No patient names or typed text in URLs, logs, screenshots, commit messages or memory.
- **Design tokens only, no hex.** The design system of record is
  [`docs/design/DESIGN-SYSTEM.md`](../design/DESIGN-SYSTEM.md) (Q327);
  [`design/v9/design-system-v9.md`](../../design/v9/design-system-v9.md) section 14 keeps the earlier
  owner rulings. Standard rows use `--wf-row-default: 44px`, touch and phone rows
  `--wf-row-touch: 52px`, and desktop buttons `--wf-target: 28px`.
- **Control size (Josh, 31 October 2026: "no 48px controls").** On a phone a kit button shows at
  40px, a small one included (Q295, 2 Nov 2026), and keeps a 48px tap area through an invisible cover above and below
  it. Phone tabs and chips are 40px inside a 48px track (Q225, 2 Nov 2026); desktop segmented and pill tabs are 30px at 13px.
  Never draw a control 48px tall to meet the tap floor: give it the cover. `--ward-tap` and
  `--spacing-tap` (48px) are now the tap-area value, not a visible height. The one exception
  (Josh, 31 October 2026, 10:34): placement decisions (Accept, Pull and Decline, marked
  `data-placement-action`) stay a full 48px on phones, because they are the most important taps on
  the ward, often made in a hurry. The 12px text floor is unchanged.
- **No coloured side edges (Josh, 31 October 2026: "it feels tacky").** No coloured left or right
  edge, stripe, inset bar or tone-coloured border on any row, card, tile or stat box. Show tone with
  the StatusGlyph before the label or value, or a small tinted tag; selected is the selected tint
  with a neutral border. `tests/wf-no-side-stripes.test.ts` keeps new ones out, and each page build
  removes its page's remaining ones. This replaces the 9 October "thin act now edge".
- **Visual changes follow the [design review prompt](../design/design-review-artifact-prompt.md)**
  (Josh, 9 November 2026, D-107): built in the real app, shown as before and after screenshots and
  approved once by Josh before publishing. Older drawings do not authorise a restyle. Keep synthetic
  disclosure and understandable status; compact badges still need meaningful accessible labels.
- **Line caps never change on-screen words (Josh, 26 October 2026, decision list item 36).** When a
  file is at its `max-lines` cap (`eslint-rules/max-lines-baseline.mjs`), make room by moving code
  out or splitting the file, never by shortening, merging or dropping text a person reads. A cap is
  about code size; staff wording is a product decision. One squeeze turned "beds still pulled" into
  "beds pulled" (commit `0f38d544`), and it has been put back. Split at-cap files first (F-17).
- New events go in EVENT_ROLE (`ward-flow-event-roles.ts`) and `tests/ward-event-permissions.test.ts`.
- **Live pill "Demo 10:42" (Josh, 5 November 2026, design audit card 9).** The hero's live pill keeps
  the word Demo and the board time ("Demo 10:42"). It is the live-state word: it says nothing is live.
  Elsewhere the clock is Board time, never Demo time ([DESIGN-SYSTEM §6](../design/DESIGN-SYSTEM.md#6-words)).
- **Phone size limits (owner rule [D-82](decisions.md#d-82-a-pr-may-raise-a-phone-size-limit-by-up-to-5-kb-per-screen-without-asking-26-october-2026), 26 October 2026).**
  The phone first-load script limits (nine screens on 10 November 2026) live in `script-budget.json` and are checked by
  `scripts/check-script-budget.mjs`. A PR may raise a screen's limit by up to **5 KB in total per
  screen** (added up across the whole PR) without asking Josh. Above 5 KB on any screen, ask first,
  as before. There is no once-per-PR restriction.
  1. Diagnose first. Find out why the page grew. Never raise a limit to hide a jump you have not
     explained, such as a regression.
  2. Try an easy, safe trim first (load the code lazily, move a helper out of the shared shell).
  3. Raise only by what the PR needs, plus a small margin (about 0.2 KB).
  4. The PR body states, for each route raised: the old limit, the new limit, the measured size and
     why it grew. Add the same dated reason as a new file in `docs/script-budget-history/`, one
     per PR (see its README), not to the shared `docs/script-budget-history.md` or the `$comment`
     in `script-budget.json`.
  5. Lower a limit again when a page shrinks.
  6. If main itself goes over (PRs that each fitted landed together), your PR is not blocked: its
     build fails only routes your PR grew. A bot opens one issue asking for a trim
     (`ward-flow-budget-heal.yml`; [PUBLIC-CI](PUBLIC-CI.md#phone-script-budget-on-a-moving-main)).
     It never raises a limit. A person decides any raise (5 November 2026).
- **Speed target (Josh, 14 November 2026, R-STYLE-16).** Home should appear within 4 seconds on a weak
  mobile signal. It does not block the demo and is not a CI gate: it is a target to measure by hand,
  and a slower Home is a reason to look, not a reason to stop a release. It sits beside the phone
  size limits above, which are the only speed-related check CI runs.

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
  recommendation** and a one-word reply he can send. AGENTS.md "Writing to Josh" governs; older writing guides are archived.
- Record each decision as a new numbered entry in [`decisions.md`](decisions.md), quoting his reply
  **verbatim**, then the asking thread's reading of it, marked as a reading. Do not start new
  `owner-*.md` files (Josh, 7 November 2026); the existing ones stay as dated records.
- In the same commit, mark every earlier ruling it overrides "Replaced by D-n" in that ruling's own
  file, and add or clear the matching line in the status page's "Waiting on Josh" list.
- An item the owner has deferred and told us not to raise again is never re-asked.

## 9. Superseding a document

Delete or move a document only with Josh's yes ([AGENTS.md hard rule 8](../../AGENTS.md#hard-rules)), recorded in the [archive index](../history/README.md). Moved history goes to [`docs/history/`](../history/README.md). Otherwise keep it and put this banner at the top:

> SUPERSEDED on <date> by <path>. Kept for history; do not follow.

## 10. Protected work

The rule is [AGENTS.md hard rule 8](../../AGENTS.md#hard-rules). Back up before any cleanup, and
"nothing imports it" is never enough.

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

Commits and the PR body are the record of the task. Receipts are optional in prototype mode
(3 October 2026); see [task receipts](../task-receipts.md).

Report the usable result, source identity, owned diff, checks and unverified stages. An actual
remaining acceptance blocker keeps that stage incomplete; an unrequested later stage does not.
