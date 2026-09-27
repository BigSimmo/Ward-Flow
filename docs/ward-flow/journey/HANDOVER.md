# Ward Journey Explorer — handover

> **Historical handover.** The dated counts, coverage results, branch and next steps below record
> work as it stood on 24–25 September. They are not current verification. For the present Explorer,
> use the generated page and the current source review in `CURRENT-REVIEW.md`. Do not run a full
> coverage suite merely to update the old number; the fold steward owns the batch gate.

_Written 24 September 2026. Everything below was checked against the repository on that date, not
recalled. Where a number can go stale, the command that re-derives it is given beside it._

## What this is

A generated, explorable map of Ward Flow's entire patient journey — every route a patient can take,
every option at each step, every place the engine refuses. It is **generated from the engine**, not
drawn by hand, so it cannot quietly drift from what the code does.

- **Live page:** https://claude.ai/artifact/3aH6qnByiDjUMTG4U8aBRw (Version 23)
- **Source:** `docs/ward-flow/journey/` in `D:/Worktrees/Database/ward-lead`
- **Branch:** `codex/task-ward-flow-live-state-20260831` (the ward line; never pushed)
- **One command:** `npm run ward:journey` — refuses rather than emitting something wrong
- **Its proofs:** `npm run ward:journey:prove` — each check shown failing on a deliberately broken input

Current size: **111 boxes, 90 actions, 51 word lists, 10 stated findings.**

## The discipline this thing is built on, and why it matters

Every claim on the page has a check, and every check has a proof that it can fail. That is not
ceremony. **Three separate defects in this tooling produced confident, correct-looking output that
said nothing**, and each was caught only by going and looking:

- The page was built with no data in it and reported success, because a formatter moved a marker.
- The inventory printed every machine state as `[object Object]` — right length, every heading
  present. Three reviewers read that section before one said so.
- The filters dimmed boxes visually while leaving 91 of them keyboard-reachable and read aloud by a
  screen reader.

**So: a generated document must not be able to be wrong in a way that looks right.** If you add a
claim, add the check; if you add a check, prove it fails.

## What is done

1. **The map is current with the engine.** All 90 actions the engine has are on it, verified by
   comparing against `EVENT_ROLE` in `ward-flow-events.ts` (which the compiler forces to be
   exhaustive), not by counting.
2. **The build now checks its own completeness.** Until 22 September it compared `actions.json`
   against itself and the map against `actions.json`, and **never compared either to the engine** —
   so it printed "71 actions" with total confidence while the engine had grown to 90. That check
   exists now and refuses the build. ⚠️ **The direction is the point:** an action on the map the
   engine lacks is visible (clicking it goes nowhere); an action the engine has that the map lacks is
   invisible, because nobody can miss what was never drawn.
3. **Refusal coverage is measured, not estimated.** `refusal-coverage.mjs` reads a real coverage
   report, buckets every `return reject(` into the reducer case it sits in, and reports per action.
   It refuses a report measured against a different copy of the reducer (compared by hash), and a
   line the report cannot speak for comes back **unknown, never "untested"**.
4. **Tests for refusals nothing reached** — four files, all green:
   `tests/ward-acting-unit-guards.test.ts`, `ward-refusal-gaps-vocabulary.test.ts`,
   `ward-refusal-gaps-intake.test.ts`, `ward-refusal-gaps-transport.test.ts`.
   Every case carries a **control**: the same event with the one field made valid, asserting the
   named refusal is _absent_. Without that, a missing record or a wrong stage would make the file
   green while proving nothing.

## Update, 25 September 2026 — the four items below were worked

Branch `ward/journey-explorer-20260925`, off the ward line at `3e38413195`. Re-check anything here
with the commands given; the reducer moves daily.

1. **Full coverage figure is on the page:** 392 of 392 refusals spoken for, **38 never reached**,
   from a full ward-suite run with `reportOnFailure` (628 files ran; 135 tests were failing, which the
   audit session owns). The map first refused to build: the engine had gained six actions
   (repatriation log, handover sign-off, clinical contact, three broadcast-alert actions). They are
   mapped now: 96 actions.
2. **Tests for the 38:** four new files, `tests/ward-refusal-gaps-{new-actions,referrals,
legal-and-diversion,bed-holding}.test.ts`, 43 tests, each case with its control. A targeted
   coverage run of just those files reaches **27 of the 38**. The other eleven: nine judged
   unreachable (the five from the earlier round, `RECORD_DIVERSION`'s "already arrived" and
   "already stopped or cancelled" which are the same closed-movement shape, and two "no accepted
   unit" guards behind stage checks), plus two not written — PULL_PATIENT's "not a bed held at"
   (no route found) and its high-acuity second-pull refusal (needs a new high-acuity referral walked
   to a pull). The page still shows 38 until the next full run.
3. **Eleven, not twelve, actions have no screen.** `RECORD_NO_REFERRAL` was wired to the ED outbox
   in `87118c236a` and the map still said NONE. The build now refuses any NONE claim that something
   under `src/` dispatches (check 3f in `build-explorer.mjs`, proven by `prove-screen.mjs`).
4. **Proofs:** three consecutive `npm run ward:journey:prove` runs green, under load, no residual
   damage. `build.mjs` now labels a failure carrying the Windows lock signature as environmental.

## What was left on 24 September, in the order I would do it

### 1. Re-measure coverage so the page carries a full figure

The page currently shows a **partial** measurement: `spokenFor: 153 of 372`. That is not a
regression — `coverage/lcov.info` is untracked and shared, and another session's narrower test run
replaced the file mid-flight. My own full run measured **27 of 372 refusals never reached**, from
614 ward test files (6,799 passing, 59 failing).

```bash
node scripts/run-vitest.mjs run --coverage --coverage.reportOnFailure=true ward-
npm run ward:journey
```

🔴 **`--coverage.reportOnFailure=true` IS NOT OPTIONAL.** Vitest's default is `false`, and on any run
with a failing test it writes the coverage report **and then deletes the directory**. The ward suite
has failing tests, so plain `npm run test:coverage` prints "Coverage enabled with v8", runs for
twenty-plus minutes, and leaves nothing — while looking exactly like a successful run. Four runs
were lost to this across two sessions. Check the artefact exists and is newer than the run; never
infer it from the exit status.

Also expect to wait: a machine-wide lock serialises heavy test runs, so the command may need to
retry until another session's run finishes.

### 2. Write tests for the refusals still unreached

Re-derive the list from a fresh full measurement — **do not use the numbers in this document**, the
reducer has been growing by tens of refusals a day. `refusal-coverage.json` carries `byEvent`, which
names them per action.

From the earlier round, five turned out **unreachable by any event**, and that is a finding rather
than a gap. Do not write tests that fabricate the state:

- `COMPLETE_INBOX_ITEM`'s "already complete" — sits behind a check that the row is a _commitment_,
  and all five inbox categories are `kind: "fact"` (two settled that way by the owner on 6 September,
  "Neither — acknowledge only"). The word "commitment" appears only in a type, a comment and the
  guard.
- Four transport refusals — "already cancelled", "already stopped", and "the patient has already
  arrived" twice. Each sits below a closed-movement check, and both states they describe **are**
  closed movements: arrival writes a closure in the same object literal, every one of the six places
  that writes `transport.cancelledAt` writes a closure beside it, and nothing ever clears a closure.
  `ward-refusal-gaps-transport.test.ts` pins what actually happens and asserts the dead wording is
  absent, so the day somebody makes closures reversible, it goes red.

### 3. Decide what to do about twelve actions no screen can reach

Twelve of the 90 have `screen: NONE` on the map — they work in the engine and nothing in the app can
trigger them. They include recording a legal form's continuation, the country extension of a legal
clock, flagging and overriding a legal mismatch, both hand-set clocks, releasing-and-reopening a bed
search, and sending a ward message. **This is the owner's call, not an engineering one** — each is
either a screen still to be built or a feature to remove.

⚠️ Two of them (`RECORD_NO_REFERRAL`, `RECORD_PATIENT_DISCHARGE`) slip past the repository's own
reachability test, because a `case "RECORD_PATIENT_DISCHARGE":` line in `ward-audit.ts` satisfies its
double-quoted-mention scan. A file that merely _names_ an event is not a caller — the ten found on
22 September appeared only inside a `Set` literal in `ward-flow-persistence-classification.ts`.

### 4. Know this about the proofs before you run them

`npm run ward:journey:prove` **is intermittently red on this machine and it is not the checks'
fault.** Each probe breaks a real source file, runs the build, and puts it back; `fs.writeFileSync`
here intermittently throws `UNKNOWN (errno -4094)` — a sub-second lock from an indexer or scanner.

Run individually they pass. The repair (in `probe-io.mjs`) makes every probe write retry through the
lock, refuse to start if a file already carries a probe's marker, and restore from the **authored**
source rather than from a snapshot of the generated one. So a failed run no longer leaves damage —
verified by checking all four source files after every run.

🔴 **Before this was fixed it silently reverted a day's edits to `rebuild-map.mjs`, twice.** A revert
like that is indistinguishable from never having made the edit. If a proof run aborts, check
`git status` in `docs/ward-flow/journey/` before doing anything else.

## Traps specific to this tooling

- **A generated artefact is never its own restore point.** Restore from `rebuild-map.mjs`.
- **`machines.json`, `actions.json`, `explorer-template.html` and `rebuild-map.mjs` are AUTHORED.**
  Everything else in the folder is generated and will be overwritten.
- **Line numbers are different in every worktree.** The reducer differed by sixteen lines between two
  folders on 19 September, in the refusal area itself. A coverage report read against the wrong copy
  gives answers that are specific, per-action and about the wrong statements. The measure compares
  reducer hashes and refuses; do not work around it.
- **`what-changed.mjs` watches titles, colours, body text and findings.** It used to watch only the
  first two, so a run that added two findings reported "0 changes" and was telling the truth about
  the only things it looked at.

## House rules that apply here

- Ward Flow is **never pushed**. "Fold into main" means the local ward line, never `origin/main`
  (which auto-deploys and applies migrations to the live clinical database).
- Commit as you go. Other sessions commit in this same worktree, and twice they swept my uncommitted
  work into their own commits — which was harmless, but only because it was committed rather than
  lost.
- Never `git add -A`, never a bare `git stash`.
