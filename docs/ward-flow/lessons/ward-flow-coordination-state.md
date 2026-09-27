---
name: ward-flow-coordination-state
description: "Ward Flow (WA psychiatric bed flow) — mission, definition of done, where the master line lives. ⚠️ CONTAINS BRANCH SHAs AND AHEAD/BEHIND FIGURES THAT EXPIRE — every one is a floor, re-measure before acting"
metadata:
  node_type: memory
  type: project
  originSessionId: db884133-9f0b-4227-abb1-8e177a1270e4
  modified: 2026-08-29T12:21:52.903Z
---

🔴 **STALENESS NOTICE, ADDED 2026-09-09. EVERY BRANCH FIGURE BELOW HAS EXPIRED. THE MISSION AND THE
DEFINITION OF DONE HAVE NOT.**

This file's own description said the 2026-08-29 fold was the current state and the 22-orphan finding
was "the next open decision". Both were true when written and neither is now. **A state memory ages
differently from a lesson: the lesson stays true, the state silently stops being true, and nothing in
the file announces the difference.**

🔴 **SUPERSEDED AGAIN, 2026-09-12. The figures in the 2026-09-09 block below have expired too.**
**Master line tip `79fea225e5`, union suite 420 files handed in / 420 ran / 4,817 passed / 0 failed.**
**Fourteen third-edition screens were built this night by one agent each; three of the fourteen turned
out to be ALREADY BUILT and richer than their drawings (discharges, statewide statistics, ward
answer) and were deliberately not rebuilt.** ⚠️ **Re-measure before acting on any SHA here — this
notice will expire in exactly the way the one below it did.**

⚠️ **THE HABIT THAT WOULD HAVE PREVENTED MOST OF TONIGHT'S ERRORS, and it is cheap: STATE THE
POPULATION BESIDE EVERY COUNT.** _"Seven `sectionHeading` headings"_ exposes a mismatch as you type
it; _"seven sections"_ hides it from the author first. **Five unit errors in one night across four
chats, including one inside the sentence correcting a unit error.**

**What has changed since, measured 2026-09-09 and itself a floor:**

- The master line `codex/task-ward-flow-live-state-20260831` **has merged `origin/main`** and reads
  **0 behind / 2365 ahead**. Every "behind N" figure below predates that and is wrong.
- The line moved repeatedly in a single afternoon — three chats quoted three different tips within
  hours, in both directions. **A SHA in a message is a floor, never a reading.**
- `npm ci` is now REQUIRED before any gate here: the merge brought main's lockfile and an older
  install no longer matches.

> ⚠️ **Do not act on any ahead/behind count, SHA, or "next open decision" in this file without
> re-measuring it first.** Ask Ward Lead, or run the count yourself. The reasoning below is still
> good; the numbers are archaeology. See [[observations-expire]].

Ward Flow is a **working demonstration** of a statewide hub for psychiatric bed flow in Western
Australia, built by AI sessions for a psychiatrist in Perth. Synthetic data only, reachable at
`/mockups/ward-flow`. **Nothing is ever pushed and no PR is opened** — restated at every phase.

## THE FOUNDATION — stated twice by the owner, unprompted

> **The core principle is patient flow from the emergency department to the wards. Everything is
> built on it.**

**The test for any task:** does it help a person get from an ED to a ward, or help someone see why
that is not happening? If no, it is decoration and goes last or not at all. Discharge is in scope
because it makes the forward flow **repeatable** — it is a consequence of the foundation, not the
foundation. A demonstration where the bed never comes back shows one patient moving once.

## Goal, and what "done" means

**Three months: a completed functional demonstration on mock data, shown to the WA health service —
he has a real route in.** Not production. Eight checkable statements define done (plan §1); the list
does not grow without an owner decision.

## THE FOLD COMPLETED 2026-08-29 — the two branches are one line again

```
899917421  the merge (parents: Phase 8, and the ward board branch f341d5db7)
904363e1b  seven repairs the fold surfaced
ecf397e64  seam guard + fold procedure brought onto the main line
```

Confirmation run **at the SHA**, suite discovered from disk: **Tests 1043 passed (1043)**. All three
add/add files were taken from the board branch wholesale and blob-verified; the owner's stay bands
survived; the discharge fields survived. Verified independently by more than one session, including
a check for the **absence** of the superseded values, not only the presence of the current ones.

**The cost of running two branches, when everything went right.** Both were small, disjoint by
intent, coordinated hourly — and it still produced a conflict whose wrong resolution was GREEN, a
fourth conflict nobody predicted, and seven failures no single branch could see. That is the price
with the process working. **Whether to run parallel branches again is the owner's call**, and he
should be told that number rather than a success story.

## THE LARGEST OPEN DEFECT — 22 orphans, measured

**22 of 23 wards have an orphaned ward screen, and an orphaned board underneath it.** Measured
across all of `src/`: exactly two places build a `/ward/<id>` href — `ward-nav.ts` (one seeded
example) and `ward-role-switcher.tsx` (over `wardCandidates`, which is 0–3 wards derived from the
focused patient and **empty with no patient selected**). Nothing maps over all units.

The board link now sits on each ward's own screen ("See every bed on this ward"), which fixes the
**relationship** and not the **reachability** — a board link is exactly as reachable as the screen
it sits on. The real fix is a place listing every ward, or making the network map's ward cards
navigate. **That is a screen decision and belongs to the owner.**

**The guard lesson this produced, now built in:** "the route has a link builder" is satisfied
permanently by one seeded example, so it is _weaker_ than the hand-maintained count it replaced. The
guard now asserts a link site **iterates the route's own collection**, and its allowlist entry must
state **coverage as a figure** ("1 of 23 reachable…"), because a reason can be vague and still pass
where a number cannot.

## Standing rules specific to this project

- **Decision identity is owned by ONE session** (the ledger). Cite namespaced — `WB-DB-14`,
  `P6-D3` — never a bare `D3`. See [[assert-only-about-code-you-opened]].
- **Network facts live in the seed files only.** Screens read them, never state them. Changeable
  data has its own rule: [[ward-flow-changeable-data-rule]].
- **Date every verbatim list.** An undated "the owner's exact words" eventually instructs a reader
  to undo the decision it was written to preserve — this happened, armoured by a "must not be
  re-litigated" heading.
- **No file reading the admission seed may dispatch a Ward Flow event.** If the board gains the
  DB-2 discharge-confirmation handler, that assertion fires and the answer is to reconsider the
  design, not to widen the allowlist.
- **Addresses ≠ sidebar titles.** `SendMessage` needs the slug from `ListAgents`; a failed send is
  the only signal a peer moved.

## The largest standing risk

**The bed model has never been read by a ward clinician** and is deliberately deferred (asked
twice). `predicted → confirmed → released` is the owner's model of a ward, not a ward's model of
itself. Ask them to describe it BEFORE showing the model, or you get agreement instead of
information. Trigger: before anyone in the health service sees it.

Related: [[ward-flow-verification-lessons]], [[checks-that-cannot-fail]],
[[ward-flow-changeable-data-rule]], [[parallel-chats-and-cross-chat-sync]],
[[check-the-conclusion-that-flatters-the-theme]].

## The live board branch is `claude/ward-flow-print-fixes`, not `claude/ward-flow-ward-board`

**Corrected 2026-08-29 after four sessions spent a day on the wrong name.**
`claude/ward-flow-ward-board` is ahead 0, behind 40 — dead, absorbed by the fold. The board work
lives on `claude/ward-flow-print-fixes`, named after a task that grew into the board work and never
got renamed.

**Convergence is done:** `63214cc6d`, two parents, 2026-08-29T21:58:36+08:00. `print-fixes` is ahead
6, behind 0 of the merged line, and `merge-base == merged-line tip`, so what remains is a
**fast-forward** with no conflict possible.

**Ask the worktree, never the name:** `git -C <worktree> rev-parse --abbrev-ref HEAD`.

## State at 2026-08-30 — the merged line is `b386ab9f3`, and TWO decisions sit with the owner

Cleanest baseline anyone has measured, **pinned to its SHA because an unpinned total is the instrument
that later mis-calibrates a vanished-test check**: at `b386ab9f3`, full suite discovered from disk,
**917 test files passed | 3 skipped (920), 11351 tests passed | 75 skipped (11426), 0 failed.**

Both of these are the owner's and neither should be started on a relay:

1. **The fold** — the board line (`claude/ward-flow-print-fixes`) is ahead 4 / behind 0 of the merged
   line, so it is a **fast-forward with no conflict possible**. It stops being free the moment either
   side commits.
2. **The clock work** — 53 test files and 10 source files read `NOW_ANCHOR` / `WARD_ADMISSIONS_ANCHOR`
   (counted, not relayed). **Order matters and it is a safety argument, not a tidiness one:** a clock
   change on the merged line converts the free fast-forward into a real three-way merge on exactly the
   files the clock rewrites — a whitespace conflict with clinical numbers in it, where every
   resolution looks green and none is checkable by reading. **Fold first, then the clock.**

**An authorisation is not transferable between sessions, and the standard has to hold in both
directions.** It was applied once when the relay favoured refusing and once when it favoured
building — and the second is the harder one, because the relay is offering you permission you want.
"He said start, and delegated only the naming" separates two different objects: the naming was
delegated, the authorisation was not.

**Value-pinned tests become relative offsets under the clock change — never re-baselined to whatever
the new code prints**, which would turn an assertion into a screenshot of a bug. Written-down
prediction for that run: the single-source allowlist fails FIRST. If it fails second, something else
moved and that is data — a prediction written afterwards is a story, written before it is an
instrument.

Related: [[checks-that-cannot-fail]], [[measure-the-thing-not-a-proxy]],
[[parallel-chats-and-cross-chat-sync]].

## 2026-08-30 — the clock run, Task 17, and where the work sits

Merged line `claude/ward-flow-phases-6-7-design`, worktree `D:/Worktrees/Database/pr-2390-fix`. Landed:

```
b1198cf6e  the clock carries a date; the midnight workaround stops being needed
68e5e18ee  two patients who have waited longer than a day
20a3e29e3  history says which day; the places still allowed to assume today are named
900538328  the discharge horizon rolls a full day and says "tomorrow" (WB-DB-7, WB-DB-10)
235ce466f  a patient who reaches a ward now exists there (Task 17)
```

**The defect that kept reappearing, in five places, is one defect:** an absolute instant read as if it
carried no day. `formatInstant` wrapping; `wallClockNow` discarding the date; `splitDuration` printing
`5041h 30m`; release bands comparing `expectedAt` against `MIDDAY_MINUTES`; `elapsedMinutesSinceMount`
guessing at midnight. **Fix the type's meaning and they all follow; patch them one at a time and the
category error survives in the next place.**

**Task 17's shape, and the sentence that settled a three-session argument:** an `Admission` is
CORRECTLY born at arrival — an admission IS the arrival. A `Patient` is a different record that must
exist before any referral, because the owner's flow is "search, and if nobody comes up, ADD them".
Folding them produces a patient that can only come into existence by arriving: it passes every screen
showing admitted people and fails at the one moment the demonstration exists for.

**A null that says why is a different thing from a null.** Task 17 ships `referralId: null` (came from
a movement, which carries no referral) and `homeRegion: null` (the fact does not exist on a movement,
and deriving it from the origin ED would be inventing it — where somebody was admitted from is not
where they live). Consumers render "home region not recorded"; the out-of-area figures SKIP those
people rather than counting them wrongly.

**Next, in order:** remove the frozen morning view (DB-11) and make the printed sheet stamp the real
moment it was printed; pause the guided tour (paused, NOT deleted — with a test asserting it dispatches
nothing, or "paused" is a comment); then the `Patient` entity with its own guard in the same commit.

**Owner rulings this day:** tentative diagnosis permitted on `Admission` (2026-08-29); identity —
name, UMRN, DOB, age — permitted on `Patient` ONLY, never on `Admission` or `Referral`, address and
narrative history NOT ruled on; a "tomorrow" band on the discharge board; everything else deferred with
"build what's there, make change easy later".

Related: [[ward-flow-changeable-data-rule]], [[checks-that-cannot-fail]], [[measure-the-thing-not-a-proxy]].

## Owner rulings, 2026-08-31 — five at once, one of them not closed

Recorded in-repo at `docs/ward-flow-owner-rulings-2026-08-31.md` (commit `0c94814a6`). He answered
five questions with **"Yes to all your recommendations."**

- ⚠️ **The ten urgency reasons are STILL OPEN.** He approved a _process_ — read the placeholders,
  keep what he would actually say, replace the rest — not the words. **Approving how a choice will
  be made is not making it**, and the placeholder warning block stays until he supplies the list.
  This is the only ruling that blocks work.
- **A bed held for a named patient must not count as available** (Ward Core). Availability ignores
  movement-side holds entirely today, which is why "Held" reads as two different quantities on the
  ward screen.
- **A patient declined by every approached ward is FLAGGED to the coordinator, never
  auto-escalated.** The mechanism already existed and is deliberately human; only the prompt was
  missing. Declaring the network exhausted stays a human act — same principle as never marking a
  patient urgent automatically.
- **Ward Flow is NOT pushed publicly as it stands.** Eight synthetic patients carry name, UMRN and
  date of birth; they are invented and **do not look invented**. Names in five files, UMRNs in two,
  both in three past commits — so blanking one file is insufficient, because publishing a repository
  publishes its history. Private repo if the goal is backup; if genuinely public, scrub everywhere
  then publish a fresh repo with one initial commit.

Related: [[ward-flow-changeable-data-rule]], [[one-recommendation-one-decision]],
[[observations-expire]].

## 2026-09-02 — the master line MOVED FOLDERS, and where everything now lives

⚠️ **The Ward Flow master line is `codex/task-ward-flow-live-state-20260831`, and it is checked out at
`D:/Worktrees/Database/ward-lead` — renamed from `ward-seed-link` on 2026-09-02 with the owner's
approval.** Both older locations are wrong: the C: worktree
`.codex/worktrees/ward-flow-live-state-20260831/Database` now holds **no branch at all**, and
`claude/ward-flow-phases-6-7-design` is long superseded. **Ask the worktree, never the name:**
`git -C <worktree> rev-parse --abbrev-ref HEAD`.

**After a twelve-hour session the line is green** — typecheck 0, the 151-file ward suite at 2196
passed, and the three long-standing repository failures fixed. All four chats' branches are folded.

**Where the durable record is:** `docs/ward-flow/outstanding/` (61 outstanding items),
`docs/ward-flow/reports/` (every chat's own account and self-corrections),
`docs/ward-flow/the-engine-enforces-nothing.md`, and nine queued requests in
`docs/outstanding-issues-inbox/`. The full session transcript plus a guide to what is in it and
nowhere else: `C:/Users/joshs/Backups/claude-work/ward-lead-transcript-2026-09-02/`.

### The clinical finding that outranks the rest, and it is an OWNER DECISION

**Ward placement is enforced by screens, not by the engine.** `REFER_TO_UNITS`,
`ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` perform no eligibility check at all; the reducer's single
check sits on the front-door referral model, whose own comment says acceptance creates no Movement.
Driving the real reducer placed a detained, secure, involuntary adult male into the forensic bed with
**zero rejections at every step, first attempt.** ⚠️ **Verified by one session only and never
independently checked** — Ward Verifier offered and did not deliver. Do not treat it as settled.

### Two coordination facts that cost more than any defect

- ⚠️ **One session could not receive a single message, in either direction, for its entire life**,
  while four others messaged each other normally. **Its own diagnosis — that it was the only chat not
  under `D:/Worktrees/Database/` — was DISPROVED** when a message finally arrived while it was still
  on C:. Cause unknown. **The repository worked every time messaging did not; prefer committed files
  to messages for anything that matters.**
- ⚠️ **A correct merge verdict arrived after the merge it was for**, because of the above. The
  verdict was right — the fold broke two tests — and useless.

### The archive trap, worth more than it looks

**A transcript archived mid-session was 1.26 MB stale eighty minutes later, and stopped before the one
document that existed nowhere else was even pasted.** An archive is current only at the instant it is
taken. ⚠️ **And a transcript cannot be searched with a negative control** — the log already contains
the command carrying your search phrase, so the control returns a hit no matter what.

Related: [[observations-expire]], [[self-invalidating-pins]], [[a-correct-diagnosis-that-stops-the-inquiry]].

## 2026-09-05 — THE THREE-MERGE PROGRAMME IS COMPLETE AND FOLDED. Start here.

**Master line: `codex/task-ward-flow-live-state-20260831`, in `D:/Worktrees/Database/ward-lead`.**
Ward Lead folds; builders never merge or push. **Ward Flow is never pushed — one disk only.**

**Design lock (binding, read before touching these screens):**
`docs/superpowers/specs/2026-09-05-ward-flow-merges-1-3-design-lock.md`

**What landed — 23 destinations to 19, measured:**

| merge | folded                          | into                                                             |
| ----- | ------------------------------- | ---------------------------------------------------------------- |
| 01    | queue + exceptions + escalation | **`/delays`** — why is this person still waiting                 |
| 02    | capacity + morning              | **`/capacity`** — where the network falls short                  |
| 03    | movements + transport           | **`/movements`** — where each move got to, and what carries them |

Old routes are 307 redirects, recorded in `WARD_NAV_INTENTIONALLY_UNLISTED`. `transport/officer`
deliberately survives — a phone screen for a different person.

**⚠️ OPEN, all with reasoning written down rather than assumed:**

- **Sex-mix integrity signal** — Ward Lead carrying, owner wording pending. The correct mechanism is
  `RELEASE_BED` raising `allocatable` and `empty` together, so a mix/occupancy disagreement means
  `ready` has just moved. (My first mechanism was false; the conclusion held anyway.)
- **Two types named `TransportLeg`**, four-state and five-state. Ruling: collapse to five.
- **Six unreachable `WardModeWorkspace` branches** and the Delays nav entry still carrying
  `id: "queue"` while reading "Delays". Ward Lead under E9.
- **`/not tracked/i`** wording pin in `ward-capacity-screen.dom.test.tsx` — mine, diagnosed.
- 🔴 **Eight files unreached by the brittleness audit, 65 pinned sentences, and ALL 20 NEGATIVE PINS
  among them.** Negatives fail silently. `docs/ward-flow/archive/dated-notes/redesign-brittleness-audit-2026-09-05.md`.

**⚠️ NO PLAYWRIGHT COVERAGE EXISTS FOR ANY OF THE THREE SCREENS**, and `test:e2e:ward`'s specs are
excluded from the routine loop by `--grep-invert "@mockup"`. Three sessions hit that independently.

**Owner standing rules, in his words:** _"ensure that all testing works with the redesigns rather
than fighting them since i am going to redesign many pages"_, and remove testing that is _"slow and
bulky"_ during rapid change. **Ruling: KEEP the browser specs, do not run them routinely.**
See [[tests-must-not-pin-page-designs]] and [[a-guard-that-blocks-its-own-purpose]].
