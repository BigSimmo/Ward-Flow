# Ward Lead handover — 2026-09-07 (evening)

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

**Master line:** `codex/task-ward-flow-live-state-20260831`
**Read this before starting anything.** It is written for chats that did not see today.

---

## 1. The line is current. Every live branch is folded.

**Nine folds landed this evening, and all six live ward branches now read `0 ahead`.** Every chat
that was building today has stood down with a clean tree and everything of theirs on this line.

⚠️ **Three branches moved between my conflict check and my merge**, which is why every fold below
names a SHA. Two chats committed again _after_ I had already declared them folded.

| Branch                                | Folded at                       | What it carried                                                                                      |
| ------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `claude/ward-screens-build`           | `6f73f5a578`, then `ad26e93157` | Command screen rebuilt to its mockup; four register counts; the coordinator spec following its panel |
| `claude/ward-command-build`           | contained in the above          | (same four commits)                                                                                  |
| `claude/ward-builder-two-phases-3-5`  | `d6f41ce9b5`                    | Five ward end-to-end failures, none a defect in the app                                              |
| `claude/ward-builder-community-route` | `bfeecb2679`                    | The ED "who is here now" comment fix                                                                 |
| `claude/ward-builder-four`            | `258e9e35f8`, then `15655d786e` | 🔴 The forward `composes` returning 500 on every ward page; the scrollport disabling sticky          |
| `claude/ward-screens-build` (again)   | `7f2595b019`                    | The diagram's measured scroll notice and the shortlist's ward detail                                 |
| Ward Builder One                      | `05f0bbca07`                    | Two ED defects only the rendered page could show                                                     |

**Every fold was done by SHA, not by branch name.** Those chats were live and committing while the
folds ran; two branches moved between the conflict check and the merge. A branch name resolves at
read time and is a claim about a moving target.

### Two branches are deliberately NOT folded, and must stay that way

- `claude/ward-verifier-audit-2026-09-04` — 2 commits ahead, **423,176 deletions** against HEAD
- `ward-flow/publish-2026-09-06` — 3 commits ahead, **89,954 deletions** against HEAD

⚠️ **These are stale snapshots, not unfolded work.** Their "ahead" count is real and their content
is already on the line — `patient-typeahead.tsx` and the second-edition guard files are both
present. Folding either would strip the repository. **"Not an ancestor" is not "unfolded".** Check
the deletion count before folding anything that looks behind.

---

## 2. What was built today

**The Delays board**, rebuilt from the owner's locked mockup after he judged the first build
"significantly worse" than the drawing. He was right, and the largest cause was not taste:

> The stylesheet's compact row was written, correct, and rendered by **nothing**. Twelve rules were
> dead because the screen kept calling the shared `WardRecordRow` instead. **A missing wire fails no
> typecheck, no lint and no DOM test. It just looks plain.**

|                      | before | after  |
| -------------------- | ------ | ------ |
| page height          | 7567px | 1622px |
| row height           | 135px  | 83px   |
| per-row 48px buttons | 47     | 0      |

The row is now the control — the mockup's own answer to the tap-target floor. Everything those rows
carried (legal arithmetic, decline count, blocker sentence, the three escalation facts with wards
named, both action routes carrying the patient) was **relocated** into the detail column, not
rebuilt. Re-deriving a compact version would have dropped some of them silently.

**The owner spine.** Every row, owner card and group dot is now coloured by _who_ is holding the
patient up. Four domain hues, added to the v2 token layer (raw colour is forbidden anywhere under
`ward-management`, including its own token file) and aliased in. **Left edge is ownership; severity
is a wash behind it.** Never two stripes competing for one channel.

**The chrome header — eight faults, three of which made controls unusable.** Search results were
clipped and unclickable at every width (12 found, 0 reachable). The search box escaped its container
below ~1024px and covered Figures and Tasks. "Referral board" sat 101px off-screen on a phone. Plus:
two top-anchored bars colliding, the scope chip on its own row contradicting its own comments, the
header jumping 41px between routes, no landmark at all, and a missing `nowrap`.

🔴 **Nothing had been watching it.** Zero matches for any ward-chrome testid across all eleven
`ui-ward-*.spec.ts` files. `tests/ui-ward-chrome-header.spec.ts` now covers the first three with
real clicks — a DOM-presence assertion passed throughout the entire defect.

---

## 3. 🔴 What is NOT verified, and must be before anyone shows this

**The Delays screen has never been seen on a phone.** The dev server would not start for the last
hour of this session. Two independent causes, and I got this wrong once already:

1. The forward `composes` returning 500 on every ward page — **fixed and folded** (`258e9e35f8`).
2. The machine is genuinely out of memory — `dev-server.log` carries
   `memory allocation of 124221634 bytes failed` and a Turbopack panic. **Still true.**

⚠️ **Both explanations predicted the same blank page.** A subagent reported the `composes` failure
by name; I checked, found the class declared, saw a clean tree, and dismissed it as transient — the
class _was_ declared, just below its user, which is the one thing a presence grep cannot see. Then I
attributed the blank page to memory pressure, which was independently true. **A correct diagnosis
for the noise sat on top of a real defect underneath.**

**First job for whoever picks this up: restart the machine, start the server, open
`/mockups/ward-flow/delays` at 375px.** Everything else today is test-verified; this is not.

---

## 4. Decisions waiting on the owner

1. **The wait bands.** Live is under 4h / 4–12h / over 12h. The mockup drew under 8 / 8–24 / over 24.
   Not a rename — a 14-hour wait is _serious_ on one scale and _middling_ on the other. Clinical call.
2. **A lapsed legal authority is filed under "Other".** The mapping is defensible (the deadline sits
   on a transport authorisation, not with any of the five named parties) but on a coordinator's board
   "Other" reads as leftovers, and this is the most urgent thing the screen can show. My
   recommendation: move it to "Yours".
3. **ED always reads "nobody".** No blocker in the model is owned by the referring department. That is
   honest, and it will look broken until he decides whether an ED-owned blocker should exist.
4. **Medical clearance shows "Not assessed" on every row.** The field, the producer and the three-state
   wording are all correct; **0 of 15 seeded referrals carry a clearance record**, and only 2 of ~20
   movements link to a referral at all. The screen cannot demonstrate this until the data has one.

---

## 5. Recorded but not started

- **Two perfected mockup directions covering Command, Capacity and Movements** — the owner chose the
  shape (two alternatives, all three screens in each). Ward Builder Two did not start it, correctly,
  because he then asked to wrap up with the minimum. **Queued, not abandoned, and UNCLAIMED — write a
  work-claims row before picking it up.**
- The five board columns (approved, never built).
- A per-row link from Movements into Delays (his own suggestion).
- 🔴 **The mockup contains 18 claims the live data cannot support**, five of them serious — including
  a sort order that would rank "no bed anywhere in the network" _below_ "waiting for you to decide".
  **None reached the live screen.** Anyone building further from that drawing must read the audit
  first, not the drawing.

---

## 6. 🔴 A merge to `main` is a real piece of work, not a wrap-up step

**Measured on this line, not relayed:**

    ahead of origin/main    2268
    behind origin/main       234
    conflicting files          96      (tests 44 · ward components 38 · docs 8 · infra 6)

⚠️ **Count the conflicted paths only up to the first blank line.** `git merge-tree --name-only`
prints the paths, a blank line, then a long `Auto-merging` / `CONFLICT` transcript of the same
merge. Counting to end-of-file gives ~346 and is the commentary counted as findings. Ward Builder
Two nearly reported that number and caught it; I reproduced 96 independently.

🔴 **Some of these are `add/add` on ward files** — the same paths exist on both sides with
different content, which means ward work has reached `main` by some other route already.
**A conflict resolved by picking a side is a decision about which behaviour survives, and nothing
marks it as one.** Several sit on files whose wording the owner has already ruled on twice.

⚠️ **Do not reason from the commit counts.** A squash-merged PR's commits are never ancestors of
`main`, so landed work reads as unmerged. Ward Verifier measured the real divergence at 612 files:
571 ward, 41 not — **and 19 of those 41 changed on both sides. That is the whole risk surface.**

---

## 7. Corrections that arrived at shutdown — carry these, not the older claims

- ❌ **"The sign-in outage is still open."** RETRACTED by Ward Verifier. `fbbb6c16cf` landed on
  `origin/main` today and fixes it. ⚠️ **Three chats verified that outage independently and every
  verification aged into a false claim without anyone touching it. A deferral has no owner and
  nothing re-checks it.** Re-derive any parked item older than a few hours before quoting it.
- ❌ **"The demonstration-data safeguard is untested."** RETRACTED by Ward Builder Four, who had
  ranked it the night's top gap on one unchecked relayed sentence. It is tested, and the guard is
  **structural** — a demonstration series cannot be forged from an object literal.
- ❌ **"Ward Flow is never pushed"** is true of the live line and **false about the programme's
  history**: `origin/claude/ward-flow-phase-4-spec`, `ward-flow-phase-5-p8rwcm` and
  `ward-flow-phases-6-7-design` are all on the remote. The three current branches are confirmed
  unpushed.
- ⚠️ **The ward end-to-end suite ran for the first time yesterday** — it lives in
  `chromium-mockups`, which neither `verify:ui` project selects, so it had been passing by not
  running. Final state: 78 tests, 72 passed, 5 skipped, 1 failure that was Playwright losing its
  browser under memory pressure, not an assertion. **That is one occurrence. Policy wants three on
  one SHA before quarantine — do not record it as a known flake, and do not record the suite as
  green.**

---

## 8. Working notes for the next chats

- **Cross-session messaging was disabled in this session.** I could not reach any of the five live
  chats to ask for progress or send a handover, which is why this is a document rather than a message.
  If yours can message, check that first — reading branches is more reliable, but slower.
- **Never two committers in one worktree.** The pre-commit hook reads the _other_ party's cleanly
  staged files as unstaged, so **neither** can commit until one tree is completely empty. This is not
  a queueing problem with a polite solution.
- **In a worktree, `.git` is a file.** Testing `.git/MERGE_HEAD` reports a merge is over when it is
  not. Use `$(git rev-parse --git-dir)/MERGE_HEAD`. I lost time to this mid-fold today.
- **Quote your heredocs.** A commit message containing backticks was executed by the shell and landed
  with its class names silently eaten. Amend if you see it; check if you don't.
- ⚠️ **A dev server was left running on ** by Ward Builder One, deliberately
  rather than killing a process during shutdown. Worth stopping — this machine is out of memory.
- **A duplicated fix is invisible to every gate.** Today's ED conflict was two chats correctly fixing
  one false comment, and the conflict is the _only_ reason both halves survived — one carried a
  warning the other lacked. Claim the **defect** in
  `docs/ward-flow/control/work-claims.md`, not just the file.
