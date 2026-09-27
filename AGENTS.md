<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 🔴 WARD FLOW HARD RULE — FIRST, MAKE YOUR OWN WORKTREE (any agent: Antigravity, Codex, Claude, Gemini)

`D:\Worktrees\Database\ward-lead` is READ-ONLY for every agent. If you opened it, do this before anything else:

1. First action: `git -C D:\Worktrees\Database\ward-lead worktree add D:\Worktrees\Database\ag-<task> -b ward/ag-<task> codex/task-ward-flow-live-state-20260831`
   (if the folder or branch exists, use `-2`, `-3`; never reuse one). Then work only in that new folder.
2. Prove it: `git -C <new folder> branch --show-current` shows `ward/ag-<task>`, and
   `git -C <new folder> merge-base --is-ancestor codex/task-ward-flow-live-state-20260831 HEAD` exits 0.
3. Until that passes: read-only git only. No edits, no npm, no dev server, no tests.
4. Check the path before every edit. It must be inside your new folder, never ward-lead.
5. If the worktree cannot be made, stop and report. Never fall back to the main folder.
6. If you edited a file in ward-lead by mistake: stop, do not undo it, and report the files.
7. node_modules: a junction to ward-lead's copy
   (`cmd /c mklink /J node_modules D:\Worktrees\Database\ward-lead\node_modules`). Never npm install or npm ci.

Full rules: `D:\Repos\ward-flow-logs\AGENT-RULES.md`.

# How these rules are organised

This file is the always-loaded core. It carries the boundaries that prevent irreversible harm, and
the sections a committed gate parses by exact text. Every other rule keeps its heading here and its
full text — verbatim, nothing dropped — in a named reference file. Open the file before acting in
its area.

**Read these first; they prevent damage that cannot be undone, and their text is below (on the Ward
Flow line `# Supabase project safety` is a short version; its full text is on `origin/main`):**
`# Supabase project safety` (merging a migration reaches the live clinical database within
seconds, with no deploy step in between), `# Railway project safety`,
`# API and provider confirmation boundary`, and `# Local server safety`.

| Topic                                                                                                                     | Full text                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Gate selection, the verification tier table, the gate arbiter                                                             | [`docs/agents/verification-gates.md`](docs/agents/verification-gates.md)                     |
| Open PR sync, the `Run PR` sweep, babysitting a PR, review coverage, PR bundling                                          | [`docs/agents/pull-request-workflow.md`](docs/agents/pull-request-workflow.md)               |
| The `upload` shortcut                                                                                                     | [`docs/agents/upload-shortcut.md`](docs/agents/upload-shortcut.md)                           |
| Button and route wiring, the bundle budget                                                                                | [`docs/agents/wiring-and-bundle-budget.md`](docs/agents/wiring-and-bundle-budget.md)         |
| External skill precedence, evidence and calibration                                                                       | [`docs/agents/external-skill-precedence.md`](docs/agents/external-skill-precedence.md)       |
| Deleting code you believe is dead                                                                                         | [`docs/agents/dead-code-deletion.md`](docs/agents/dead-code-deletion.md)                     |
| Claude Code hook scripts                                                                                                  | [`docs/agents/claude-hook-scripts.md`](docs/agents/claude-hook-scripts.md)                   |
| The `bug-hunter` shortcut                                                                                                 | [`docs/agents/bug-hunter-shortcut.md`](docs/agents/bug-hunter-shortcut.md)                   |
| Repository skills                                                                                                         | [`docs/agents/repository-skills-and-issues.md`](docs/agents/repository-skills-and-issues.md) |
| Codex dependency, review throttling, desktop worktree, reasoning effort, productivity, GitHub review, Cloud; Cursor Cloud | the `docs/agents/codex-*.md` and `docs/agents/cursor-cloud.md` pointers below                |

Five sections stay here in full because a committed test or script reads their exact text:
`## Bare PR publication is not readiness work`, the format-before-push rule,
`# Search chrome behaviour`, `## Anti-conflict and CI-speed operating procedure`, and
`## Codex Cloud environment`. Their wording is code, not prose — moving or rewording it fails
`verify:cheap`.

<!-- BEGIN:dependency-shortcut -->

# Ward Flow — if you are on this branch, read its own entry point first

🔴 **This branch carries a second, largely separate product: Ward Flow, a ward bed-coordination
prototype.** If your task mentions wards, beds, referrals, movements, delays, capacity, or anything
under `src/components/ward-management/`, `src/app/mockups/ward-flow/` or `docs/ward-flow/`, then
**[`docs/ward-flow/README.md`](docs/ward-flow/README.md) is your entry point — read it before this
file's workflow sections.** It names the mission, the design source of truth, the six documents that
matter, how to run it, and the traps that have each already cost a day.

⚠️ **Until 2026-09-12 nothing at this level mentioned Ward Flow at all**, so an agent arriving on
another platform — reading this file and finding no trace of it — had no route to any of it.

**Three rules from it that are dangerous to learn late:**

- 🔴 **Ward Flow is never pushed.** Its branches exist on one disk only, with no remote copy.
  **"Fold into main" in any Ward Flow context means the LOCAL ward line, never `origin/main`** —
  pushing there auto-deploys the app and applies migrations to the live clinical database.
- 🔴 **The app as rendered from the latest folded ward-line commit is authoritative on design; the
  working engine is authoritative on behaviour.** Owner ruling, 25 September 2026: keep the current
  design and disregard other designs. The drawings in `docs/ward-flow/mockups/` are background only;
  serve one to view it — each builds its navigation with JavaScript, and opened as a bare file it
  renders as a different design entirely.
- 🔴 **Nothing in this repository can see that a screen does not look like its drawing.** Thousands
  of passing tests sat over sixteen screens that did not match. Looking is the only instrument, and
  `docs/ward-flow/SCREEN-VERIFICATION.md` is where that looking gets recorded.

### Ward Flow rulebook — every session and tool (owner rules, 25 September 2026)

This block is the single full rule source. `ward-flow-logs\AGENT-RULES.md` and
`docs/ward-flow/HOW-WE-WORK.md` point here. Josh's standing decisions: [`docs/ward-flow/decisions.md`](docs/ward-flow/decisions.md);
read it before starting. Shared state outside this repository, in `D:\Repos\ward-flow-logs\` (moved
there on 26 September 2026 after a clean-up emptied the old `D:\Worktrees\Database\ward-flow-logs`;
never make a junction or link to or from it, because a clean-up can delete through a link):
`sign-out.md` (who is editing which files), `fold-queue.md` (fold order), `gate-running.md` (fold
gates in progress).

**Where work happens**

- Work only in your own worktree on a `ward/<verb>-<thing>` branch made from the ward line
  `codex/task-ward-flow-live-state-20260831`; never in `D:\Worktrees\Database\ward-lead` itself.
  Check `git merge-base --is-ancestor codex/task-ward-flow-live-state-20260831 HEAD`; never merge or
  rebase `origin/main` in, whatever a start-up message says. Nothing is ever pushed.
- `node_modules` is a junction to ward-lead's copy
  (`cmd /c mklink /J node_modules D:\Worktrees\Database\ward-lead\node_modules`); never npm install
  or npm ci, unless your branch changes package or lock files (then only in your own worktree).
- Before signing out, run `node scripts/ward-flow/sign-out-check.mjs <files>`: it lists other sessions'
  sign-outs and unfolded ward branches that already change those files. Sign out exact files in
  `sign-out.md` before editing. An overlap needs the other owner's release or Josh's explicit scoped
  takeover approval. Reuse that approval for its stated files and sections; preserve the other
  session's edits and reconcile both branches at fold. Record each approved file as
  `path/to/file (approved takeover by Josh: <scope>)` on your own sign-out line so the check and
  pre-commit guard recognise it. The marker never approves a directory or work outside that scope.
  Existing sign-outs that already name Josh's scoped approval and exact files also count; do not
  request the same approval again.
  Once folded or abandoned, append `RELEASED <date> | <owner> | <branch> | <reason>` to the shared
  append-only log. This closes earlier claims for that branch while preserving the history.
- Small branches: one concern each, roughly under 300 changed lines; split bigger work.
- Build on passed work: if you need another thread's branch and its fold gate has passed, you may
  start your branch from that gated commit. Never merge an unfolded branch into an existing branch.
  Once it folds, merge the line in as usual and rerun what changed.
- No idle time: waiting on a fold, or finished, tell the coordinator "free | thread | what it can take".
- Commit small and often. Never `git add -A`, stash, clean, force or reset; never touch uncommitted
  changes you didn't make. Back up before replacing anything (backup branch, or `name.bak-YYYYMMDD-HHMM`).

**Run slots and heavy checks** (Josh, 25 September 2026)

- All threads, chats and helpers work at once (up to 4 read-only helpers per thread). The limits:
  one fold at a time, one run per checkout, and run slots for heavy work.
- Wide runs (full ward suite, build, journeys, screenshot runs): one on the PC at a time, fold gates
  first. Narrow runs (full tsc, generator `--check`, organise check): up to two at once, never beside
  a wide run except inside the same gate (there tsc may run beside the suite; journeys after it).
  Light work (editing, git, single-file tests, incremental tsc) never waits; focused test runs lock
  per checkout only.
- Run every heavy command through the slot script, which waits for a slot, checks the processor
  (70% or less, 4 GB free), writes and removes its `gate-running.md` line, and clears slots whose
  process has gone: `node scripts/ward-flow/run-slot.mjs run wide|narrow "<thread>" [--gate] --
<command>`; `status` shows who holds what. Fold gates add `--gate` and go first. While queued, do
  non-heavy steps. Use `--wait 5` for an owner's narrow check and `--wait 30` for a fold gate; if it
  gives up (exit 3), record the branch as waiting and move to other useful work. The script's
  defaults now match those limits and reports a minute-by-minute heartbeat while a command runs.
  A line over 60 minutes old whose
  process is alive is reported, not broken. At most one dev server on the PC. Tools without the
  script on their branch yet follow the same rule by hand in `gate-running.md`.
- Owners' checks while editing (Josh, 25 September): `node scripts/ward-flow/related-tests.mjs` runs
  only the tests that use your changed files, found automatically (capped at about 60 files; a
  file with huge fan-out falls back to direct importers, then to your changed tests, and says
  "fan-out capped: batch gate covers the rest"). Run `node scripts/ward-flow/gate-tsc.mjs` when
  changed source or types require it; do not type-check documentation or local JS tooling by habit.
  Never run a full suite of your own; the selected fold gate covers the rest. No
  watch mode, coverage, mutation, lint-all or screenshot sweeps.
- Heavy checks run only where the fold gate requires them, once per fold, never twice on the same
  commit; don't rerun what the pre-commit hook just passed; give a one-line reason for any heavy run
  outside the gate. A timeout while the processor was over 90% is load: rerun that file alone once.
- Clean up after yourself (Josh, 25 September): stop every app copy, dev server, browser and
  background script you started as soon as you no longer need it, and always before you report
  finished; say "nothing left running" in the report. A chat that disconnects leaves its runs going
  with no owner (25 September: two leftover app copies held about 5 GB, one still running an hour
  after its chat closed).
- Put a time limit on every long command, inline scripts included (`timeout <seconds> python -`,
  `node -e`), so a stuck one ends itself (25 September: an inline Python script with no limit held a
  processor core for over 40 minutes).
- Before stopping a process that looks abandoned, check nothing is using it: look for connections
  to its port (`netstat -ano`) and trace its parents to a live chat (the `claude.exe --resume=<id>`
  that started it; the id is the chat's transcript file name under `~/.claude/projects/`). On 25
  September an app copy that looked abandoned was being screenshotted by a live chat. Never stop
  another chat's process that is still in use.
- No antivirus exclusions for speed. D: is a trusted Dev Drive, so antivirus already runs in its
  fast mode there; program-wide exclusions (node.exe, git.exe) switch off scanning across the whole
  PC and gain nothing on D:.
- A processor at 100% means too many runs at once, not one bad program (25 September, measured over
  10 seconds: no single program took more than a fifth). The fix is holding runs in the slots, not
  hunting for a culprit.
- Screenshots: `node scripts/ward-flow/shots.mjs` (desktop, from a finished production build, 4
  pages at a time; `--set before` is shared per line commit in `ward-flow-logs/shots/`; `--set after`
  lists only the screens whose pixels changed). Gate builds reuse Next's working cache (never the
  finished output): set `WARD_BUILD_CACHE_DIR=D:/Repos/ward-flow-logs/build-cache` for the
  journeys run; it copies the cache in before the build and back out after a good one (R26).
- Build type check off the critical path (Josh, 25 September): set `WARD_GATE_PARALLEL_TSC=1` on the
  gate's journeys run. The build skips its own check and the same check (the whole app plus the
  build's generated route types) runs beside the journeys; the run fails if it fails.
- The next batch's build may run beside the current batch's journeys (they leave the processor
  mostly idle); it is the only wide run allowed beside another, and only for the steward.
- Known-failing journeys fail fast (Josh, 25 September, Q3): set
  `WARD_JOURNEY_KNOWN_FAILURES=<the steward's known-failures list>` on the journeys run. Those tests
  still run every gate, in their own `chromium-mockups-known` project with a 20-second timeout; one
  that starts passing shows as passed there, so recoveries stay visible.
- Ward-only test build (R27): `WARD_ONLY_BUILD=1` on the journeys run compiles only the Ward Flow
  routes (`next build --debug-build-paths`), checks every screen in
  `scripts/ward-flow/shot-routes.txt` answers, and falls back to a full build automatically if the
  build fails or a screen is missing. Use it in gates once one proof run shows the same journey
  results as a full build. The real `npm run build` step stays a full build.
- Screenshots: desktop only. For an intended screen change, take them after the fold, once. Take
  Take before-and-after shots before the fold only when you claim a change looks identical, and then
  of about 8 representative screens, one per layout type, not every screen.

**Folding — checks first, lock last**

- Before each fold, refresh this section and `docs/ward-flow/README.md` from the latest local ward
  line. Existing chats must use the current on-disk rules and selector, even if an earlier message,
  transcript or handoff says to run the old full gate or assigns a permanent steward. A gate already
  running under an older procedure is not proof for a new batch; stop only your own process safely,
  then select the current gate for the exact merged tree. Record what was already checked so valid
  evidence can be reused.
- 🔴 No clean-ups without Josh's typed yes (26 September 2026: a clean-up emptied the shared notes,
  every chat's scratch folder and 36 worktree folders). Never delete, clean, prune or empty anything
  under `D:\Repos`, `D:\Worktrees`, `D:\Temp\claude` or `C:\Users\joshs\.claude` without first
  listing exactly what would go and getting Josh's typed yes for that list. The shared notes in
  `D:\Repos\ward-flow-logs` are append-only for every session; the old
  `D:\Worktrees\Database\ward-flow-logs` is retired.
- Never commit or merge to the ward line without the fold lock; a git hook refuses it. Only Josh may
  use `WARD_FOLD_OVERRIDE=1`.
- Batch folds, one acting steward: stewardship is a role for one batch, not a permanent assignment
  to a particular chat. A branch owner may steward a batch of handed-over READY branches, including
  their own, if they can complete the fold procedure. Before preparing a batch, run
  `node scripts/ward-flow/fold-queue-current.mjs` and check fold-lock status. Append
  `STEWARD IN PROGRESS | thread | branches | line tip` to
  `fold-queue.md`, then re-read it; the first claimant for overlapping branches proceeds and later
  claimants release their claims. Append `STEWARD RELEASED | thread | reason` when done or abandoned.
  If a claimant disappears, check that its process stopped and the lock is free before release;
  uncertainty goes to Josh. A queue claim never grants the fold lock. Builders commit and record
  `READY | thread | branch | commit | own checks passed`; any owner unable to steward hands off.
- Batch cut-off: start with branches already READY. Do not hold a run slot for a promised branch;
  a later READY branch joins the next batch.
- Rolling batches: no fixed cut-off. The next gate starts when the previous one ends, with whatever
  is READY. A short focused fold may proceed while no wide gate is running.
- Stacked work: a branch may be built on an unfolded READY branch and fold in the same batch; say so
  in its READY line. If the base drops out of the batch, the stacked branch drops with it.
- Focused lane: a branch whose `select-fold-gate.mjs` result is STATIC or FOCUSED may be folded
  promptly after its selected checks pass on the merged tree. The steward still takes the fold lock,
  runs preflight, makes a backup and reads the diff. A branch cannot use this lane if the selector
  reports FULL, its focused test selection is empty for executable changes, or its scope is unclear.
- `READY-FAST` is a queue hint, not a check exemption; the selector determines the gate.
- The steward: check the chosen READY branches with
  `node scripts/ward-flow/trial-merge.mjs --branch <branch>` (repeat `--branch` for a batch;
  light git only, safe during a gate's test phase). It reports CLEAN or CLASH alone and in selected
  queue order; omit `--branch` only for a whole-queue audit. Make
  `ward/batch-<n>` from the line; merge the READY branches one by one (about 8 at
  most); a conflict drops that branch to the next batch. Run one fold gate for the batch; a red gate
  is mapped to the branch that touched the failing file, and that branch is dropped. Then take the
  lock and run `node scripts/ward-flow/fold-preflight.mjs --branch ward/batch-<n> --create-backup
<topic> --who "<name>"` (ward-lead clean, tip unchanged, backup made; if the tip moved, release,
  re-merge and rerun what's affected). Merge commit only; check `git diff <backup>..<line>` shows only
  the batch; release the lock; clear the folded lines and their sign-outs.
- Pre-checked folds: the next batch may run its gate in a scratch worktree built from line +
  the batch ahead + itself, without merging the other batch into its own. If the batch ahead
  folds unchanged and `git diff --quiet` shows the scratch tree equals (new line + own branch), the
  gate result stands; otherwise rerun what changed.
- Fold gate selection: run `node scripts/ward-flow/select-fold-gate.mjs --head <batch>` and use its
  printed tier. STATIC runs only changed-document link, generator and organisation checks when their
  inputs changed. FOCUSED runs the changed and related unit tests on the merged tree, plus the
  selected browser journey for a changed screen or route. FULL runs the complete offline suite,
  baseline comparison and clean Ward-scoped type check. FULL is reserved for shared Ward engine or
  data files, test discovery/setup or runner changes, executable/test deletions, package/build
  configuration, and unknown scope. Never substitute a focused pass for FULL. The night shift runs
  the complete offline population once daily on the ward line and records its result. A new red is
  assigned to its owner; it blocks an affected fold, while unrelated FOCUSED folds can continue.
  For a selected FULL gate, use `docs/ward-flow/full-gate-recheck.md`: save each completed chunk and
  its failure findings, resume a stopped run only against the same inputs, and use the bounded
  changed-test recheck only when that guide's conditions hold. A source or shared-helper fix still
  needs a new FULL run. Do not restart the entire suite for a small test-only correction when the
  validated checkpoint permits a bounded recheck.
  Run type checking for FOCUSED only when the selector requests it. Reuse a passing ready-check
  type check and related tests when the merged tree and selected inputs are byte-identical; record
  that reuse explicitly. Do not run the same check again merely because the branch became a batch.
  Generator and organisation checks run only when the batch touches their inputs. Journeys run what
  `node scripts/ward-flow/select-journeys.mjs --head <branch>` prints: ALL = the full set
  (`npm run test:e2e:ward-journeys`), a list = only those specs
  (`node scripts/run-playwright.mjs --project=chromium-mockups <specs>`), NONE = skip. It picks ALL for
  the engine, reducer, layout, shared components, app-wide files and any screen no spec visits, and
  when unsure. Journeys build the app themselves, so add `npm run build`
  only if the diff touches next.config, env, package or lock files, middleware or non-mockup routes.
  Any build in the gate (journeys' or `npm run build`) runs with the value
  `node scripts/ward-flow/gate-build-flag.mjs --head <branch>` prints: `WARD_GATE_BUILD=1` skips
  the build's own type check only when the batch changes no page, layout or route file (Josh,
  25 September; decisions R22).
  The same script prints `WARD_GATE_SKIP_TOOLING`: set it for a FULL suite run; `1` skips the
  listed tooling tests (tests of scripts, hooks and this gate) when the batch changes no scripts,
  hooks, package, test setup or tool config, and the night shift runs them on the line tip (R32).
- The expected-reds manifest: owners never remove recovered entries. The steward removes every entry
  the gate shows passing, once per batch, and never adds entries from a gate report.
- A failure not on the baseline is yours; never skip, disable or weaken tests, or update snapshots or
  expected failures to pass.
- Quality guard: efficiency only cuts repeated work and chatter. It never replaces a required check,
  test, backup, fold step, diff read or before/after screenshot.

**Efficiency, iteration and safety principles** (Josh, 26 Sept 2026; R36 to R49).
These are the general principles behind the rules above; where one reads looser than a rule above,
the stricter wording wins.

- **R36** Find the bottleneck first and keep it busy. On Josh's PC the bottleneck is the one
  heavy-run slot (the gate). Never let it sit idle: prepare, trial-merge and pre-check the next
  batch while the current one runs.
- **R37** Build in parallel, prove in series. Many agents can edit at once, each in its own worktree
  with its files signed out. Heavy checks take turns.
- **R38** Run cheap checks first and expensive ones once. Before READY, run the selected ready check.
  At the fold, reuse successful checks on an identical merged tree and run only the remaining selected
  checks. A FULL suite, build or journey runs once per relevant batch, not by default.
- **R39** Match the check to the changed failure path using `select-fold-gate.mjs`. Documentation is
  STATIC; local tooling and test edits use focused contracts; Ward screens use focused unit and
  selected browser checks; shared engine, test infrastructure and unknown scope use FULL. A changed
  hook needs its hook contract, not every product test. A full run never follows solely from "no
  screen change". Unknown or untested executable scope fails closed to FULL.
- **R40** Batch, but keep the pieces independent. Build each branch on the line with only its own
  commits. Never merge a batch or integration branch into a feature branch, because it drags other
  people's unfinished work, and their failures, along with it. Stack only on a base that folds in
  the same batch.
- **R41** Fail small and keep moving. On a red: bisect, drop the guilty pieces, rerun the rest, and
  send each red to its owner. Don't hold a batch for one late piece; it goes in the next batch.
- **R42** Know the baseline exactly. Track known failures by test name and first failure line, and
  let that list only shrink. A new failure inside an already-red file still counts. Never skip,
  weaken or quarantine a test.
- **R43** Give shared state one home each: one queue with READY and NOT READY lines, one owner per
  file. Owners fix their own reds. Anything that crosses threads goes through the coordinator.
- **R44** Measure before optimising. Record gate timings and fix the slowest step first. Use the
  command that matches the job, so light work isn't queued as heavy work (for example, vitest's
  "run" subcommand).
- **R45** Iterate in small, reversible steps. Pick a sensible default and keep going. Ask only when
  the answer would change the goal, a result Josh will see, or something that can't be undone.
- **R46** Never trade safety for speed. Back up before replacing anything. Archive rather than
  delete. Approval for an irreversible or safety-hook-gated action (deletions, overriding a hook,
  anything no one can undo) must be typed by Josh in the thread that acts on it. Other decisions may
  reach a thread as Josh's own message attached verbatim by the coordinator, never paraphrased or
  relayed in another thread's words. Make the smallest change, and leave the design unchanged unless
  Josh asks.
- **R47** Report honestly. Estimate the whole remaining job, not just the next step. Say what was
  checked and what was inferred. If you disagree with another thread's recommendation, say so in
  one line and give the reason.
- **R48** Before READY, run `ready-check.mjs` on the merged tree. It always proves the merge and
  runs the selected related tests; it type-checks only when `select-fold-gate.mjs` calls for it.
  Static changes avoid a temporary test checkout. No READY after a failed or missing selected check.
  The bed-release failures of 25 September are why changed behaviour still gets merged-tree tests.
- **R49** On a red gate suite, blame first (Josh, 26 Sept). Match each failing test to the batch
  pieces by what it imports and which piece changed those files; for each piece,
  `related-tests.mjs --head <piece> --dry-run` lists the tests its changes reach. Drop the clear
  matches and rerun; bisect only when the match is unclear.

**Writing to Josh**: plain Australian English, answer first, short sentences, only what he needs to
know, do or decide. No jargon, commit ids, paths or command names unless he asks. Questions are
numbered, one line each, with a recommendation and a one-word reply.

## Dependency shortcut

For the full Codex dependency shortcut workflow, see [`docs/agents/codex-dependency-shortcut.md`](docs/agents/codex-dependency-shortcut.md).

<!-- END:dependency-shortcut -->

<!-- BEGIN:bug-hunter-shortcut -->

## Bug-hunter shortcut

For the `bug-hunter` targeted defect-discovery shortcut, its execution rules, and its scope and safety limits, see [`docs/agents/bug-hunter-shortcut.md`](docs/agents/bug-hunter-shortcut.md).
<!-- END:bug-hunter-shortcut -->

<!-- BEGIN:codex-review-throttling -->

## Codex review throttling and routing

For Codex review throttling, branch routing, and review thread resolution guidance, see [`docs/agents/codex-review-throttling.md`](docs/agents/codex-review-throttling.md) and [`docs/codex-review-protocol.md`](docs/codex-review-protocol.md).

<!-- END:codex-review-throttling -->

<!-- BEGIN:local-server-safety -->

# Local server safety

- If the user says `run`, execute `npm run ensure` and return the printed URL.
- If the user asks for UI/frontend changes, browser QA, screenshots, mobile checks, or a local app link, run `npm run ensure` before opening or testing the app, even if the user did not say `run`.
- Never assume `localhost:3000`, `localhost:3001`, or `localhost:3002`.
- Never attach to a local server unless `/api/local-project-id` confirms it is this project.
- Do not kill or modify other projects' local servers. If the stable project port is busy, let `npm run ensure` choose the next safe project URL.
- Do not run a permanent watcher. Only start or verify the server when the current chat task needs the app or the user asks to run it.

<!-- END:local-server-safety -->

<!-- BEGIN:codex-desktop-worktree-setup -->

# Claude Code hook scripts

For the `.claude/hooks/*.sh` contract — the executable bit in the index, hook registration, line endings, failure behaviour, timeouts, and SessionStart output, see [`docs/agents/claude-hook-scripts.md`](docs/agents/claude-hook-scripts.md).

# Codex Desktop worktree setup

For Windows Codex Desktop worktree bootstrap and dry-run instructions, see [`docs/agents/codex-desktop-worktree-setup.md`](docs/agents/codex-desktop-worktree-setup.md).

<!-- END:codex-desktop-worktree-setup -->

# Reasoning effort calibration

For the Codex reasoning-effort baseline, the Cloud `xhigh` confirmation gate, and the
plan-effort/build-effort table, see
[`docs/agents/codex-reasoning-effort.md`](docs/agents/codex-reasoning-effort.md).

<!-- BEGIN:process-hardening -->

# Process hardening phases

## Bare PR publication is not readiness work

When the user says `open PR`, `create PR`, or `publish PR` without also requesting review, validation, readiness, or CI observation, treat it as a request to publish the prepared change promptly. GitHub is the requested verification surface.

- Inspect only what is necessary to avoid publishing the wrong change: the branch, base, staged/unstaged scope, and PR title/body. Reuse an existing dedicated branch or worktree rather than recreating it. Do not fetch, pull, rebase, review the ledger, inventory history, load a release/handover skill, or create a worktree unless it is necessary to keep unrelated work out of the PR.
- Do **not** run or wait for `npm run format`, dependency installation or linking, `npm run verify:pr-local`, tests, lint, typecheck, builds, browser checks, audits, generated-document synchronization, or CI. Do not invoke a release/readiness workflow for this request.
- If a local commit hook or a readiness-only push guard (format or static) is the only blocker, publish with `git commit --no-verify` and that guard's own scoped override (`SKIP_FORMAT_GUARD=1` or `SKIP_STATIC_GUARD=1`, as applicable) instead of `git push --no-verify`; do not spend time preparing dependencies or formatting solely to satisfy the hook. Never skip the push hook wholesale — the auto-merge ownership guard has no override and must never be bypassed, even for a bare-publication request. This exception is limited to the explicit bare-publication request and does not weaken normal-push safeguards.
- Create the PR immediately after the push, using the repository PR template where its policy fields apply. Report the URL and identify all local and hosted checks as unrun by request. Do not babysit CI, amend, or perform follow-up readiness work unless the user asks. This route overrides generic branch-bundling, handover, review, and babysit instructions.

- **For normal engineering pushes, run `npm run format` and commit the result before push.** This rule does not apply to the explicit bare PR publication route above. Formatting is in neither `npm run test`, `npm run typecheck`, nor `npm run lint`, so the ordinary loop can report green while the changed-file CI check or exact-commit pre-push guard fails. Three CI failures on 2026-07-30 came from exactly this (two of them on `ci/circleci: verify`, since removed from the repo by PR #1412). Two traps beyond simply running it:
  - **Formatting without committing does nothing for the push.** A push sends commits, not your working tree, so formatting after committing leaves the unformatted blob on the branch. Amend or add a follow-up commit.
  - **A per-file check is not the repository-wide check.** `prettier --check <file>` on the source file you edited passes while a doc or ledger edit in the same push fails; that was the missed file twice out of three.

  `.githooks/pre-push` carries the guard, and since 2026-07-30 it checks the pushed commit where CI checks it: `guard-push.mjs` puts the pushed SHA in a temporary `git worktree` with an exact-lock `node_modules` linked in and runs Prettier there, so neither the working tree's contents nor its prettier config can vouch for the commit, and a dynamic `prettier.config.*` still loads. An isolated worktree without local dependencies may reuse Prettier only from a registered worktree with a byte-identical lockfile and matching installed Prettier version; if none exists, the guard blocks with the explicit `npm ci --include=dev` remediation instead of skipping formatting. A push that changes prettier policy (`.prettierrc*`, `.prettierignore`, `.editorconfig`, or a `package.json` carrying a `prettier` field) escalates to a whole-tree `prettier --check .`, because a policy change alters the verdict for files the push never touched. But `core.hooksPath` is set by this checkout's `npm install`, so an agent pushing from its own environment bypasses the hook entirely and only CI catches the break — which is why the rule above is still a rule.

For the verification principle, the tier table, and the rest of the gate-selection rules, see [`docs/agents/verification-gates.md`](docs/agents/verification-gates.md).

## Do not pay twice for the verdict GitHub is about to reach

For the rule against re-deriving a verdict GitHub is about to reach, the gate arbiter's inputs and non-negotiable boundaries, and the browser-gate planner that narrows `verify:ui` to the specs a diff can actually break (`npm run plan:browser`), see [`docs/agents/verification-gates.md`](docs/agents/verification-gates.md).
<!-- END:process-hardening -->

<!-- BEGIN:page-and-button-wiring -->

# Deleting code you believe is dead

For what must hold before removing an exported symbol, and the `check:dead-code-candidate` refusal list, see [`docs/agents/dead-code-deletion.md`](docs/agents/dead-code-deletion.md).

# Deleting tests, or letting a tool delete them for you

For the 2026-08-31 whole-file truncation incident (`#Y30AXB`), the `check:diff-integrity` test-case floor and truncation-artefact rules, and how a deliberate reduction is recorded in `diff-integrity.json`, see [`docs/agents/test-deletion-guard.md`](docs/agents/test-deletion-guard.md).

# Page and button wiring

For the button, navigation, new-route, and gate rules, see [`docs/agents/wiring-and-bundle-budget.md`](docs/agents/wiring-and-bundle-budget.md).

# Bundle budget

For the three `bundle-budget.json` safeguards, how chunks are attributed, and how to measure them, see [`docs/agents/wiring-and-bundle-budget.md`](docs/agents/wiring-and-bundle-budget.md).
<!-- END:page-and-button-wiring -->

<!-- BEGIN:search-chrome-behaviour -->

# Search chrome behaviour

The shared search chrome must adapt by page ownership, not by ad-hoc padding or route-local overlays. Before changing `MasterSearchHeader`, `GlobalSearchShell`, `ClinicalDashboard`, `DocumentViewer`, phone dock reserves, or search-composer placement, read `docs/search-chrome-behaviour.md`.

- **One owner.** A page either uses the shell/dashboard composer, owns an in-flow hero composer, or owns a document-viewer composer. Do not stack a second fixed search bar or a second dock-sized content pad below a page-owned composer.
- **Phone edge-to-edge contract.** Fixed phone composers are flush to the viewport bottom and paint their own safe-area/home-indicator region while visible. They must not use a non-zero `bottom` gap in edge-to-edge dock mode.
- **Hidden means zero reserve.** When phone search/header/footer chrome scroll-hides, the content-facing reserve is `0rem`; do not restore `0.75rem`, `env(safe-area-inset-bottom)`, or `var(--safe-area-bottom)` as hidden padding. Visible composer chrome may still consume safe-area inset.
- **Header/footer symmetry.** Top header and bottom composer hide/reveal from the same scroll signal where they share a scroll container. If one is hidden, page content behind that edge must be fully visible rather than covered by an opaque white/surface band.
- **Page adaptation.** Standalone mode homes keep the composer in-flow in the hero on phones; submitted/search-result views use the compact bottom dock; answer mode may use overlaid glass header behaviour with matching top reserve; document detail/source routes let `DocumentViewer` own its composer.
- **Default in-page navigation.** When adding or suggesting in-page navigation on any mode page, use the DocumentViewer header as the template: back control, title + active-section subtitle + chevron sheet, ellipsis actions, weighted segment track, and `PhoneHeaderCollapsePortal` so the header attaches under the universal phone header and hides/reveals with that single collapse owner. Do not invent a second sticky/fixed phone nav header or a separate scroll-hide hook. Full contract: `docs/search-chrome-behaviour.md` (“Default in-page navigation template”). Therapy `ModeNav` remains a different multi-route pattern.
- **Guards.** Update the reserve helper, CSS tokens, Playwright phone-scroll coverage, and static contract tests together. Do not silence the existing reserve/overlay tests; add a narrower guard for any new page-specific exception. Run `npm run verify:phone-chrome`; its smart selector must keep focused owner/journey proof before any recommended full `verify:ui` escalation.

<!-- END:search-chrome-behaviour -->

<!-- BEGIN:external-skill-precedence -->

# External skill precedence

For how repository contracts outrank generic external skills and output-style plugins, see [`docs/agents/external-skill-precedence.md`](docs/agents/external-skill-precedence.md).

## Evidence and calibration are never compressed

For the rules on pasting the decisive gate line, stating verified versus assumed, verifying third-party fix claims, and writing PR titles and descriptions as parsed input, see [`docs/agents/external-skill-precedence.md`](docs/agents/external-skill-precedence.md).
<!-- END:external-skill-precedence -->

<!-- BEGIN:supabase-project-safety -->

# Supabase project safety

- `origin/main` of this repository targets the live Supabase project `Clinical KB Database` (ref
  `sjrfecxgysukkwxsowpy`; the older ref `qjgitjyhxrwxsrydablr` is stale, never use it). **Merging a
  migration to `main` applies it to the live clinical database within seconds**, with no separate
  deploy step to hold it back. That is one reason the Ward Flow line is never pushed, and why nothing
  may ever replace `main`: no force-push, branch replacement or rebuilt publication branch, because a
  replacement would remove migrations that `main` has and this line does not.
- **Treat merge approval as production-deploy approval.** Never merge a PR touching
  `supabase/migrations/**` outside an approved window, and never enable auto-merge on one.
- **Never write PR metadata promising a deferred deploy.** There is no deploy step to defer to, so
  state the merge decision instead ("merge only inside the approved window").
- The database tooling the full version of this section spells out (the migrations, the drift,
  migration-history, migration-role and project checks, and the guard-migration contract) left this
  line with PsychSift on 26 September 2026. Before any database work, read this section in
  `AGENTS.md` on `origin/main`, where its full text still stands.

<!-- END:supabase-project-safety -->

<!-- BEGIN:rag-ranking-protection -->

# RAG ranking protection

The search-ranking code this section protected, and the four documents that described its rules
(`docs/rag-behaviour/`), left this line with PsychSift on 26 September 2026. Before any PsychSift
retrieval or ranking work, read this section in `AGENTS.md` on `origin/main`, where its full text
still stands.

<!-- END:rag-ranking-protection -->

<!-- BEGIN:railway-project-safety -->

# Railway project safety

- This repo deploys to the live Railway project `Database` (`5deaad0b-675a-4c13-978e-5ca2b5b877f9`) in workspace `bigsimmo's Projects`. Full topology: `docs/deployment-architecture.md` §1.
- Production services `Database` (Next.js app tier, serves `https://psychiatry.tools`) and `worker` (ingestion) auto-deploy from `BigSimmo/Database` pushes to `main`; the `staging` environment runs the `app` service.
- The older Railway project `clinical-kb` (`4361c04f-dd3c-4ee9-9e97-49e4e5707b70`) is superseded with zero active deployments; treat it as stale — never `railway link` to it or deploy there.
- The similarly named Supabase project `Clinical KB Database` is the database/auth tier, not a Railway project; see "Supabase project safety" above.
- Railway CLI token auth uses `RAILWAY_API_TOKEN` (personal account token; see `.env.example`). The project-scoped `RAILWAY_TOKEN` is for CI deploys only and cannot list or link projects; Cloud runtime acceptance no longer installs or probes the CLI, so that substitution rule is documentation-enforced until an operator workflow reintroduces CLI checks. Desktop/CLI MCP uses the secret-free `railway` entry (enable in `$CODEX_HOME/config.toml` or via a never-committed local edit — never commit `enabled = true`) plus `codex mcp login railway`; neither repository MCP file activates a hosted ChatGPT/Codex app.
- Railway deploys and mutations fall under the "API and provider confirmation boundary" below; verify target project/environment IDs before any mutation.

<!-- END:railway-project-safety -->

<!-- BEGIN:api-confirmation-boundary -->

# API and provider confirmation boundary

- Never run, modify, test, or otherwise interact with OpenAI, Supabase, GitHub/GitLab, hosted CI, production-like services, or provider-backed workflows without explicit user confirmation.
- Treat indirect API usage inside scripts, tests, release checks, PR tooling, and review automation as confirmation-required too.
- Prefer local, static, mocked, or offline checks. If a recommended verification would touch a provider, report the command and ask before running it.
- `npm run check:supabase-project`, live PR/CI tooling, answer-generation checks, ingestion checks against live services, and release gates that call providers are not automatic.
- Exception: the `Run PR` shortcut (see "## Run PR shortcut") is standing user confirmation for the specific GitHub actions it enumerates, for the duration of that sweep only.

<!-- END:api-confirmation-boundary -->

<!-- BEGIN:upload-shortcut -->

# `upload` shortcut

For the `upload` safe Git handoff workflow — protected branches, required inspection, safe versus confirmation-required actions, branch cleanup, syncing, and the final report, see [`docs/agents/upload-shortcut.md`](docs/agents/upload-shortcut.md).
<!-- END:upload-shortcut -->

<!-- BEGIN:run-pr-shortcut -->

<!-- BEGIN:pr-branch-sync -->

## Open PR branch sync (anti-churn)

For the anti-churn branch-sync mitigations and the `git merge-tree` test that tells staleness from a real conflict, see [`docs/agents/pull-request-workflow.md`](docs/agents/pull-request-workflow.md).
<!-- END:pr-branch-sync -->

## Run PR shortcut

For the `Run PR` open-PR maintenance sweep — what it authorizes, its hard guardrails, and its procedure, see [`docs/agents/pull-request-workflow.md`](docs/agents/pull-request-workflow.md).
<!-- END:run-pr-shortcut -->

## Babysit the pull request, then stop

For the 30-minute post-PR CI budget, what may be done inside it, and how it is enforced, see [`docs/agents/pull-request-workflow.md`](docs/agents/pull-request-workflow.md).

## Automated review coverage (owner decision, 2026-08-22)

For the 2026-08-22 owner decision on automated review coverage, see [`docs/agents/pull-request-workflow.md`](docs/agents/pull-request-workflow.md).

## PR bundling (reduce one-task-one-PR churn)

For when a task may ride an already-open PR, the two-way low-risk test, and what must never be bundled, see [`docs/agents/pull-request-workflow.md`](docs/agents/pull-request-workflow.md).
<!-- BEGIN:anti-conflict-speed -->

## Anti-conflict and CI-speed operating procedure

Goal: fewer false merge conflicts, less cancelled CI, and faster feedback — without weakening required gates, flake policy, provider boundaries, or clinical/RAG safeguards. Do not touch unrelated active PRs unless the user explicitly asks (`Run PR`, sync, or a named PR).

### Prevent conflicts before they start

- Prefer fewer, shorter-lived PRs. Bundle independently low-risk append-only docs/ledger chores (see "## PR bundling") instead of one PR per line.
- Start from a fresh `origin/main` worktree/branch (`newtask`); do not pile new work onto a stale head that already shares hot files with the open queue.
- Before calling GitHub `DIRTY`/`CONFLICTING` a real conflict, run `git merge-tree --write-tree origin/main <tip>`. Clean tree + behind = sync; dirty tree = real conflict.

### Speed CI without skipping quality

- Assemble every commit for a head before the first push, or wait for the current PR CI run to settle before pushing again. Apply the same settle-first rule to branch syncs: for a behind-but-clean PR with required CI in flight, wait, then perform at most one late `update-branch` / `git merge origin/main` after review and fix work is assembled. Cancel-in-progress remains enabled for pull requests (pushes mid-run cancel Production UI), but is deliberately disabled for base-branch pushes (`tests/ci-cache-safety.test.ts`).
- For Run PR sweeps and normal readiness pushes — never an explicit bare PR publication — run `npm run format` **and commit the result**, then `npm run verify:pr-local` (or the smallest gate that covers the change). Format is in `static-pr` but not in `verify:cheap`; an uncommitted format leaves CI red on the pushed blob. Whole-tree Prettier, not a single edited file.
- If a PR has auto-merge armed, its auto-merge state is user-owned and automation must not disable or re-enable it. Ordinary fast-forward pushes, `update-branch`/merge-main-in syncs, and bundled additions may proceed — GitHub re-validates required checks against the new head before merging, so an additive push cannot slip past that. A force-push, history rewrite, or base/target change while armed still hard-blocks with no override; wait for the user to change that state first.
- Missing CI checks are not a green pass. The `PR mergeability` check uses trusted `pull_request_target` events and refreshes unchanged PR heads after protected-base pushes; it fails explicitly on `mergeable_state: dirty`. Behind-but-clean heads use `npm run sync:pr-branches` / `:apply` with human `gh` auth — never bot `update-branch`.
- Triage and repair actionable review threads early; reply before resolving (`<!-- codex-thread-disposition:resolved -->`). Leave ambiguous or product-sensitive threads open for the owner.
- Babysit dormant: observe fresh CI only at meaningful stage boundaries (at most once every 5 min, ≤30 min per run). If queued/running at limit, record run URL as deferred and continue sweep.
- For sweeps needing local repair, prepare one isolated, exact-lock worktree via `node scripts/setup-codex-worktree.mjs`.
- Treat merge queue state as read-only. Fall back to Actions runs for exact head SHA if `gh pr checks` cannot read check runs.
- Keep Playwright blocking tests at zero retries; quarantine via `tests/flake-ledger.json` only after three reproductions on the same SHA.

### Operator sync (explicit only)

- Leave active PRs alone unless requested. Report: `npm run sync:pr-branches`. Apply with confirmation and human/operator auth: `npm run sync:pr-branches:apply`.

<!-- END:anti-conflict-speed -->

<!-- BEGIN:codex-productivity-defaults -->

## Codex productivity defaults

For Codex-specific productivity shortcuts and operating rules, see [`docs/agents/codex-productivity-defaults.md`](docs/agents/codex-productivity-defaults.md).

<!-- END:codex-productivity-defaults -->

<!-- BEGIN:repo-productivity-skills -->

## Repository productivity skills

For the repo-local skill catalogue and the foundational orchestration skills, see [`docs/agents/repository-skills-and-issues.md`](docs/agents/repository-skills-and-issues.md).
<!-- END:repo-productivity-skills -->

## Codex GitHub review behavior

For Codex's automated GitHub pull request review and auto-resolve behavior — severity
calibration, PR risk detection, cost controls, the review comment lifecycle, the automatic
resolve trigger, and the primary PR command — see
[`docs/agents/codex-github-review.md`](docs/agents/codex-github-review.md). That file is the
exact text `scripts/check-codex-autofix-workflow.mjs` enforces against the live workflow; do not
let a copy in this file drift from it.

## Codex Cloud environment

For the Codex Cloud environment specification, access profiles, MCP limits, and acceptance checks, see [`docs/agents/codex-cloud-environment.md`](docs/agents/codex-cloud-environment.md).

## Cursor Cloud specific instructions (not Codex Cloud)

For Cursor Cloud agent setup, live-vs-demo mode detection, verification commands, and GitHub
connector guidance, see [`docs/agents/cursor-cloud.md`](docs/agents/cursor-cloud.md).

# Commit as you go — the thing that loses work here is interruption, not carelessness

Work sitting uncommitted is the only work this repository can lose. Commit when a change becomes
coherent, **not when the task ends** — a task in this project routinely spans hours, several agents,
a blocked gate and four other conversations.

**The trigger to watch is being interrupted, and it does not feel like risk at the time.** The
observed failure, 2026-08-29: seven files were formatted, the verifying test run was refused because
another worktree held the machine-wide lock, and attention moved to answering other sessions. The
files sat uncommitted for an hour, through a dozen unrelated commits, and were found only because an
unrelated status check happened to list them. Nothing about that hour felt like carrying risk. **The
work was finished and the mind had moved on — that combination is the hazard.**

## The rule

**Before you turn from your own work to anything else — answering another session, waiting on a lock,
investigating a tangent, reporting to the user — either commit what you have, or state in your next
message exactly what is uncommitted and why.** Saying it out loud is what makes it recoverable; a
silent working tree is not a memory.

- **Commit each coherent unit** — a module and its test, a fix and its proof, a document. Not the
  whole task.
- **A formatting pass is a commit**, not a loose end to tidy later. It is the change most often
  orphaned, because it feels finished the moment it is written.
- **Waiting is not a reason to hold a commit.** If a gate is blocked, commit the work and record the
  gate as unrun. An unverified commit is recoverable; an unwritten one is not.
- **Never `git add -A`** — another agent may share this worktree, and the wildcard commits their
  in-flight edits under your message.
- **Mutation testing requires committing first.** Restoring a tracked file with `git checkout --`
  also discards any uncommitted fix inside it, and `git checkout --` has no effect at all on an
  untracked file — it leaves the mutation in place and reports an error most drivers never read.

## Why this matters more here than in an ordinary repository

**A worktree under `.claude/worktrees` has twice been removed mid-session on this machine** by
unrelated cleanup sessions. A commit is what makes that survivable: the branch ref and the objects
live in the shared repository at the top level, not in the worktree folder, so losing the folder
costs nothing but a fresh checkout. **An uncommitted file is the only thing that does not survive it.**

## When you genuinely cannot commit

The pre-commit hook refuses whenever other unstaged or untracked files exist under `src/components/`
or `tests/` — so while a concurrent agent is mid-write, you cannot commit even work of your own that
is entirely disjoint. That is correct behaviour and must not be worked around.

**When it blocks you, say so in your next message and name the files.** Then commit the moment the
tree is yours again. The failure mode is not the block; it is forgetting that the block happened.
