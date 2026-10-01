# Ward Flow full review — 25 September 2026

Audit of the local Ward Lead folder (`D:/Worktrees/Database/ward-lead`, branch
`codex/task-ward-flow-live-state-20260831`). Database and PsychSift content were excluded, as
requested. Line numbers were correct against tip `3e38413195` when written; the line moves several
times a day.

**Method.** I ran the type check, the full offline ward suite, lint on the ward code, the organisation
check and the doc-link check. Five reviewers then read the engine, the domain modules, the screens (in
two halves) and the docs and tooling. Each finding was checked against the code; "confirmed" means it
was read in the code and usually reproduced with a throwaway script. Nothing was checked in a browser,
so nothing here says whether a screen matches its drawing.

---

## 1. The headline

1. **The ward line is red.** 72 ward test files fail (135 checks out of 1,056). The status documents
   say the full suite passes and the expected-failures list is empty.
2. **Most of it is not new.** Running the same 72 files against the 23 September commit
   (`344b0434fc`) gives 55 of them already failing. **17 broke in the commits from 24–25 September.**
3. **The 24–25 September redesigns break the "nothing is shown that the data does not hold" rule.**
   Several redesigned screens show typed-in patients, figures and vital signs as though they were
   records. Handover shows the wrong name and record number for real movements (§4.1).
4. **Two tools were writing in this folder at the same time as this audit** (see §9). Its uncommitted
   state is mixed.

## 2. Check results

| Check                                                | Result                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Type check (`tsc -p tsconfig.typecheck.json`)        | Passes                                                                                                                                          |
| Full offline ward suite (`check-ward-expected-reds`) | **72 files fail, none listed as expected**                                                                                                      |
| Lint, ward code only                                 | **85 errors, 70 warnings** (e.g. `<a>` instead of `<Link>` at `ward-management-modes.tsx:324`; `any` at `ward/ward-notification-center.tsx:50`) |
| Organisation check                                   | Exit 0 (227 review findings, none blocking)                                                                                                     |
| Ward doc links                                       | 10 broken → **fixed** (commit `6367edbe72`)                                                                                                     |

### Newly failing since 23 September (17 files)

`ward-activity-category-filters`, `ward-activity-consistent-across-screens`,
`ward-activity-count-separate`, `ward-bar-tasks-role-message`, `ward-flow-data-boundary`,
`ward-legal-figure-guard`, `ward-movement-drawer-person`, `ward-no-dead-ends`,
`ward-no-screen-claims-a-durable-access-record`, `ward-notice-mark-read`, `ward-rail-service-word`,
`ward-refinement-discharge-ui`, `ward-screen` (DOM), `ward-status-colour-reach`,
`ward-table-min-width`, `ward-table-single-source`, `ward-withdrawal-reason-privacy`.

### What the 135 failures are, grouped by cause

- **Seed grew, pins did not** (about 40 checks). Movements went from 60 to 77 and referrals from 30
  to 31; a referral source and several event types were added. Census, count and ID-list tests still
  hold the old numbers (e.g. `ward-seed-referral-census`, `ward-movement-referral-link`,
  `ward-network-stage-filter` "expected 70 to be 53"). Mostly mechanical, but some vacuity checks
  ("this fixture must carry more than one…") need a person to decide.
- **Engine behaviour changed against a pinned ruling** (about 25). Examples: RELEASE_PULL no longer
  clears linked transport (`ward-cancel-transport-*`, WF-37 / Ruling 2); DECLINE now raises
  "waitlisted" instead of "declined" (`ward-notices`); an ED role can raise a `psychiatric_ward`
  referral (`ward-referral-ed-medical-source`, R9); Ruling 16 test fails
  (`ward-owner-decisions-2026-09-16`); `Referral.originUnitId` has no producer. Each needs a decision:
  restore the ruled behaviour, or record the later decision and update the test.
- **Style guards** (about 15). Raw hex and `rgba()` in new stylesheets, undeclared tokens
  (`--ward-warning-ink`), duplicated `.table` and `.field` rules, a new breakpoint (`68.0625rem`),
  table widths the map does not pin.
- **Screen tests** (about 55). Activity drawer, notices, ED psychiatry hub, capacity, referral screens.
  Some are the seed change showing through; some are real regressions (e.g. `ward-notice-mark-read`:
  "Cannot read properties of undefined (reading 'getTime')").

Full per-test output was captured during the audit; rerun with
`node scripts/check-ward-expected-reds.mjs`.

---

## 3. Engine (reducer, model, events)

Reviewer covered about 40% of `ward-flow-reducer.ts`; `ward-derivations.ts` was not read.

**Two open items in `docs/outstanding-issues.md` are out of date:**

- "Ward Flow places patients with no eligibility check in the reducer" (#Q6WD1M) is **no longer true**:
  PULL_PATIENT runs `eligibilityRefusal` (`ward-flow-reducer.ts:3810`) and ACCEPT_REFERRAL runs
  `referralAcceptanceRefusal` (`:1124`).
- "Sex and gender are one field and it drives bed matching" (#BAY1TY) is **no longer true**:
  `Movement` has separate `sex` and `gender` (`ward-model.ts:1315, 1324`); the gender-designation gate
  reads `gender` (`ward-eligibility.ts:117`). Only the bay-mix gate reads `sex`, which the ruling
  allows.

**Findings, most serious first:**

1. **FIXED — the audit trail recorded successful legal-form changes as refused.** RECORD_LEGAL_FORM_EXPIRY
   and CORRECT_LEGAL_FORM_RECEIPT never set their outcome, so the default "denied / transition" was
   stored. Fixed with a test in commit `a4a0270444`.
2. **The free locked-bed count creeps upward** (`:4477` with `:1495/:1501`). When arrival has to invent
   an admission for a Secure movement, it marks the bed locked but never takes one from
   `allocatableLocked`; leaving then gives one back. Confirmed on WF-006: 1 → 1 → 2. Affects 7 seeded
   movements, and can let Secure pulls pass the locked-bed check wrongly. _Confirmed._
3. **Bed release and leaving are paired by ward-wide counts, not by bed or patient**
   (`:1484-1490`, `:5286-5292`), with seed exceptions hard-coded (`WR-008`, `AD-LEFT-`). A release can
   change neither figure, so the board under-reports free beds until another patient leaves. The comment
   at `:4533-4539` says leaving does not raise `allocatable`, but `:1507` does. _Confirmed._
4. **Arrival can close a movement while a booked transport job stays open** (`:4362-4364`). The "no
   transport needed" route checks only that nobody was collected, not that no job was booked; the
   comment beside it says it should. Recording "no transport needed" also overwrites a booked job
   (`:2136`). Seen on WF-005: an accepted vehicle stays booked for a patient already on the ward.
   _Confirmed._
5. **An invented arrival admission is back-dated to when the referral opened** (`:4479`,
   `pulledAt: movement.openedAt`), inflating any pull-to-arrival time. The comment above says no
   admission is fabricated; the code fabricates one. _Confirmed._
6. **That invented admission starts at discharge revision 1, not 0** (`:4501`), so a first discharge
   could be refused as stale. _Likely._
7. **Ten event types are dispatched from no screen**: CLEAR_EXPECT_FLAG, RAISE_EXPECT_FLAG,
   EVALUATE_ARRIVAL_LATENESS, EVALUATE_LEAVE_BED_WARNINGS, FLAG_LEGAL_MISMATCH,
   OVERRIDE_LEGAL_MISMATCH, RECORD_COUNTRY_EXTENSION, RECORD_LEGAL_FORM_CONTINUATION,
   RECORD_PATIENT_DISCHARGE, RELEASE_AND_REOPEN_SEARCH. The lateness, leave-bed and legal-mismatch
   ones look like safeguards but cannot run in the app.
8. **The demo clock accepts any number** (`:1770`). NaN or a negative value would break every time
   shown. Demo-only, low severity.

---

## 4. Screens

### 4.1 Wrong patient, or invented clinical facts (most serious)

1. **Handover names the wrong patient** — `handover/handover-page.tsx:254-303`. A typed-in table of
   names and record numbers overrides the real patient records (WF-002 is Maya Ashgrove; handover shows
   "Dermot Hawthorn, UM100002"). "Tobias Wren" has three different record numbers; a missing number
   falls back to `UM100001`. The same table is copied into `alerts/alerts-screen.tsx:103`, and a third
   unused copy sits in `movements-screen.tsx:63`. _Confirmed._
2. **Handover Discharges tab**: six typed-in "stuck" patients and "261 Bed Days"
   (`handover-page.tsx:2042-2160`). **Breaches tab**: a live count above four typed-in cards
   (`:2170-2212`), with no "illustrative" notice. _Confirmed._
3. **Ward bed drawer invents vital signs** for every bed, including empty ones: SpO2 98%, HR 76, BP
   122/78, pacing, transmitter battery (`ward/ward-screen.tsx:4505-4720`). Specialling is decided by
   `selectedBed % 4 === 0`, not the admission's own flag. _Confirmed._
4. **Ward bed board invents the layout**: an "HDU Suite" and pods for every ward, and patients placed
   into beds in list order (`ward-screen.tsx:900-960`). _Confirmed._
5. **Search invents legal status, legal deadline, age and sex** (`search/patient-search.tsx:307-350`).
   A detained person can appear "Voluntary"; a countdown appears for a deadline nobody entered; missing
   age shows 38 and missing sex "Male". _Confirmed._
6. **The referral drawer on the top bar lists beds at four wards that do not exist** and can recommend
   one (`referrals/ward-referral-drawer.tsx:326-461, 692-730`); preset patients sit under a "Live
   Database Search" badge. _Confirmed._
7. **Ward answer screen**: typed-in "Nurse-to-Patient Ratio 1 : 3 (Compliant)", a 65/35 gender split,
   and occupancy that counts held or closed beds as inpatients (`ward/ward-answer-view.tsx:807-835,
282-284`). Its accept dialog ignores two fields, and "Confirm Admission & Pull Bed" only records an
   acceptance in principle (`:1013-1037`). _Confirmed._
8. **Duplicate-person check shows invented "100% / 98% / 85% match"** beside text saying the date of
   birth does not confirm it (`patients/add-patient.tsx:846-851`). _Confirmed._
9. **Patient page has two buttons (WF-009, WF-004) that swap in a different patient** while the address
   still names the first (`patients/patient-now-screen.tsx:474-490`). _Confirmed._

### 4.2 Typed-in figures presented as data

- **Statistics, ward**: a "Long stays" table of four invented patients shown under "None. No admission
  on this ward has passed three months." (`statistics/statistics-ward-screen.tsx:101-130, 2409, 2435`);
  Pareto shares disagree with their own counts.
- **Statistics, ED**: triage waits, arrivals curve, "30-day WEAT" and "Median ED LOS 3h 42m" are the
  same for every department, on a page that says no history is stored
  (`statistics-ed-screen.tsx:47-104, 570-655, 1383-1413, 1649`).
- **Statistics, community**: "92.4% Target Met", "142 open cases", "28 received", contradicting "not
  recorded" on the same page; 8 of 9 is 88.9%, below the 90% target
  (`statistics-community-screen.tsx:69-136, 629-825`).
- **Statistics overview**: 13 invented days in a "last 14 days" chart and fixed sparklines, with no
  demonstration label (`statistics-screen.tsx:384-398, ~701, ~726`); "24h Net Movement" is really today
  (`:207-210`); the 30-day chart's dates are fixed to July–August (`statistics-service-screen.tsx:436-440,
591-598`); "Critical" starts at 92% on one screen and "Surge" at 95% on another
  (`statistics-overview-screen.tsx:169`, `statistics-screen.tsx:378`); an invented "6.5-Day Target"
  (`statistics-compare-screen.tsx:139`).
- **Governance registers** start from typed-in records filed against real movement IDs (OVR-107 on
  WF-014, which has no overrides); "Endorse" writes no audit event and is lost on navigation
  (`governance-registers.tsx:469-986`).
- **Alerts notice feed** is typed in and contradicts the data (WF-021 shown as "Luke Davies, completed";
  the records say Ivo Bramblewick, handover ready) (`alerts/alerts-screen.tsx:~1010-1100`); "Conditions
  checked: 7" is fixed (`:665`).
- **Officer**: a typed-in fleet panel disagrees with the live KPI above it (`officer/officer-screen.tsx:443-520`).
- **Rail "Quick Clinical Jumps"** state facts the seed contradicts (`shell/ward-rail.tsx:317-342`).
- **On-call** "100% Rostered" beside a roster showing missing slots (`on-call/on-call-screen.tsx:347-366`).
- **Delays**: typed-in "systemic holds" including a ward that does not exist (`delays/delays-screen.tsx:82-130`);
  "4h hold" typed in on ED and patient pages (`ed/ed-screen.tsx:3722, 3735`;
  `patient-now-screen.tsx:563`).
- **Settings**: "Recorded Queries (4)" pre-filled; nothing ever adds to it (`settings/settings-screen.tsx:219-224`).
- **Small typed-in facts**: a daily "07:00 Day Shift commenced" log entry (`ward-screen.tsx:3648`); "Duty
  Coordinator: Dr S. Chen (Ext 4812)" (`referral-intake.tsx:4048`); every row says "● Live"
  (`patient-search.tsx:2149`); "Preview: a quiet shift" (`board/ward-board.tsx:2154`).

### 4.3 Behaviour defects

- **Delays radar** puts patients with no legal form in the "<60m Due" row (`delays-screen.tsx:445-452`);
  "28h+" label drawn at about 31h (`:423, :803`); candidate wards mislabelled and unfiltered, with a
  duplicate React key (`:1825-1856`); the legal-clock card has no styles for breached vs warning and
  always recommends "Form 4C extension" (`:1729-1741`); four buttons only say "Not wired"
  (`:1861-1885, 1463`).
- **Community search box does nothing**, and its results cannot be reached by keyboard
  (`community/community-screen.tsx:935-1000`).
- **Keyboard access**: clickable bed cells are plain boxes (`ward-answer-view.tsx:789-796`,
  `capacity/bed-map.tsx:220`).

### 4.4 Missing styles and hard-coded colours

- Class names used but never defined, so those parts render unstyled: `community-screen.tsx` (16,
  including the status-pill tones), `patient-search.tsx` (19, the whole people list),
  `record-preview.tsx` (16), `referral-intake.tsx` (7), `ward-answer-view.tsx` (9), `delays-screen.tsx`
  (legal-clock card), plus smaller gaps in statistics, settings, out-of-area and handover.
- Raw hex (`#ffffff`, `#1d587c`, `#4f3b78`) in `statistics-ed-screen.tsx`, `statistics-service-screen.tsx`,
  `delays-screen.tsx` and `ward-notification-center.module.css`; the delays radar's pulse ignores
  reduced-motion.

**Checked and clean:** every `/mockups/ward-flow…` link points to a route that exists; no button lacks
a handler; typed search text stays out of the address bar; patient IDs in addresses are internal.

---

### 4.5 Broadcast alerts and community contacts (added from the Journey Explorer session's code reading)

Read in the code at `3e38413195`, not run. The first and last items were spot-checked for this file.

- "of 23 Clinical Units Acknowledged" has 23 typed in rather than counted from the data
  (`alerts/alerts-screen.tsx:773`).
- DISPATCH_BROADCAST_ALERT does not check severity, category or target scope against their allowed
  lists, and silently turns a duration of zero or less into 240 minutes.
- ACKNOWLEDGE_BROADCAST_ALERT silently ignores a repeat acknowledgement, and does not check that the
  unit exists or that the alert is still active. STAND_DOWN does not refuse an alert that has already
  been stood down.
- The community screen records clinical contacts with the role fixed as "community", whatever the
  viewer's actual role (`community/community-screen.tsx:562, 585, 618`).

## 5. Domain modules (catchment, eligibility, referrals, dates)

1. **Typing "constructor" into the suburb search crashes the lookup** (`ward-catchment.ts:1196`) —
   plain-object lookup with user text. _Confirmed._
2. **The same lookup is case-sensitive**, unlike every other catchment lookup, so "inglehope" gets a
   false reason (`:1195`). _Confirmed._
3. **Bed-hold expiry helpers read fields that do not exist** behind `as` casts, and nothing calls them
   (`ward-referrals.ts:1428-1445`). _Confirmed._
4. **The specialling gate says "High-acuity nursing requested"** — wrong clinical need, shown for three
   seeded wards (`ward-eligibility.ts:275`). _Confirmed._
5. **The movement path's sex-mix check uses the lenient bed figure** that the referral path was already
   corrected away from (`ward-eligibility.ts:210` vs `:612`). _Likely — confirm intent._
6. **Coordinator work-list counts withdrawn referral arms as live** (`ward-referral-visibility.ts:929`);
   latent, no caller yet. _Confirmed._
7. **Discharge and handover sheet dates are wrong outside Perth time** (`ward-clock.ts:91` with `:122`);
   the header date has the same issue (`shell/ward-bar.tsx:334-347`). Perth users unaffected. _Confirmed
   for UTC._
8. **Ages can tick over a day early in time zones behind UTC** (`ward-patients.ts:178-194`). _Likely._
9. **A comment claims the two security gates match; they do not** (`ward-eligibility.ts:519-524`).

**Handed back for your decision:**

- Admission `AD-SCGA-06` (patient PT-041) records sex Female; the patient record says Male (gender
  Female). Ward male/female counts follow this field. Should they follow sex or gender?
- `ward-legal-clock.ts` still hard-codes Mental Health Act time limits (e.g. Form 3A at 6 days); nothing
  in the app uses it, only tests. Whether those limits are right is a legal question.

**Checked and clean:** no duplicate IDs; no patient in two live admissions; every reference resolves; no
impossible date orders; hooks clean up after themselves.

---

## 6. Documentation

- `README.md:21` and `STATUS.md:16` give the tip as `8d1c7c1e00` (22 Sept); the line has moved about
  60 commits since. Both say "confirm with git log -1".
- `STATUS.md` says the suite passes and the expected-reds list is empty; the list is empty but 72 files
  fail (§1).
- **FIXED:** 10 broken links (`mockups/README.md` ×2, the 23 Sept visual audit ×7, an archived note ×3,
  some counted together).
- `mockups/third-edition-kit/run-all-checks.sh:8` still `cd`s into a deleted worktree; the README
  already warns about it.
- Two ward browser tests are skipped: `ui-ward-forced-colors.spec.ts:306` and
  `ui-ward-roles.spec.ts:272` (fixme).

## 7. Stray files at the folder root

Listed only; nothing deleted.

- Committed by mistake, it seems: `_wt_anti.py`, `_wt_count.py`, `_wt_list.txt` (worktree-analysis
  scratch, commit `ef99d63f1c`, 20 Sept).
- Not tracked: an empty folder called `1`, `dev-server.log` (about 26 MB), `scratch/` (25 one-off
  scripts), `tmp/`.
- Committed historical documents at the root rather than under `docs/ward-flow/`:
  `WARD-MOCKUPS-BRIEF.md`, `design-qa.md` (self-marked superseded).

## 8. What was fixed and committed during this audit

- `a4a0270444` — legal-form audit outcome fix, with a new test (passes).
- `6367edbe72` — 10 broken doc links repointed.

Nothing was pushed.

## 9. Uncommitted work in the folder — read before anyone commits

At your instruction the four repair helpers were **stopped mid-work**. Their partial edits are
**uncommitted and unverified**, and they are mixed with edits from **another tool that was writing here
at the same time** (it added `docs/ward-flow/governance/`, `docs/ward-flow/design-test-registry.json`,
`scripts/ward-flow/check-clinical-governance-gate.mjs`, `scripts/ward-flow/design-test-sync.mjs`,
`tests/ward-design-test-sync.test.ts`, and changes to `package.json` and
`scripts/ensure-local-server.mjs`).

54 paths are modified or new: many `*.module.css` files (style-guard repairs), engine files
(`ward-flow-reducer.ts`, `ward-flow-events.ts`, `ward-model.ts`, `ward-derivations.ts`,
`ward-eligibility.ts`, `ward-patients*.ts`, `ward-change-reasons.ts`), several screens (movements,
referrals, ward screen, notification centre, alerts) and seven test files. **Do not commit them as one
batch.** Decide first whose they are and whether to keep them; `git diff` shows each.

## 10. Suggested order of work

1. Settle who owns this folder and what happens to the uncommitted edits (§9).
2. Remove the wrong-patient table from Handover and Alerts (§4.1.1); it is the one defect that could
   mislead about who a person is.
3. Remove or clearly label the invented clinical facts (§4.1) and typed-in figures (§4.2).
4. Fix the four engine defects (§3 items 2–5) and the suburb-search crash (§5.1).
5. Make the suite green: update seed pins, decide each ruling conflict, repair the style guards. Then
   correct STATUS.md.
6. Close the two out-of-date open items (§3).
