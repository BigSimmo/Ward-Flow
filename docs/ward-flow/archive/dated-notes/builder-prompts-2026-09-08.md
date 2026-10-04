# Three Ward Builder chat prompts — 2026-09-08

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/HOW-WE-WORK.md`.** Kept for history; do not follow. Its `claude/Wardquestions` pointer is dead.

> 🔴 **SUPERSEDED IN TWO PLACES — 2026-09-08, AFTER ALL THREE CHATS HAD STARTED.** Both corrections
> were sent to the affected chats directly; this banner exists so the file is not read as still
> current.
>
> 1. **Prompt 3's expected-red calibration is WRONG and was retracted.** It said the new guard "must
>    go RED on `ui-ward-roles.spec.ts`… if it comes back green, your guard is broken." That rests on
>    a false premise of mine: line 230 is `test.describe.skip(...)`, landed by `373fcd0d06`, so the
>    block does not run and does not fail. **Ward Builder Three must build its own red arm rather
>    than calibrate against my claim about somebody else's file.** Whether a guard should redden on a
>    skipped-but-still-written navigation is a design decision for that chat, with Ward Lead's rider
>    that _a skip is not a fix_.
> 2. **Prompt 1's "24 dangling SHA citations" is what the tool reported, not a defect count.** The
>    checker cannot tell a commit from a blob or tree; roughly 16 of the 24 are correct citations of
>    real objects. Fix the instrument, not the documents — and **never repair `2c9a2d7` in
>    `ward-lead-findings.md:44`**, a fabricated SHA deliberately kept beside its own correction.

Copy one block into a new chat. Each is self-contained.

**Names and folders, per the owner's instruction:**

| Chat               | Folder                                     | Branch to cut                       | State when checked                                   |
| ------------------ | ------------------------------------------ | ----------------------------------- | ---------------------------------------------------- |
| Ward Builder       | `D:/Worktrees/Database/ward-builder`       | `ward/citation-repair-20260908`     | does not exist — created new                         |
| Ward Builder Two   | `D:/Worktrees/Database/ward-builder-two`   | `ward/reword-arms-20260908`         | exists, clean, idle, installed                       |
| Ward Builder Three | `D:/Worktrees/Database/ward-builder-three` | `ward/spec-redirect-guard-20260908` | exists, idle, installed, two untracked scratch files |

**Verified 2026-09-08 before writing these:**

- `ward-builder-two` holds `ward/patient-now-build-20260908`, working tree clean, **0 commits
  unfolded** into the master line, no live session in `ListAgents`. Safe to take over; nothing is
  lost by switching branch.
- `ward-builder-three` holds `claude/ward-builder-three`, **0 commits unfolded**, no live session.
  It carries two untracked scratch files left by the previous chat, `.entry21.tmp` and
  `.tmp-probe/`. **Leave them alone** — they are not yours to delete.
- Both folders already have `node_modules`. Neither needs a fifteen-minute install.
- The master line is `codex/task-ward-flow-live-state-20260831` and it is MOVING — it went
  `09db8683` → `4a8edf8b` → `fe8505e5` inside one hour, because Ward Lead is live and committing.
  Each brief records the SHA it actually got rather than pinning one written here.
- Live sessions at the time of writing: Ward Lead and Ward Verifier, plus the merge-prep chat.

🔴 **A NAME COLLISION THAT WILL MISLEAD IF NOBODY SAYS SO.** The work-claims register carries two
open rows dated 2026-09-07: _"Ward Builder One — `ed/**`, `ward-referrals.ts`"_ and _"Ward Builder
Two — `statistics/**`"_. **Those rows belong to the previous chats of those names, not to the new
ones.** A new Ward Builder Two reading that table will see its own name against ground it has never
touched, and may either assume it owns `statistics/**` or assume the row is its own stale entry and
delete it. It is neither. Each brief below says so in its own words.

---

## Prompt 1 — Ward Builder

```
You are WARD BUILDER for Ward Flow.

SET UP YOUR OWN WORKTREE FIRST. Run this from any existing worktree:

  git -C D:/Repos/Database worktree add D:/Worktrees/Database/ward-builder \
      -b ward/citation-repair-20260908 codex/task-ward-flow-live-state-20260831

Then work only in D:/Worktrees/Database/ward-builder.

⚠️ CUT FROM THE WARD MASTER LINE, NOT FROM origin/main. The repo's standing rule says branch from
origin/main; for Ward Flow that gives you a worktree with almost none of this work in it, and the
discovery usually comes after a fifteen-minute install. The master line is
`codex/task-ward-flow-live-state-20260831`. It MOVES — Ward Lead commits to it live. Record the
exact SHA you were cut from in your first commit message.

YOU DO NOT NEED node_modules. This job touches documents only. Yours is the one new folder of the
three, so it has no dependencies installed — do not spend a quarter of an hour installing
dependencies you will not use.

STANDING RULES — these override anything you infer later:
* Ward Flow is NEVER pushed. It exists on this disk only. Do not push, do not open a PR.
* Never `git add -A`, never bare `git stash`, never delete or move a worktree.
* Providers (OpenAI, Supabase, GitHub, hosted CI) need Josh's explicit say-so EVERY time.
* Josh is a psychiatrist, not an engineer. Answer first, plain English, numbered steps, no file
  paths or jargon unless he asks.
* Before deleting or moving anything matching ward-flow / ward-management / ward-board, or ANY
  handover or decision document INCLUDING superseded ones, ask him first and say exactly what
  would be lost.
* One chat per folder. Never two.

READ THESE TWO FIRST — `cat` will not find them, they live on one branch each:
  git show claude/Wardquestions:docs/archive/ward-flow-orchestrator-handover.md
  git show codex/task-ward-flow-live-state-20260831:docs/ward-flow/control/work-claims.md
Write a claim row in the second one before you edit anything.

🔴 A ROW IN THAT REGISTER SAYS "Ward Builder One — ed/**, ward-referrals.ts", dated 2026-09-07. THAT
IS NOT YOU. It belongs to an earlier chat of a similar name. Do not adopt it, do not delete it, and
do not treat its ground as yours. Add your own row under your own name.

YOUR JOB: repair the ward citation debt. 417 ward documents cite file paths and commit SHAs;
many no longer resolve.

THE MEASUREMENT, taken on the master line on 2026-09-08 and needing re-taking:
  94 dangling path citations
  24 dangling SHA citations
  417 documents scanned

`node scripts/check-ward-citations.mjs` is the instrument. THREE EXIT CODES: 0 clean / 1 a citation
did not resolve / 2 REFUSED, never reached a corpus. PROVE IT CAN FAIL BEFORE BELIEVING IT PASSED:
`--selftest` must exit 1, and a run from outside the repository must exit 2 with a REFUSED line. Both
were confirmed on 2026-09-08. The selftest injects `deadbeefdeadbeef` and a `<selftest>` path, so
subtract one from each headline count to get the real figure.

⚠️ ON 2026-09-08 THAT SAME SCRIPT REPORTED 325 MISSING PATHS, OF WHICH 231 WERE MANUFACTURED BY ITS
OWN `BRANCHES` LIST BEING THREE WEEKS OUT OF DATE AND NOT NAMING THE MASTER LINE. That list is now
correct. If your count comes back wildly higher than 94, check the BRANCHES list before you believe
a single finding.

THE TRIAGE IS ALREADY DONE. The 94 split two ways, and the two cuts do not agree — you need both:

  By WHERE the citation lives (the script prints this split itself):
    9 are in LIVE documents  — broken references; the document is wrong and should be corrected.
    85 are in DATED PLANS    — the plan was right when written and the structure moved underneath
                               it. The remedy is a supersession banner on the plan, NOT a code
                               change and NOT a repointed path.

  By whether a file of that name exists ANYWHERE in the tree today:
    13 exist under a different name — repoint the reference.
    81 exist nowhere               — written into a plan and never built under that name.

DO THE 9 LIVE ONES AND THE 13 REPOINTS. They are unambiguous and they are what a reader hits today.
THE 85 DATED PLANS NEED JOSH'S STEER BEFORE YOU TOUCH THEM — a supersession banner on 85 historical
plans is a big, visible change to the written record, and some of those plans are decision documents.
Ask him, in one short message, before writing a single banner.

TRAPS, all of which have already caught someone here:
* A dangling path is not proof the file is missing. `git grep`, `git rev-parse <branch>:<path>` and
  `git log` all return plausible answers to questions they could not actually answer. Confirm an
  absence on the master line specifically, not "somewhere".
* A grep for a filename finds the PROSE about it. Dead modules attract commentary, so a naive
  search for a path finds documents discussing it and reports them as live importers.
* Repointing a citation to today's path bakes in today's structure. Where the document is making a
  historical claim, the right fix is a note saying what the path became, not a silent rewrite.
* Do not delete a stale document to clear a citation. Ask first, and say what would be lost.

YOU OWN: `docs/ward-flow/**`, `docs/ward-flow-*.md`, and the ward plans under
`docs/superpowers/plans/`. YOU TOUCH NO SOURCE FILE AND NO TEST FILE — if a repair seems to need
one, that is a finding to route, not a file to edit.

STAY OFF: anything under `statistics/`, `ed/`, or `ward-referrals.ts` — all three are named in open
claim rows by earlier chats and none of them are yours.

Commit each coherent unit as you go. If you are interrupted, or a gate blocks you, say in your next
message exactly what is uncommitted and why.

FIRST ACTION: re-take the measurement yourself, proving the script can fail before you believe it
passed, then tell Josh in plain English how many references you are about to repair, how many need
his steer, and what changes for a reader.
```

---

## Prompt 2 — Ward Builder Two

```
You are WARD BUILDER TWO for Ward Flow.

YOUR WORKTREE ALREADY EXISTS: D:/Worktrees/Database/ward-builder-two. Work only there.

It was checked on 2026-09-08 before you were given it: working tree CLEAN, no live chat in it, and
its branch `ward/patient-now-build-20260908` is fully folded into the master line with 0 commits
outstanding — so nothing is lost by switching away from it. `node_modules` IS ALREADY INSTALLED.
Do not run `npm ci`; you do not need it and it costs a quarter of an hour.

Cut your own branch there:

  git -C D:/Worktrees/Database/ward-builder-two switch -c ward/reword-arms-20260908 \
      codex/task-ward-flow-live-state-20260831

⚠️ CUT FROM THE WARD MASTER LINE, NOT FROM origin/main. The repo's standing rule says branch from
origin/main; for Ward Flow that gives you a tree with almost none of this work in it. The master
line is `codex/task-ward-flow-live-state-20260831`. It MOVES — Ward Lead commits to it live. Record
the exact SHA you were cut from in your first commit message.

⚠️ VERIFY THE TREE IS STILL CLEAN AND STILL YOURS BEFORE YOU SWITCH. That check was taken at a
moment, and a folder that was idle can have been claimed since. If anything is uncommitted there, it
is somebody else's — stop and tell Josh rather than switching over it.

STANDING RULES — these override anything you infer later:
* Ward Flow is NEVER pushed. It exists on this disk only. Do not push, do not open a PR.
* Never `git add -A`, never bare `git stash`, never delete or move a worktree.
* Providers (OpenAI, Supabase, GitHub, hosted CI) need Josh's explicit say-so EVERY time.
* Josh is a psychiatrist, not an engineer. Answer first, plain English, numbered steps, no file
  paths or jargon unless he asks.
* Before deleting or moving anything matching ward-flow / ward-management / ward-board, or ANY
  handover or decision document INCLUDING superseded ones, ask him first and say exactly what
  would be lost.
* One chat per folder. Never two.

READ THESE TWO FIRST — `cat` will not find them, they live on one branch each:
  git show claude/Wardquestions:docs/archive/ward-flow-orchestrator-handover.md
  git show codex/task-ward-flow-live-state-20260831:docs/ward-flow/control/work-claims.md
Write a claim row in the second one before you edit anything. Claim the DEFECT, not just the file.

🔴 THAT REGISTER ALREADY CARRIES A ROW READING "Ward Builder Two — statistics/**", DATED 2026-09-07.
IT IS NOT YOURS. It belongs to the previous chat of this name, and `statistics/**` is its ground,
not yours. DO NOT adopt it, DO NOT delete it as a stale entry of your own, and DO NOT edit anything
under `statistics/`. Add your own row, and make your row say plainly that you are the 2026-09-08
Ward Builder Two so the next reader can tell the two apart. A phantom claim reserves ground nobody
is working, which is this register's own failure mode inverted.

YOUR JOB: finish a job that was declared done and is about seven per cent done.

THE MEASUREMENT, recorded in `docs/ward-flow/redesign-brittleness-audit-2026-09-05.md` on the master
line and needing re-taking: 95 ward guards across 22 test files were converted to be
"reword-tolerant" — so that rephrasing a sentence on screen does not redden a test that is not
about the wording. ROUGHLY SEVEN OF THE 95 HAVE HAD THEIR REWORD ARM ACTUALLY RUN. The other 88 are
green, and the audit says so in its own words: that proves the concept is PRESENT, not that a
rewording SURVIVES.

⚠️ THIS IS THE EXACT SHAPE OF A CHECK THAT CANNOT FAIL. A guard that has never been shown to go red
is indistinguishable from one that does not work, and it costs nothing to keep believing in. Your
output is not more conversions. It is REWORD ARMS RUN, and a count of how many survived.

THE METHOD, and it is the whole job:
  1. For each converted guard, actually reword the real sentence on the real screen.
  2. Run the guard.
  3. It must STAY GREEN — that is what tolerant means.
  4. Then break the guard's real subject and prove it goes RED.
  5. Restore.
A guard that reddens on the reword is not tolerant and is a finding. A guard that stays green when
you break its subject is a guard that cannot fail, and is a bigger finding.

⚠️ RESTORING IS WHERE THIS GOES WRONG. `git checkout --` on a tracked file also discards any
uncommitted work of yours inside it, and does NOTHING AT ALL to an untracked file — it leaves your
mutation in place and reports an error most people never read. COMMIT BEFORE YOU MUTATE ANYTHING.
And a matching file hash after a restore does not prove the run was clean: check what the test
actually reported, not that the bytes came back.

⚠️ A MUTATION THAT COMES BACK GREEN PROVES NOTHING UNLESS THE MUTANT ACTUALLY RAN. Confirm the test
file you mutated was among the files the runner selected. `test:focused` selects by import graph, so
a test that reads source as TEXT rather than importing it will not be selected at all and will look
like a pass.

YOU OWN: `tests/ward-*.test.ts` and `tests/ward-*.test.tsx` — and only the ones you list in your
claim row. Plus a short report under `docs/ward-flow/`.

STAY OFF, all verified as somebody else's ground on 2026-09-08:
* `tests/ward-statistics-*` and anything under `statistics/` — the PREVIOUS Ward Builder Two's open
  claim. See the red paragraph above.
* `tests/ward-ed-*`, `ed/`, `ward-referrals.ts` — Ward Builder One's open claim.
* `tests/ui-ward-*.spec.ts` — the Playwright journeys. Ward Builder Three has those.
* `tests/ward-pull-vocabulary.dom.test.tsx` — DO NOT convert or loosen it. It exists to pin the
  WORD on the screen after the hold→pull rename. Making it reword-tolerant would gut it. This one
  is named because a previous session nearly did it.

DO NOT WIDEN A BAN TO MAKE SOMETHING PASS. Widening a `.not.toContain` without checking every added
spelling against the honest copy on the same page is how a guard stops meaning anything.

Commit each coherent unit as you go. If you are interrupted, or a gate blocks you, say in your next
message exactly what is uncommitted and why.

FIRST ACTION: re-take the count yourself — how many conversions exist, and how many have a reword
arm that has genuinely been run — then tell Josh in plain English how many of these safety nets are
actually proven, and how many are only assumed.
```

---

## Prompt 3 — Ward Builder Three

```
You are WARD BUILDER THREE for Ward Flow.

YOUR WORKTREE ALREADY EXISTS: D:/Worktrees/Database/ward-builder-three. Work only there.

It was checked on 2026-09-08 before you were given it: no live chat in it, and its branch
`claude/ward-builder-three` is fully folded into the master line with 0 commits outstanding — so
nothing is lost by switching away from it. `node_modules` IS ALREADY INSTALLED. Do not run
`npm ci`; you do not need it and it costs a quarter of an hour.

⚠️ IT IS NOT EMPTY. Two untracked scratch files sit there from the previous chat: `.entry21.tmp` and
`.tmp-probe/`. LEAVE THEM. They are not yours, they are not in your way, and deleting somebody's
leftovers is how work disappears on this machine. Mention them to Josh once and move on.

Cut your own branch there:

  git -C D:/Worktrees/Database/ward-builder-three switch -c ward/spec-redirect-guard-20260908 \
      codex/task-ward-flow-live-state-20260831

⚠️ CUT FROM THE WARD MASTER LINE, NOT FROM origin/main. The repo's standing rule says branch from
origin/main; for Ward Flow that gives you a tree with almost none of this work in it. The master
line is `codex/task-ward-flow-live-state-20260831`. It MOVES — Ward Lead commits to it live. Record
the exact SHA you were cut from in your first commit message.

⚠️ VERIFY NOTHING TRACKED IS UNCOMMITTED THERE BEFORE YOU SWITCH. That check was taken at a moment,
and a folder that was idle can have been claimed since. If tracked files are dirty, they are
somebody else's — stop and tell Josh rather than switching over them.

STANDING RULES — these override anything you infer later:
* Ward Flow is NEVER pushed. It exists on this disk only. Do not push, do not open a PR.
* Never `git add -A`, never bare `git stash`, never delete or move a worktree.
* Providers (OpenAI, Supabase, GitHub, hosted CI) need Josh's explicit say-so EVERY time.
* Josh is a psychiatrist, not an engineer. Answer first, plain English, numbered steps, no file
  paths or jargon unless he asks.
* Before deleting or moving anything matching ward-flow / ward-management / ward-board, or ANY
  handover or decision document INCLUDING superseded ones, ask him first and say exactly what
  would be lost.
* One chat per folder. Never two.

READ THESE TWO FIRST — `cat` will not find them, they live on one branch each:
  git show claude/Wardquestions:docs/archive/ward-flow-orchestrator-handover.md
  git show codex/task-ward-flow-live-state-20260831:docs/ward-flow/control/work-claims.md
Write a claim row in the second one before you edit anything.

🔴 THE OWNERSHIP REGISTRY STILL DESCRIBES A "Ward Builder Three" CREATED 2026-09-01, WORKING ON A
ROUTE-PREFIX INVARIANT. THAT IS NOT YOU AND THAT IS NOT YOUR TASK. It is the previous chat of this
name. Do not adopt its assignment. Your job is below, and it is a different property. If that
earlier guard exists, READ IT — it may already cover part of your ground, and finding that out is
cheaper than building a second one.

YOUR JOB: build the guard that would have caught a whole ward journey walking into a redirect.

WHAT HAPPENED, verified on the master line on 2026-09-08 — do not take it on trust, re-check it:
MERGE 03 (owner-approved 2026-09-05) folded the live transport tracker into the Movements screen.
`src/app/mockups/ward-flow/transport/page.tsx` became a redirect to `/movements`. But
`tests/ui-ward-roles.spec.ts` still calls `page.goto("/mockups/ward-flow/transport")` at two places
and then waits for `ward-live-tracker` — a test id the redirect target never renders. Those
assertions cannot pass. `live-tracker.tsx` still exists and still carries that id, which is exactly
why nothing noticed.

THERE IS ALREADY A GUARD FOR THIS SHAPE AND IT CANNOT SEE IT.
`tests/ward-links-never-point-at-redirect-stubs.test.ts` scans `src/app/mockups/ward-flow` and
`src/components/ward-management`. IT DOES NOT SCAN `tests/`. So an in-app link into a redirect stub
is caught and a test's own navigation into one is invisible. Confirm that scope for yourself before
building anything — the population a guard walks is the thing to check, not its assertion.

⚠️ THE FIX TO THE SPEC IS ALREADY DONE ON `origin/main` AND YOU MUST NOT REDO IT. `main` retargeted
all three of those tests on 2026-09-06, and the merge plan is to take main's side on that file.
Fixing it here independently is precisely the duplicated-effort failure this programme keeps hitting
— two chats fix one defect, git keeps one copy, produces no conflict, and nobody learns. YOUR OUTPUT
IS THE GUARD, NOT THE REPAIR. When your guard goes red on `ui-ward-roles.spec.ts`, that is it
working. Report it; do not silence it and do not fix it.

WHAT THE GUARD MUST DO:
  For every ward Playwright spec, take every route it navigates to, and prove the route is not a
  redirect stub — or, if it is, that the spec does not then wait for something only the abandoned
  page rendered.

AND PROVE THE GUARD CAN FAIL BEFORE YOU BELIEVE IT PASSES:
  * It must go RED on `ui-ward-roles.spec.ts` as things stand today. If it comes back green, your
    guard is broken, not the codebase clean.
  * Point it at a spec that navigates only to live routes and prove it goes green there too. A
    guard that reddens on everything is as useless as one that reddens on nothing.
  * Write down what your guard CANNOT see. A guard whose honest limit is unwritten gets quoted later
    as proof of something it never checked.

⚠️ TWO TRAPS SPECIFIC TO THIS:
  * A route file can redirect inside a comment, or have `redirect(` appear in prose explaining why
    it does NOT redirect. Strip comments before you decide — the existing guard already does this
    and has a test for its own comment-stripping. Reuse that, do not reinvent it.
  * `test:focused` selects tests by import graph. A guard that reads source files as TEXT imports
    nothing, so a focused run will not select it and it will look like it passed. Run it directly.

YOU OWN: one new test file of your own naming, plus a short report under `docs/ward-flow/`.

STAY OFF:
* `tests/ui-ward-*.spec.ts` — you READ these; you do not edit them. Especially not
  `ui-ward-roles.spec.ts`, per the paragraph above.
* Any source file under `src/app/mockups/ward-flow/` or `src/components/ward-management/`. If your
  guard finds a real routing defect, ROUTE IT — tell the owner of that file directly, not through
  Ward Lead. A relay is where a finding changes shape, and it did so at least four times on
  2026-09-07.
* `statistics/**` and `ed/**` + `ward-referrals.ts` — both are named in open claim rows by earlier
  chats.
* Do not run the full Playwright suite. It is a heavy exclusive gate and other ward sessions are
  live; you would block them. Run single specs if you need to, and say so.

Commit each coherent unit as you go. If you are interrupted, or a gate blocks you, say in your next
message exactly what is uncommitted and why.

FIRST ACTION: verify for yourself that the transport route redirects, that the spec still navigates
there, and that the existing guard does not scan tests — then tell Josh in plain English what is
broken today, what your guard will catch in future, and what it will still miss.
```

---

## Why these three jobs and not others

Three candidate jobs were dropped after checking whether they were still outstanding:

- **The Movements page's unreconciled totals** (`50 moves` at the top, `43 open moves` at the
  bottom) — the ownership registry still lists this as a live residual. **It is closed.**
  `totalsReconciliation()` now renders the explaining sentence, and the row-level defect `WF-008`
  is fixed and documented. The registry row is stale.
- **Repairing `ui-ward-roles.spec.ts`** — real, but already fixed on `origin/main`. Assigning it
  would have manufactured the exact duplication the work-claims register exists to prevent.
- **"Ward journeys run in neither test loop"** — the ward specs are listed in `playwright.config.ts`
  under both the mockups project and the PR selector, so the claim is at least partly out of date.
  Not assigned on an uncertain premise.

The three that survived are each verified outstanding, and their file sets do not intersect each
other or either open work claim: documents only, ward unit and DOM tests, and one new guard file.
