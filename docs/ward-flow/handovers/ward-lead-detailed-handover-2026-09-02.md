# Ward Lead — detailed handover, 2026-09-02

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow.

**Written by the outgoing Ward Lead (`database-53`) for whoever holds the role next.** Every item
from the 61-item list, expanded: what it is, where the evidence sits, what would settle it, and who
it belongs to. Plus the two found after that list was written.

⚠️ **SIX ITEMS ARE ALREADY CLOSED** by the incoming Ward Lead between 12:08 and 12:25. They are
marked ✅ and left in place rather than deleted, so nobody re-opens them wondering whether they were
missed. **Do not re-do them.**

## How to use this

- **Nothing here is urgent.** The master line is green: typecheck 0 errors, the 151-file ward suite at
  2196 passed. Everything is committed and folded.
- **Verify before acting on any of it.** Every claim below was true at a stated commit and the line
  has moved since. **Where a claim has no commit named, treat it as a lead, not a fact.**
- **The single most useful question to put to the owner is A2.** It closes five of the twenty-seven.

---

# A. DECISIONS ONLY THE OWNER CAN MAKE — 27

## A1 ⚠️ Should the engine refuse a placement nobody explicitly overrode?

**What it is.** `REFER_TO_UNITS` (reducer ~712–765), `ACCEPT_IN_PRINCIPLE` (~766–840) and
`PULL_PATIENT` (~885–) perform **no eligibility check of any kind** — not cohort, security, sex or
forensic. The reducer's only `referralEligibility` call sits inside `ACCEPT_REFERRAL`, on the
front-door Referral model, whose own comment says acceptance _"creates NO Movement"_. **So the one
check that exists is not on the road a patient travels.**

**Evidence.** `docs/ward-flow/the-engine-enforces-nothing.md`. Proven by driving the real reducer over
real seeded data: `WF-009` — Adult, Male, Secure, involuntary, detained on a 3B form, needing
one-to-one care — through `REFER_TO_UNITS` → `ACCEPT_IN_PRINCIPLE` → `PULL_PATIENT` into
`brm-adult-secure`, the network's forensic bed. **Zero rejections at every step, first attempt.**

**Why it is a decision and not a bug.** The Override control is deliberate and carries a required
reason from a fixed list. A clinician overruling a rule with a recorded reason is a legitimate design.

**Recommended shape.** Refuse a placement that fails the gates **unless an override reason is recorded
on that event.** Keeps the escape hatch, makes every bypass carry its reason into the record, and
means a future screen cannot reopen the gap by forgetting to check.

⚠️ **This is verified by ONE session and has never been independently checked** — see C10. The same
session got a related clinical claim wrong the same night, in the reassuring direction.

## A2 ⚠️ Should the app have any notion of who is looking? — ASK THIS ONE FIRST

**There is no role gating anywhere in Ward Flow.** Every screen shows everything to everyone. FD-23 —
a ward may not see where else a patient has been referred — is currently enforced by the fact that no
screen calls the projection that computes it, which is a much weaker guarantee than the tests suggest.

**Answering this settles A3, A4, A5 and A6 at once**, because all four are the same question asked of
four different surfaces.

## A3 Should the sidebar stop naming other wards a patient was referred to?

`ward-role-switcher.tsx` reads `focusMovement.referredUnitIds` in full and renders each co-referred
ward as a named link. **It is mounted on every ward screen.** Recorded as FD-23 bypass 1 in
`docs/ward-flow/fd23-bypasses-2026-09-01.md`.

## A4 Should the patient workspace stop showing the count and the accepting ward?

`ward-management-console.tsx:313` renders `destination ? destination.name : "${n} referred"`. So a
ward sees either **how many other wards were tried**, or **which one accepted.** FD-23 bypass 2.

## A5 ⚠️ Should a coordinator see a patient's suburb?

**Raised independently by three chats, which is unusual and worth weight.** `coordinatorScopedReferral`
documents itself _"never filtered — the coordinator may see everything"_ and is implemented as a
hand-written eleven-field list that **omits `suburb`**.

⚠️ **The field is in NEITHER projection's type, so no gate can catch it either way.** The sibling
issue is held by `tsc`; this one is held by nothing. Whichever way you rule, the ruling needs a
mechanism or it will drift.

## A6 ⚠️ Cross-page inference across the 65 community team pages

65 team pages, each listing who was referred to that team, all reachable from one index. **Anyone who
opens two learns a person was referred to both — without the software ever displaying it.**

FD-23 governs a _ward-scoped_ viewer. **A community team page is a viewer scope nobody has defined.**

⚠️ **Not answerable by any search over source** — it is a question about the product's shape. **Moot
today only because every seeded referral is single-destination** (hand-counted), and the fixture
changed three times in one day.

## A7 Should a shortlist show beds a ward SAYS it can staff, or beds physically empty?

`eligibility()`'s `sex_mix` and `allocatable_bed` gates read `unit.allocatable.value` **alone**.
`referralEligibility()` reads `Math.min(allocatable, empty)` and carries a comment calling that a bug
fix _"applied here where it was left behind"_.

⚠️ **But there is a deliberate precedent the other way.** `ward-flow-reducer.ts:903`, inside
`PULL_PATIENT`, reads `allocatable` alone **on purpose**, citing an owner ruling of 2026-09-01: it is
_"the ward's own claim about what it can staff"_.

**Measured impact today: exactly zero.** Only one of 23 seeded units ever has `allocatable > empty`,
and every open movement already fails a different gate there. **Nothing is lost by waiting.**

**What would settle it:** a dated statement about the SHORTLIST gates specifically. The reducer
already has one for the pull-refusal gate; nobody has written the equivalent for these.

## A8 ⚠️ Should the ED referral form stop pre-selecting "no one-to-one nursing"?

Five clinical fields on that form were converted to "not chosen" at `26228864a` because the form was
pre-recording _Female_ and _Voluntary_ for every patient. **`specialling` was deliberately left**,
with a comment arguing an unticked checkbox is a genuine answer.

⚠️ **Ruling 1 has since landed and the reducer now enforces one-to-one capacity. So that default now
feeds a GATE rather than a display** — an untouched box silently asserts the patient consumes no
staffing.

## A9 ⚠️ Four controls pre-select the data-provenance reason

`ed-screen.tsx:630`, `:848`, `shortlist-panel.tsx:257`, `:285`. The list's two members are
`recorded_by_treating_team` and `correcting_an_error`.

**A clinician correcting a mistyped legal status who never touches the control records the correction
as a fresh report from the treating team.** An audit-trail defect, not a liberty one — that
distinction was itself a correction, after one chat described it as software choosing a reason for a
liberty decision by reading the variable's name rather than its members.

## A10 Can an emergency department ever ACCEPT a referral?

Nothing in the app produces that state — the only acceptance path is hard-coded to a psychiatric
ward. So one branch of the new state labelling has **no reachable input and no test.** Not a defect
now; becomes one the day an ED-accepting path is added.

## A11 Two ED browser journeys have never once passed

Both failed their first ever run — one used a test id missing its `inbox-` segment, one clicked an
`aria-disabled` button, which Playwright refuses, so it timed out at 45s rather than failing. **Fixed
at `ed701752d`, folded, and never re-run.** Worth a Playwright window, or drop them?

## A12 Is "Ward nurse in charge" the same role as "Ward manager"?

A fourth spelling, at `ward-movements.ts:232` and `:513`, outside what ruling 5 covered. It sits in
the same `owner` progression as the two real spellings and is rendered on the board, exception drawer
and network views. **But `tests/ward-patient-search.test.ts:91-95` pins it as the unique
case-insensitive search match for `WF-015`** — so renaming means rewriting a search test, not a word.

## A13 "Expected discharge was 1 week ago"

Past tense in place of a word an existing test bans page-wide. **Implementer's choice, not a ruling.**

## A14 ⚠️ Should the referral board say what an ED referral was FOR?

`referralDestinationLabel` (`ward-referrals.ts:110`) **receives the whole destination including
`purpose` and returns the kind alone.** So the board reads _"Also refused — Emergency department: No
suitable bed"_ where no bed was requested. `referralPurposeLabel`'s own doc calls this a safety rule
admitting no exception; **only `ed-screen.tsx` honours it.** Structural, not an oversight.

## A15 The "recently answered" list is uncapped

Sorted by decision time and now shows that time, but grows without limit, so "recently" decays with
use. **How many rows, or how far back?**

## A16 ⚠️ The seed cannot exercise ruling 6 at all

All ten seeded referrals (`RF-001`…`RF-010`) carry exactly one destination — counted by hand. So
"queued, with one service already refused" **cannot occur on the running app.** The feature is proved
through the DOM harness and the real reducer, but **nobody will see it on screen.**

The constructor for the two-armed shape already exists at
`tests/ward-community-referral-survives.test.ts:40` and is test-local. **Add one to the seed?** That
is a fixture decision.

## A17 `--clinical-border-subtle` has no analog anywhere

Nine of the ten undeclared token references have a real already-declared token they should point at.
**This one has none. Its value is an owner decision and nobody invented one.**

## A18 ⚠️ The DOM sweep lost 53 of its 61 findings

The document details 8 and summarises "the remaining 53" thematically. **They exist nowhere** — not in
the document, not in reader reports, which died with their sessions. Surfaced when another chat asked
whether a specific defect was among them and the author could not answer.

**One chat recommends retire-and-re-run rather than attempting recovery.** A count that cannot be
checked, triaged or compared is the only thing that document was for.

## A19 Are the 131 findings worth triaging at all?

See C3. They are systematically biased toward mis-attribution.

## A20 How should "already fixed before it was raised" be counted?

One finding was fixed the day before it was reported; the analysis reproduced and the defect was real.
Two chats agree that is **not** a false positive. **The hit rate depends on the answer**, and every
rate quoted this session has since been withdrawn.

## A21 Does the claims register cover every figure?

Figure 3 shipped **without** an entry, judged already covered by its derivation and DOM tests. Its
sibling figures **do** have entries. Either a parity follow-up, or a decision that the register is not
a per-figure mechanism.

## A22 ⚠️ Who owns `tests/ward-screen-fd23-leaks.dom.test.tsx`? — ASKED EIGHT TIMES

It sits in nobody's declared file set, **so nobody may safely edit it.** It has the same
`allUnits()`-only blind spot at line 214 that was closed elsewhere at `64b4c1388`.

**Ruled out of scope by Ward Builder Two, with evidence:** it imports `WardScreen` from
`ward/ward-screen.tsx`, outside `coordinator/**` and `ed/**`, and its only mention of that chat's
modules is a comment at line 41 citing a ruling — **a citation, not a dependency.** **By elimination
it is Ward Lead's.** One file; the shape is already worked out at `64b4c1388`.

## A23 Was the double-mount ever seen on a real page?

A root `loading.tsx` became a Suspense boundary around every segment below it, putting a second copy
of every screen in the DOM. Moved to `(search-app)/loading.tsx` at `c08fa31d6`.

⚠️ **If it was only ever observed under `mockups/`, that commit was a relocation rather than a fix**,
and five production routes silently lost their loading skeleton for nothing. Raised by Ward Verifier.

## A24 May a Ward Flow branch change `src/app/**` at all?

Raised by Ward Verifier after the `loading.tsx` move touched the shared route tree. **Nobody has
ruled.**

## A25 May five production routes lose the inherited loading skeleton?

The consequence of A23. ⚠️ **Never re-checked since first raised** — treat as unverified.

## A26 ✅ CLOSED — the leftover files

`tests/scratch_debug_elig.test.ts` and the three scratch probes. Resolved by the incoming Ward Lead.

## A27 May the scratch branches be swept?

At least nine: `trial-merge-0339`, `-1120`, `-1122`, `-1130`, `trial-b1-1140`, `trial-b2b3-1135`,
`check-master-1110`, `verify-1120`, plus `claude/ward-lead-*`. ⚠️ **None is checked out anywhere** —
verified with `git worktree list`, correcting a handover that claimed otherwise. **The protection hook
refuses branch deletion; the override works but needs the owner's approval per deletion.**

---

# B. DEFECTS — 8, of which 4 are now fixed

## B1 ✅ FIXED at `1bbe02d75` — undeclared CSS custom properties

## B2 ✅ FIXED at `365ba8462` — documents naming live branches without saying so

## B3 ✅ FIXED at `0b6942f55` — unbounded recursive delete

## B4 ✅ FIXED at `ed904f8d2` — the double cast

## B5 ⚠️ OPEN — a property with no backstop anywhere

**The thing `tests/ward-referral-matching.test.ts` exists to protect** — that referral matching never
reads the unvalidated bed-release model — **has no other guard in the entire suite.** The edit that
disables it is **an ordinary re-export refactor, not a contrived one**, and the file's own scanner is
regex-based and cannot see through a re-export.

**Raised as finding 7.4 by Ward Builder Two, which flagged it as the one worth Ward Lead's attention.
Nobody has acted on it.**

## B6 ⚠️ OPEN — `ward-scenarios.test.ts` drift, live and widening

```
line  27  prose      "41 open movements, 342 eligible movement/unit pairs"
line 115  assertion  { openMovements: 43, eligiblePairs: 325, strandedMovements: 2 }
line 132  message    "openMovements must match the standard night's 41 exactly"
```

**The pinned figure has been corrected three times — 353 → 340 → 325 — and the header prose and the
failure message were left at 41 and 342 through all three.** The file's own comment instructs a reader
to _"re-measure rather than adjust a number"_, and **the number that never got re-measured is the one
inside that instruction.**

## B7 ✅ RESOLVED — the true-equals-true test

## B8 ⚠️ OPEN — the unowned leak test. Same as A22.

---

# C. BELIEVED BUT NOT VERIFIED — 13. **Read this section first.**

## C1 126 findings, no mutation run on any

Read-only prep complete for 32 files across two slices; six candidate guards named by **static search
only**. **Leads, not verdicts.**

## C2 24 triage findings, none mutation-observed

All reached by reading, at a commit now behind. Rescued to `docs/ward-flow/triage/`. **Each batch
carries a banner saying so — and batch B's own title claims "mutation-verified at HEAD", which is
false and was left as written, because a document that silently corrects itself hides that the claim
was made.**

## C3 ⚠️ The structural-bias claim — most consequential, least tested

Every candidate guard found so far — **six of six** — sits in a `.dom.test.tsx` or a `ui-*.spec.ts`,
**and the `.ts` sweep read neither family.** The inference: its 131 findings skew toward tests that
misdescribe their own job rather than genuine gaps.

**Its own author calls it "the most consequential thing I believe and the least tested." It rests on
six instances plus two of its own retractions.**

## C4 ⚠️ 53 findings that cannot be re-checked by anyone

See A18. **This is not a gap in confidence — the information is gone.**

## C5 ⚠️ A sweep of 14 files whose method cannot be established

Its transcript was **0 bytes**, so read-versus-pattern-matched cannot be determined, **and the wrong
method produces an identical report.** Recorded as undetermined with an instruction not to use it as a
baseline. ⚠️ **Do not treat those 14 files as clean.**

## C6 ⚠️ Two leads from an audit whose parent died

`BedRelease.waitingOn` never read back; `dischargeConfirmedAt` has no runtime writer. From a run whose
parent process died before reconciling its children's findings. ⚠️ **Two other findings from that same
run were false and were withdrawn.** **Leads, not findings.**

## C7 One mutation still inconclusive

Emptying an exception map broke the file's parse and the runner reported _"no tests"_ — the
**fork-failure shape, not a negative**. **That assertion has never been proved and is not claimed.**

## C8 Two ED browser journeys fixed and never re-run — see A11

## C9 ⚠️ Three of four mutation proofs overstate

One commit's claim that _"every pin fired"_ is false — roughly **46 of 63** claim-specific assertions
were never exercised, **and that is a FLOOR**, because iterations before an abort passed only where the
mutation never touched them. **Anything resting on that commit's proof is weaker than it reads.**

## C10 ⚠️ The engine-enforcement finding has never been independently verified

**The largest claim in the project, checked by one session only.** Ward Verifier offered — said it
outranks everything it raised itself, and asked to be pointed at it — and never delivered.

**Ask for a judgement, not a fix: overstated, understated, or right, and the one piece of evidence
that would overturn it.**

## C11 A pre-selected-default sweep pattern-matched 106 of 115 controls

**A pattern scan is not a sweep.** Those 106 are unswept. Nine were read in full.

## C12 Eight rulings that lived only in a git-ignored ledger

Substance rescued into a report; the ledger itself was not. **`.superpowers/` is gitignored — anything
left there dies with the session.**

## C13 ✅ RESOLVED, in the negative

The theory that one chat's message isolation was caused by its drive location. **Disproved** — a
message arrived while it was still on C:. **The cause remains unexplained and should stay recorded as
unexplained.**

---

# D. ENVIRONMENT — 6. All observed, all costly.

## D1 ⚠️ The shell loses its own commands

`ls`, `grep`, `head`, `sleep`, `wc`, `python`, `cmd` and even `command -v` each vanished at some point
in one session. ⚠️ **A missing command reports "command not found" and exits non-zero — which looks
exactly like a failing check.** If something behaves impossibly, test whether the tool still exists
before believing the result.

## D2 ⚠️ Git could not spawn its own pre-commit hook

`cannot spawn .githooks/pre-commit: No such file or directory`, while the file is present in the index
at `100755`. The interpreter, not the hook, was missing. **Several commits say `--no-verify` and say
why: those gates are UNRUN, not passed.**

## D3 The protection hook has three known false positives

It refuses scratch-file deletion; it refused deleting a symlink that is not a worktree; and **it
refused a command that merely WROTE a warning quoting a deletion command as text.** ⚠️ **The override
DOES work as a command prefix** — correcting a handover that said otherwise — **but it needs the
owner's approval, one deletion at a time.**

## D4 ⚠️ A restore was content-identical, hash-different, and `git diff` called it clean

A Python text-mode write had converted 2,721 line endings to CRLF. **Verify a restore by HASH, never
by diff, and check `git ls-files --eol` after any scripted write.**

## D5 Ten or more sessions run concurrently

Matches a known pattern of machine starvation on this hardware.

## D6 ⚠️ `--reporter=basic` does not exist in this vitest

It dies at startup with `Failed to load custom Reporter from basic`, **runs nothing, and reports no
failures.** ⚠️ **Two chats hit this independently on the same night**, and one states plainly it would
have reported three failures as fixed had it trusted the exit code. **Name the reporter you use, or
use none.**

---

# E. COORDINATION — 4

## E1 ⚠️ One session could receive nothing, in either direction, for its entire life

While four others messaged each other normally. Two independent inbound channels were silent — peer
messages and an idle subscription tested deliberately. **Cause never established; the location theory
was disproved.** **The repository worked every time messaging did not.**

## E2 ✅ RESOLVED — Ward Lead is running again

## E3 ✅ RESOLVED — Ward Verifier's report rescued into git at `e0cb8f0fe`

## E4 A handover with two errors, deliberately not amended

Its author left them with corrections beside them, **on the stated grounds that amending a delivered
document to hide an error is worse.** Both are corrected in later reports.

---

# F. THE OUTGOING WARD LEAD'S OWN ERRORS — 19, four that matter

Full list: `C:/Users/joshs/Backups/claude-work/ward-lead-transcript-2026-09-02/ward-lead-12-hour-review.md`

## F1 ⚠️ A false clinical reassurance

I told the owner no patient could be placed in a forensic bed. **They could.** And **both** of my own
attempts to verify it at HEAD failed silently — one used an `awk` range that matched a single line,
one used a line number four merges stale. **Both failed towards the comfortable answer**, and both
were caught by a control, never by the answer looking wrong.

## F2 Every factual error ran in the same direction

The forensic reassurance; retracting a true finding with a weaker check; diagnosing a messaging fault
as general when it was mine alone. **A broken search returns nothing, and nothing is what "no problem
here" looks like.**

## F3 ⚠️ I merged into a worktree somebody else was using — TWICE

The second was the incoming Ward Lead's. **Nothing was lost either time, only because the edits
happened not to overlap.** I had written that rule to four chats in writing the same evening.

## F4 A correct verdict that arrived too late

My merge analysis found that folding one branch would break two tests. **It was right, and it arrived
after the fold, because I could not reach anyone.** That is the whole cost of E1 in one line.

---

# G. FOUND AFTER THE LIST WAS WRITTEN — 2

## G1 ⚠️ `scripts/ledger-inbox.mjs add` silently ignores `--dry-run`

It accepts the flag, **ignores it, writes a real queue entry, and reports success.** The documented way
to learn its contract is to run it and read which fields it says are missing — **so anyone probing it
creates a live entry containing their placeholder text.** Queued as a ledger item, in the very file
the probe created.

**Either honour the flag or reject it as unknown. A silently-ignored flag is worse than an unsupported
one: it reports success for work it did not do.**

## G2 ⚠️ Backticks in a double-quoted `-m` string are executed, and the commit still succeeds

Bash ran them as command substitution, printed two "command not found" errors, **deleted the text, and
committed anyway** — leaving a sentence with no subject in the permanent record. **Use `-F` with a
file for any message containing backticks.**

---

# THE ONE HABIT WORTH CARRYING

**Every factual error made this session ran towards the reassuring answer, and not one was caught by
the answer looking wrong.** They were caught by running a known-positive control in the same command
as the negative — and twice the control was itself broken and proved nothing: once it shared no
mechanism with the failing search, once it used a stale line number.

- **A nought needs a control that SHARES THE MECHANISM.** Proving `grep` started is not proving your
  pattern can match.
- **Report tests that RAN, not that passed.**
- **Never read an exit code after a pipe.**
- **A mutation proves at most ONE assertion per run** — a failing assertion aborts the test, so
  everything below it never executed.
- **Run the typechecker as well as the tests.** One file passed 29 of 29 while the build would not
  compile.
- **Name the commit every claim was measured at.** A verdict without its commit reads as a verdict
  about now.
