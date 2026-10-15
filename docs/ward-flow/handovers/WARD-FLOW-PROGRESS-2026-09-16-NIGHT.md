# Ward Flow progress checkpoint — 16 September 2026, night

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow. §8 is a snapshot at `cad83238a0`; §1 to §7 are the running record and their unfolded-branch lists are all folded. The open owner questions in §7 and §8 were answered in round 2 of `docs/ward-flow/owner-answers-2026-09-17.md` (including R2-2, which reverses §8 question 2).

Written in a hurry because the session was about to run out of usage. Everything named here is
committed unless marked otherwise. Verify against git before acting.

## 1. Where the work is

- **Fix line:** `ward/audit-fixes-20260916` in `D:/Worktrees/Database/ward-audit-fixes`, tip `2e59608647`
  at time of writing. It CONTAINS ward-lead's HEAD (`60d24f938d`, Gemini's two commits), so bringing
  it home to `D:/Worktrees/Database/ward-lead` is a fast-forward once the line is final.
- **Not yet folded into ward-lead.** Nothing on the fix line is in ward-lead. Gemini is closed; the
  owner ruled "keep and fix" its work.
- node_modules in every `ward-audit-*` folder is a JUNCTION to ward-lead's node_modules (no install).

### Folded into the fix line (done, tested per branch)

restyle plan (D1–D7) · lead-fixes WLQ-35/36 · audit docs · movements horizon chart from engine data ·
engine fixes (bed leak, cascade, cancel at pulled, bookedBy, arrival actingUnitId, Form 1A receipt,
dead duplicate cases) · ED CSS classes + tap targets · ED five undefined classes · drawing-rules
checker script · URL privacy (typed patient text via in-memory handoff) · task-ledger refresh (Flow
chat) · Settings: 7 controls "Not wired in this prototype." · D5 wording (legal forms, delays,
priority, handover) + Alerts open-only · officer/discharges/referral-match/network fixes · Gemini fixes
(Tasks drawer gating, demo persistence repaired: no free text stored, anchor/day/version checks,
request-id counter, full validation; community decline honest but Not wired) · push-guard comments +
tests (comment-only diff verified) · a one-line typecheck fix.

Combined run earlier: 447/447 across 19 files (before later folds). Typecheck clean after `66dd26fbc4`.
**No full `npm run test`, lint, or verify gate has been run on the final line yet.**

### Still running when this was written (their folders may hold UNCOMMITTED work)

| Folder (`D:/Worktrees/Database/…`) | Branch                            | Job                                                                                                                                                                                                                                                           |
| ---------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ward-audit-wiring                  | ward/audit-wiring-20260916        | Wire 3 Settings controls to a new `configuration` state + `SET_CONFIGURATION` (coordinator, audited); mark medical-release and acuity Not wired; remove Settings section numbers / 3A / 5A / "Statutory". Defaults unchanged (hold 60, cap max 3, ED 12–36h). |
| ward-audit-smallfixes              | ward/audit-smallfixes-20260916    | community-index aria-disabled; correct the stale "D9" reference in the redirect-stub test                                                                                                                                                                     |
| ward-audit-review-engine           | ward/audit-review-engine-20260916 | CANCEL_TRANSPORT never moves stage; legal-guard loop skips only 3D + reason check; helper comment; two-movement cascade test                                                                                                                                  |
| ward-audit-review-ui               | ward/audit-review-ui-20260916     | stale search handoff leak; D-11 misquote; delays caption back to "in ED"; ED decline reasons on referral-match; records say gemfix branch                                                                                                                     |
| ward-audit-review-chart            | ward/audit-review-chart-20260916  | horizon bars overlapping in one lane; empty state                                                                                                                                                                                                             |

**On resume:** for each folder run `git -C <folder> status --short` and `git -C <folder> log --oneline 66dd26fbc4..HEAD`.
Commit or re-run unfinished work, then fold each branch into the fix line (`git merge --no-ff`), run the
focused tests each report named, typecheck, then the fold gate, then fast-forward ward-lead.

### Queued, not started

- Community-team decline full wiring: widen `DECLINE_REFERRAL` reason by destination kind in
  `ward-flow-events.ts` + reducer; then switch on the community decline on `community-screen.tsx` and
  `referral-match.tsx` (both currently "Not wired"). Wait for review-ui to fold (referral-match).

## 2. The master plan — status

Twelve read-only Opus planners were dispatched. Seven reported (summaries below). Five were still
running and their output is lost if the session ended: **referral model (WF-09/11/12/14/15/23),
clinical & legal (WF-01/03/17/30/31/36), screens & design (WF-27/28/44/50 + top bar + drawing
clean-up), tests & verification (WF-34/35/47/52 + fold gate), consolidated owner decision list.**
Re-dispatch those five on resume (briefs: read-only, base the fix line tip, per-task Owns / failing
test first / acceptance / depends / parallel-safe / size, owner questions with options).

### Reported planner summaries (tasks that need NO owner answer are marked ▶)

- **Engine state accounting (WF-02/04/06/13/37/39).** ▶T1 time-0 truthiness at seven transport sites
  - refuse re-collection · ▶T2 one `movementHoldsBed` rule incl. seed pulls stepped back · ▶T3 no
    RELEASE_PULL / revoked-exam refund / WITHDRAW_ACCEPTANCE after collection · ▶T4 no REFER_TO_UNITS
    while accepted · ▶T5 CANCEL_TRANSPORT never moves stage (being done by review-engine) · ▶T6 full
    step-back matrix test · ▶T10–11 withdrawn referral stops reading "queued" everywhere. Reducer
    order: T5 → T1 → T3 → T4 → T2 → T6. Owner Qs: release a held bed cancels its booking?; cancel
    without auto-replacement?; a "withdrawn" referral state?; who owns the empty-bed count (WF-06)?;
    what next for a movement stepped back past acceptance?
- **Capacity & time (WF-07/08/24/25/26/51).** ▶T1 refuse unknown event types / non-finite `now` ·
  ▶T2 CONFIRM_CAPACITY integer 0..beds · ▶T3 cap refunds at beds · T4–T5 revision check on capacity
  writes + ward-screen draft conflict (owner Q2) · T6 locked-bed consumption on pull (**clinical:
  locked-bed free count can stay too high after a pull**, owner Q3) · T7 Today/Tomorrow on release
  and leave times (owner Q4) · T8 one meaning of "today" (Q5) · ▶T9 fix scarce scenario (gry-older-
  adult allocatable > empty) · T10–11 remove "nobody goes without today", base "ready" on
  min(allocatable, empty) (Q6, Q7).
- **Admissions & bed lifecycle (WF-18/20/22/40).** ▶T1 `RECORD_FOLLOW_UP` (ruling 25; rewrite the
  "no producer" guards deliberately) · ▶T2 refuse "being made ready" before discharge · ▶T4 coordinator
  selection clears on closed movement. Blocked: leave-bed episode (Q2), discharge-date writers (Q4),
  turnover identity (Q5). "+ Plan departure" stays Not wired.
- **Notices, governance, queue (WF-10/32/38/41/49, STILL-03).** ▶T1 activity feed uses opening tier
  (`urgencyChanges[0]?.from ?? urgency`) + urgency-change events · ▶T2 record applied accept/pull
  overrides · ▶T4 `MARK_NOTICES_READ` engine event · ▶T5 Activity count stops summing notices ·
  T7 switcher privacy (Q5 option A: signpost for coordinators only) · T8 register wording per action.
- **Journey & transport (WF-05/16/19/21/42/43/45).** ▶T1 ED Stop transport + revoke-after-accept
  controls (WLQ-38) · ▶T2 coordinator Stop transport · ▶T3 cancel-authority wording · ▶T4 "Stopped
  after collection" label · ▶T5 one `pullHoldExpired` rule (**console shows "Pull expired: nothing is
  being kept" for a patient already in a vehicle**). Blocked: delivered vs ward receipt (Q2),
  no-transport journey (Q1, Q9), renew hold (Q3), which ED (Q4), diversion (Q5), stop destination +
  officer notice (Q6), cancel without replacement (Q7), regional (Q8).
- **Outside-team gates (WF-29/33/46/48, #G4YPNE, device).** Prepare now: access-scope matrix, ward
  scope filter (not security), threat model, local store interface, draft hazard log with coverage
  test, pilot-readiness template, intended-purpose draft, test that Aboriginal status is never a
  decision input, capability register. Outside asks: clinical safety officer, privacy adviser, ICT
  identity, TGA screening, Aboriginal health reviewers (owner commissions), WA MH legal owner.
- **PsychSift (ships via origin/main, separate PRs).** Findings 1 and 8 already fixed on main; 4–7
  deliberate. PRs: (1) `server-only` on supabase admin + proxy-auth-crypto; (2) search-scope owner
  filter uses the public marker + UUID check (tell owner, RAG impact line); (3) inbox records: the
  Caring Contacts closures #1S81R8/#B16HW8 overstate what was done (human reviews not done; validator
  has no production caller; `patient-detail.ts:128-130` forces the fictional-number check off).

### Adversarial review of the fix line (at 65aa7c54a6): fold after P2s — being fixed by the

review-engine / review-ui / review-chart agents and the wiring agent (Settings D5 leftovers).

## 3. Questions waiting on the owner (consolidated; recommendations in brackets)

1. Revoked exam after transport booked: keep bed (15 Sept) or release (16 Sept)? [keep; coordinator releases]
2. Legal clocks (Ruling 1) vs no time limits (WLQ-5/D5)? [no clocks until legal advice confirms sections and start times]
3. Gender decides bed now or later? [later]; non-binary placement (DECISION-05) — clinical call
4. Community teams cancelling transport — build team identity now? [later]
5. ED→community team referral: build properly now? [now]
6. Who confirms MHA sections/start times? [colleague or legal adviser]
7. Keep "Tentative diagnosis" on bed board? [keep, confirm] 8. Keep referral history free text? [keep]
8. Bed hold default: 60 / 120 min / 24 h? [120] · 10. Parallel cap above 3? [no] · 11. ED threshold 12–36h? [yes]
9. Diversion mid-journey [new destination with reason; bed held until coordinator releases]
10. Hold runs out [nothing automatic; flag; ward/coordinator renew or release]
11. Queue order [urgent flag, tier, longest wait uncapped] · 15. Urgent flag records who/when [yes]
12. Regional multi-leg [out of scope] · 17. Rulings 7 and 12 need a plain explanation first
13. Which ED drawing (Ruling 13) · 19. Which capacity figures coordinators don't use
14. Ward switcher shows other wards [coordinators only]
15. Accepting a referral creates no journey [deliberate for now; reword]
16. Internal patient ids in URLs [ok for prototype]
17. Morning screen [retire] · 24. Protected deletions (scratch test, two never-fail tests, orphaned Codex worktree record, duplicate Patient search D7) [yes]
18. 28 inbox files moved to applied/ [put back and reconcile properly]
19. Outside people: safety officer, privacy, database, cultural review — who and when
20. Other roles' visibility under Ruling 10 (ED, officer, community) · 28. Relabel Ruling 10 (it says D-14)
21. Governance docs home [existing ward ledger]
22. Notice "read" [explicit mark as read] · 31. Which decisions notify [withdraw acceptance, revoked exam, ED→CMHT]
23. Ward "limiting admissions" box [fixed list you supply] · 33. Unneeded override reason counts? [no]
24. Follow-up recorded by [ward only for now] · 35. Leave bed linked to admission [yes] · 36. Plan departure [Not wired + build ward-side discharge date steps]
25. Locked bed used by a pull [secure uses locked first] (clinical) · 38. Old capacity reading refused [yes]
26. Today/Tomorrow chooser on release times [yes] · 40. "Tomorrow" = calendar day [yes]
27. No-transport journey: ED marks left, ward confirms [yes] · 42. Officer "Arrived" becomes "Delivered" [yes]
28. Record which ED a ward patient went to [yes] · 44. Stop transport records destination + tells officer [yes]
29. Cancel leaves nothing booked [yes] · 46. Transport need recorded by a person [yes]
30. PsychSift: search change without live canary [yes] · 48. Railway key in URL ok [rotate if pasted anywhere]
31. Caring Contacts refuse fictional number in live mode [yes] · 50. New P1 for the undone human reviews [yes]

## 4. Update — 17 September, after the usage reset

- **Folded since the first checkpoint:** plans (screens & drawings, clinical & legal, referral model,
  tests & fold gate, owner decision list), small fixes (community letter rail, D9 citation), horizon
  chart bar stacking, engine review fixes (cancel never moves stage, stronger legal guard, two-movement
  cascade test). Fix line tip `84ea708320` at time of writing.
- **Resumed after the limit:** `ward-audit-wiring` (Tasks 1–7 committed; 8–10 in progress) and
  `ward-audit-review-ui` (uncommitted work in 8 files; finishing fixes 1–5).
- **Wave 1 of the plans, one Sonnet agent per folder, base `84ea708320`:**
  `ward-w1-board-gender` (bed-board caption; genderEligibility per WLQ-35) · `ward-w2-scarce` (WF-26 scarce
  scenario) · `ward-w3-activity` (WF-49 opening tier) · `ward-w4-transport-copy` (cancel-authority copy;
  "Stopped after collection") · `ward-w5-handover-declined` (WF-23 declined-by-all) · `ward-w6-test-guards`
  (tautology guard, retired-suite guard, runner skips) · `ward-w7-community-coordinator` (community
  comparison table gating; WF-22 closed selection) · `ward-w8-screen-verification` (WF-35 drawing vs
  implementation state) · `ward-w9-capacity-tests` (WF-27 capacity control tests).
- The untracked `docs/ward-flow/plans/2026-09-16-fix-plan-inputs/` folder in `ward-audit-fixes` holds
  empty captures from a failed extraction; ignore it (deleting needs the protected-deletion override).

## 5. Update — 17 September, later

- **Folded (fix line tip `531c74440e`):** all of wave 1 (w1–w9); wave 2 x2 Delays one mark at a time
  (WF-27), x3 Activity count no longer sums notices (WF-10), x4 withdrawn referrals stop reading queued
  (WF-13), x5 patient-link guard detects destructuring, callback parameters and one nested level; the
  Settings wiring (ED access target, parallel referral cap and pulled-bed hold read from
  `state.configuration`, audited, guarded). Backup `claude-work/2026-09-16T153915Z` taken before the
  wiring fold.
- **Known red:** `tests/ward-console-controls.dom.test.tsx` "refuses to cancel until a reason is chosen,
  then cancels and the surface goes". Cause proven (Opus debugger): CANCEL_TRANSPORT installs a
  replacement job even when no bed is held, so the orphan never clears. Fix in `ward-y1-cancel-transport`.
- **Opus adversarial review of `65aa7c54a6..3b3f215ba1`: fold after fixes.** P1 F1 (above); P1 F2 demo
  persistence still writes typed patient names, record number, date of birth and sending team to
  sessionStorage; P2 F3 blanking every blocker/history misstates a restored session; P2 F4 exact
  anchor-minute check discards nearly every save; P2 F5 community page says teams can decline while the
  control is Not wired; P2 F6 records claim "no free text stored" (false until F2 lands — correct at
  fold). P3s F7–F14 routed below or recorded.
- **Batch Y running, base `531c74440e`, one Sonnet agent per folder:** y1 cancel with no bed held (F1,
  duplicate job id) · y2 community decline wired end to end + shared ED decline reasons (makes F5 true) ·
  y3 referral R3 wording, R4 admission keeps referral link, R5 raise guard · y4 persistence default-deny
  on typed-text events, configuration validated on restore (F2/F3/F4/F7; Opus review before fold) · y5
  tautology/retired-suite guards and runner invocation check (F9/F10/F12) · y6 Tasks drawer role
  sentence, letter rail name, horizon blank rows (F8/F14) · y7 remove Act section citations + citation
  guard (clinical T1; Opus review before fold) · y8 no legal countdown without a recorded written time
  (clinical T5).
- **Recorded, not yet routed:** F11 screen-verification implementation hash covers only the screen's own
  folder (no hashes recorded yet); F13 WITHDRAW_ACCEPTANCE leaves a withdrawn acceptance reading as
  declined-by-all (owner question); F14 console cancel-authority sentence when the booking ward is the
  receiving ward (BOOK_TRANSPORT does not refuse that; WLQ-11).
- **Awaiting owner yes:** delete four scratch files `tests/zz-scratch{-debug,2,3,4}.test.ts` in
  `ward-w7-community-coordinator` and remove their block from the shared `.git/info/exclude` (an agent
  added it to get a commit through; exact names only).

## 6. Update — 17 September, after the owner's answers

- **Owner answered the 64 questions** — `docs/ward-flow/owner-answers-2026-09-17.md` (verbatim exceptions;
  CLARIFY 17, 28, 39, 46, 47, 49 re-asked in plain words). Open to the owner as well: Form 3D identity (the
  official title is the order after an off-site psychiatrist examination; his "3 days" description reads
  like Form 3C) and legal plan Q2 (refuse collection while a revoked examination holds the bed).
- **Folded since §5:** y1 (no-bed cancel, blocker, STEP_BACK test), y2 (community decline end to end), y3
  (R3/R4/R5), y5 (guard hardening), y6 (Tasks drawer, letter rail, horizon rows), y7 (Act citations +
  guard, after an Opus review fix round), y8 (no form countdown without a written time), z5 (hold default
  4 h), z6 (records closed, WF-53..57 logged), z7 (PT-007 prose), z9 (Morning spec re-pointed at Capacity),
  owner-approved deletions (two scratch tests, duplicate Patient search drawing, orphaned `ward-lead1`
  registration, emptied Morning spec; backups `claude-work/2026-09-16T161634Z`), plus controller fixes to
  three stale test pins (permissions table, stage-change derivation reading comments, Ready coordinate).
- **Running:** y4 fix round (persistence default-deny; Opus privacy review "fold after fixes"); z10 (29
  type errors); l1 (legal T1), l7 (legal T7), l13 (legal T13); Opus planners for referrals/transport and
  for screens. Legal plan committed: `docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`.
- **Not yet done:** retiring the Morning route's own files (waits on the screens plan); the full ward suite
  and the fold gate before bringing the line to ward-lead.

## 7. Wrap-up — 17 September, stopped at the owner's request

The owner asked to stop after the current wave, then to wrap up early. Every running helper was stopped.
What had been committed green was folded; everything else stays on its own branch, listed here.

### Folded in this last stretch (on top of §6)

Screens: M1 community label, J1 wording lists pinned, K1 referral census, S1 service membership, I1 switcher
coordinators-only, A1 "Not wired" panel, S2 service chooser + scope bar, D1 Delays scoping, D2 Movements
scoping. Legal: T1 ED shows only the typed expiry, T6 drawings, T7 repeat examination, T13 NUM tick (+DOM).
Referrals: T2 "Delivered", Q3 notices, RA2 withdrawn acceptance, RB1 GP source. Privacy: y4 first round,
z11 classification move, sentinel `expectTypeOf` fix. Also z10 type errors, z12 claims re-read, screens L1
Morning prep (non-deletion edits), census/GP crossing fix. The screens H1 merge was reverted (its commit
carried the unfinished, failing H2 test).

### Unfolded branches — resume from these (verify each with git log/status first)

- `ward/l2-typed-expiry-20260917` (`25a53bcbed`) — legal T2 engine: typed expiry for any form, extensions,
  FORM_* constants deleted, provenance-property guard. Green, tsc clean. **Needs the Opus T2r guard review
  before folding** (started, stopped before a verdict). Untracked `measure-scan-scratch.mjs` in its folder.
- `ward/r-q1-queue-urgent-20260917` (`ba4d000b5e`) — queue order flag > tier > uncapped wait; urgent flag
  needs a reason and records who/when; two new reasons (ten total). Green. **Needs the Opus lane review**
  (stopped before a verdict).
- `ward/y4-persistence-privacy-20260917` — second privacy fix round **uncommitted** in its folder (5 files).
  Its list is the Opus re-review: lock on any new rejection, lint on four assertion aliases, `Storage.prototype`
  spy, comment corrections, SET_SCENARIO membership check, guard sentinel against the real union, branded and
  template strings, wrong-role reset test. The `expect(true)` item is already fixed on the fix line.
- `ward/z13-morning-retire-20260917` (`f530bcd4e4`) — the Morning files are deleted in a **deliberately red**
  commit; the coupled test and nav edits are **uncommitted** in its folder (12 files). Do not fold until a
  second commit makes it green (list of edits in the L1 report: ward-nav unlisted entry, route count,
  landmarks, reachability, sidebar phone contract, override-surfaces, referral-screen boundary, coverage
  pointer, diff-integrity record).
- `ward/s-h-statistics-20260917` (`0710601308`) — H1 statistics sentence done; H2 "today" counts test written
  and failing, implementation unfinished. Re-fold after H2.
- `ward/s-c1-capacity-scope-20260917` and `ward/s-f1-release-day-20260917` — work **uncommitted** in their
  folders (Capacity scoping; Today/Tomorrow chooser, reported green but not committed).
- The D2 folder is left with its screen file reverted to pre-fix (a red-proof run was interrupted); the branch
  itself is correct and folded.
- Reviews not completed: R1 (does service scoping hide safety information — D1 narrows every Delays figure
  with no carve-out), T2r, the queue-lane review, and the pre-flight quick checks (lint, links, ledger).
- Untracked scratch files to remove with approval: `ward-l13-acuity-num/count_check.mjs`,
  `ward-l2-typed-expiry/measure-scan-scratch.mjs`.

### Owner questions still open (asked in chat, each with a recommendation)

Form 3D identity (official title is the order after an off-site psychiatrist examination; the "3 days"
description reads like Form 3C), and the Form 3A "21-day review track" drawing label; refusing collection
while a revoked examination holds the bed; clarifications 17, 28, 39, 46, 47, 49; screens Q1-Q3 (referral
lists narrow by service; more example referrals; rail and drawers stay whole-network); referrals Q1-Q3
(who records diversions and reasons; stopping transport keeps the bed held; only the booking community team
cancels); the proposed item-18 withdrawal reasons.

### Plan tasks not started

Legal T3, T4, T5, T6b, T8, T9, T10-T12, T14, T15. Referrals T1, T3, T4a/b, Q2, RA1, RB2-RB7, and GP in the
quick "new referral" menu. Screens B1, C1 (uncommitted), E1, F1 (uncommitted), F2, F3, G1, G2, H2, A3, K2, K3,
P1, Z1, R1. Plans: `docs/ward-flow/plans/2026-09-17-build-plan-{legal-clinical,referrals-transport,screens}.md`.

## 8. 17 September — everything folded home to ward-lead at `cad83238a0`

**State:** ward-lead is at `cad83238a0`, the same commit as `ward/audit-fixes-20260916`. Nothing is pushed.

**Gates at `cad83238a0`:**

- full ward suite: 570 files, 6,750 tests, 0 failing
- tsc: clean
- diff-integrity: PASS
- mockup-retirement: PASS
- screen-map, mockup-manifest, owner-rulings-index and screen-verification checks: all current
- eslint `--max-warnings 0` on every changed Ward Flow file: clean

In a real browser (chromium-mockups), every `ui-ward-*` spec passed: 94 passed, 3 deliberately skipped, 0 failed. That includes the new `ui-ward-full-journey.spec.ts`, which walks community referral → ED raise → refer → accept → pull → transport → arrival → discharge planning with no dead end. `tests/ward-no-dead-ends.dom.test.tsx` renders 35 routes and 1,443 controls, and finds none dead.

**Folded since §7:**

- **Antigravity's work.** Its unattended folds and its unsaved patient-now screen were kept and fixed, per the owner's "keep and fix":
  - The fake success toasts on Legal Forms and Alerts now say "Not wired in this prototype."
  - Form titles come from the register.
  - Patient-now shows only its two authored examples; every other id opens the governed record.
  - No computed legal time is shown.
- **Legal:** T4, T8, T10, T11, T12 (including the screen controls and the reviewed reasons), T14 and T15, plus gender review round 2:
  - RAISE_REFERRAL checks gender and diagnosis against their lists.
  - RECORD_MOVEMENT_GENDER, with history.
  - Ward and ED screens never say sex or gender in a bed verdict.
  - Forward steps re-check the held ward after a late gender correction, and the coordinator gets a notice.
- **Referrals:** T1 (item 30), T3, Q1, Q2, RA1, RB2, RB3, RB4 (with review findings F4–F7 and F10), RB5 (with UI) and RB7 (with control). Also:
  - An ED outcome or community referral tells the ward, the officer and every asked ward.
  - No second journey can be raised from one referral.
  - A revoked acceptance clears `acceptedUnitId`.
  - ED-withdrawn patients stay visible under "Withdrawn".
- **Screens:** A3, B1, F3, G1, G2 and H1/H2, plus scoped-safety round 2:
  - Long ED waits outside the chosen service count as urgent.
  - One shared set of urgency causes.
  - Outside patients are named.
  - Capacity labels its whole-network panels.
  - One no-recorded-service count everywhere.
- **Sample data:** 60 movements, so every service has a patient at every reachable stage, and 30 referrals. A referral-history honesty test was added, and one wrong pronoun was fixed.
- **Morning retirement:** cleaned up.

**Deliberately not built:** F2 (the ward panel order) was superseded when Antigravity replaced the ward drawing with a different panel set. GP stays out of the quick new-referral menu (owner ruling 2026-09-11).

**Owner questions still open, each with a recommendation:**

1. Should "For discharge" from the ED require the examination outcome for a patient on a form, as community referral already does? Recommend yes.
2. Should a non-binary patient never be placed on a single-gender ward, even with a coordinator's reason? Recommend keeping it that way.
3. Should the referral board's Tier cell regain its bold, dark styling?
4. The officer screen loses content when printed, root cause not found. Chase it?
5. A stop-transport control still waits on the diversions question.

Also still waiting on the owner from §7: Form 3D labels, the Settings look, collection while flagged, diversions, community cancel permission, and clarifications 17, 28, 39, 46, 47 and 49.

**Pre-existing, outside this work:**

- `tests/source-control-bytes.test.ts` fails on literal bytes in `docs/ward-flow/lessons/` (present since 2026-09-12).
- `docs:check-links` reports about 59 old missing paths.
