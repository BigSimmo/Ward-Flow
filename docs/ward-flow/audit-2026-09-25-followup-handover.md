# Ward Flow audit follow-up — handover

Follows [the full review](audit-2026-09-25-full-review.md). Chat: "Ward Flow audit follow-up".

**Updated 25 September 2026, about 17:20.** Section 0 is the current state and is written for the Ward
Flow orchestrator to take over from. Sections 1–9 are the 16:00 snapshot, kept for the record; where
they disagree with section 0, section 0 wins.

## 0. Current state (17:20)

### Owner rules now in force (Josh, about 17:00)

1. Nobody merges into, commits to, or edits the ward line (`codex/task-ward-flow-live-state-20260831`
   in `D:/Worktrees/Database/ward-lead`) until Josh says **"fold"**.
2. Work only in your own worktree and branch, and sign out files in `~/.claude/worktree-ownership.md`
   before editing. Stay out of the PsychSift cleanup, remove-invented-data and test-fixes branches.
3. A fold, when Josh says so, goes in this order: a backup branch of the line;
   `node scripts/ward-flow/fold-lock.mjs acquire "Ward Flow audit follow-up"`; check ward-lead is clean
   (if Josh has uncommitted changes there, stop and ask); merge only (no copying files, force, reset or
   rebase); run the checks; release the lock.
4. No GitHub, no pushing, no deleting files. If unsure, stop and ask.

All helpers were sent these rules word for word.

**Who folds (Josh, about 17:10):** the "Take over audit follow-up" chat folds, not this chat. This chat
builds on its own branches and never merges, folds or commits to the ward line, even on "fold". When a
helper finishes, this chat sends that chat the branch and SHA. That chat checks the branch read-only
(diff, affected tests, clean merge with the ward line and with the other open branches, no files that
another thread has signed out), marks it ready, and folds it on Josh's "fold" under the fold rules.

### Merged into the ward line today by this chat (before the rules above)

None of these took the fold lock; this chat did not know it existed.

1. `8c92157059`, merge commit, about 16:00. It brought in the Handover/Alerts identity fix
   (`7b1215cc47`), the suburb-search fix (`c02510cadd`) and this document (`fe9fe7baa8`): 7 files.
   Backup: a marker ref, `refs/backup/ward-line-before-audit-followup-fold` at `0169790d9d`. The full
   backup script was still running at the time.
2. `8572b89eb9`, fast-forward, about 16:15. The "Not legally checked" label on the Legal forms page and
   the MHA calculator: 4 files. No backup.
3. `30756324bc`, merge commit, about 16:50. The label on 16 more screens and panels, a shared
   `LegalLimitsNotChecked` component, and a sweep test: 19 files. No backup. It was checked for
   conflicts against `ward/remove-invented-data` first. The tests for every touched screen showed no new
   failing file compared with the baseline.

Times are approximate.

**Reverted since, by another chat:** `7b1215cc47` (commit `5e9f232943`), on the owner's "take out"
decision, because `ward/remove-invented-data` (`1b8b349bc4`) owns the same Handover/Alerts fix. The
suburb fix stays.

### Owner decisions today

- **Ward male/female counts follow gender**, not sex. This extends the 10 September ruling (bed matching
  reads gender). Sex stays a separate recorded fact, so AD-SCGA-06 / PT-041 counts as female.
- **Every screen showing a Mental Health Act time limit says "Not legally checked"** until the WA legal
  review. This is done on 18 screens. `tests/ward-legal-limits-not-checked.test.ts` fails if a ward
  screen reads a legal deadline without the label.
- **A bed release is a named patient's discharge.** Every release will name the stay it belongs to; when
  that person leaves, the release completes and the free-bed count moves once. There will be no pairing
  by ward-wide counts and no `WR-008` / `AD-LEFT-` exceptions. Not built yet.

### Left for the WA legal review (not decided)

Three sources disagree about Mental Health Act forms, and none has been legally checked:

- The live MHA calculator gives Form 3A as 21 days (`tools/ward-mha-calculator.tsx`).
- The engine's legal clock gives Form 3A as 72 hours metro / 6 days country (`ward-legal-clock.ts`).
- `governance/WA-MENTAL-HEALTH-ACT-COMPLIANCE.md` gives it as 24 hours, cites a different section for
  Form 1A, and calls Form 5A an inpatient order where the engine treats it as a community order.

All three are now labelled.

### Check of the fresh audit (`audit-2026-09-25-fresh-full.md`)

An Opus reviewer checked every finding against the code at `af547051e4`. Most were agreed.

- **Wrong:** B6 (secure-bed role mismatch) and B9 (discharge revision 1).
- **Already fixed:** B5 (suburb crash) and C7 (garbled characters).
- **Understated:**
  - The rail search attaches wrong patient names and forms to real movement links.
  - Patient search marks 33 of 43 patients as Aboriginal or Torres Strait Islander, because any recorded
    status counts as yes (`indigenous: Boolean(status)` in `patient-search.tsx`).
  - The three-way Mental Health Act disagreement above.
  - Three different bed-hold times are in use: 240 min in the engine, 120 min in an unused helper, and a
    fixed "4h" on screen.
- **In neither audit, unverified:** the tools-drawer catchment resolver maps clinic names to hospitals by
  substring matching.

All screen findings were sent to the "Remove invented screen data" chat, which owns those screens. This
chat's lane is the engine.

### Work in progress (each in its own worktree; nothing folded)

The Claude app restarted at about 17:14. The four helpers still running were resumed from where they
stopped, and their uncommitted work was intact.

- `ward-audit-followup` / `ward/audit-followup-20260925` (Sonnet): remove the invented arrival
  admission (locked-bed creep, back-dated admission; added by `53105ca6ea`), and refuse arrival while a
  booked vehicle is still open. The draft is `D:/Temp/claude/unapproved-engine-edits-2026-09-25.patch`.
- **STOPPED** `ward-audit-truth-a` / `ward/audit-followup-truth-a`, WIP `4373744f8d`: the coordinator
  ruled that the sex-mix / ward-count engine code belongs to the "Code map, backup and test fixes"
  thread, which has Josh's go-ahead for the same change. The WIP (sexMix keyed by gender in
  PATIENT_ARRIVED and departAdmission, plus a 4-test file) is kept only for comparison and is **not a
  fold candidate**. The strict-figure fix and the comment fix were not started.
  `ward-gender-at-referral.test.ts` still pins "sex_mix reads movement.sex", which cites the
  superseded T10 ruling.
- `ward-audit-truth-b` / `ward/audit-followup-truth-b` (Sonnet): broadcast-alert validation; the clock
  refuses impossible values; specialling refusal wording.
- **DONE, with the checker** `ward-audit-truth-c` / `ward/audit-followup-truth-c` at `eee0333136`: R9.
  RECEIVE_REFERRAL now runs the role/source pairing check first, so an ED referral naming
  `psychiatric_ward` is refused for the right reason. It was already refused before, for a different
  reason, so this was never an open loophole. `ward-referral-ed-medical-source` now passes 100 of 100;
  116 of 116 pass together with `ward-ed-to-community-referral` (re-run by this chat). Also confirmed:
  none of the ten event types the audit named is dispatched from any screen.
- `ward-audit-truth-d` / `ward/audit-followup-truth-d` (Sonnet): stale seed-count pins in tests only. It
  lists ruling conflicts for Josh and does not change them.
- Read-only (Opus): the plan for linking each bed release to its stay. Output goes to
  `D:/Temp/claude/bed-release-link-plan.md`. It must leave every sexMix line alone. The build
  (`ward-audit-release` / `ward/audit-followup-bed-release`, prepared and empty) starts once the plan
  lands.
- `ward-audit-docs` / `ward/audit-followup-docs`: this document.

Every helper worktree's `node_modules` is a junction to ward-lead's. Unlink it before any worktree is
removed.

### Correction (19:30): the arrival-admission removal WAS approved

Section 7 below says Josh stopped the "remove the invented AD-ARR admission" change. That describes about
16:05. At about 16:55 he approved it: this chat listed five engine fixes, the first being "Remove the made-up
admission created on arrival. This fixes the locked-bed count and the back-dated admission.", and he replied
"go". Commits `d3d15eb9a7` and `f9f73165f0` implement it.

### Later work (after 17:20; see the checker's fold queue for current state)

- Josh's rulings since 17:20:
  - Bed release is a named patient's discharge, with all five recommended answers. Seed releases come from
    admissions' own discharge dates (207).
  - All sample data must link to a real patient: link everything, add about 317 synthetic patients, remove
    nothing.
  - Gender and sex, option A: gender is Female, Male, Non-binary, Different term or Not recorded; sex is
    Female, Male, Another term or Not recorded. Anything else triggers coordinator review plus a reason.
- Ready or with the checker:
  - R9 `eee0333136`, arrival `f9f73165f0`, truth-d `a78892dd0f`, WF-009 `d1cbc9a2df` and truth-f
    `aa75f68cf2` (combined fold).
  - T0 patients `bef6104da4` and T3 demo links `62915dd4d5` (T3 folds after T2).
  - truth-b `e4cefa42bc` is on HOLD: the banner acknowledges as "coordinator-desk", a product call that has
    gone to Josh.
- In progress:
  - T1 admissions, T2 movements (stacked on bed-release, one-off approved), T4 rail and movement screens,
    the capacity regression (ward-derivations.ts), the bed-release test tidy-up, and the T8 guard.
- Waiting:
  - The bed-release reducer, until sex-mix folds.
  - T7, after T2.
  - The gender seed edits, until the split thread's list arrives.

### What happens next

1. Each helper finishes with its own test. This chat checks it, then sends the branch and SHA to the
   "Take over audit follow-up" chat.
2. That chat checks each branch and, on Josh's "fold", folds them one at a time under the fold lock.
   Several edit `ward-flow-reducer.ts` in different handlers, so expect small merge work.
3. The bed-release build starts once its plan is written.
4. Still open for Josh: nothing new. The legal review is on the "before any real patient" list.

## 1. Where things are (16:00 snapshot)

|                 |                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Ward line       | `codex/task-ward-flow-live-state-20260831` in `D:/Worktrees/Database/ward-lead`, tip `7a5a01dc1b` when this work started                 |
| My branch       | `ward/audit-followup-20260925` in `D:/Worktrees/Database/ward-audit-followup` (based on `7a5a01dc1b`)                                    |
| Helper branches | `ward/audit-followup-truth-a/b/c/d` in `D:/Worktrees/Database/ward-audit-truth-a/b/c/d`, based on my branch at `7b1215cc47`. No commits. |
| Ownership row   | added to `~/.claude/worktree-ownership.md` ("Ward audit follow-up — claimed 2026-09-25 15:40")                                           |

All five folders have `node_modules` as a **junction** to ward-lead's copy. Unlink it before anyone
removes one of those folders, or the removal can empty ward-lead's `node_modules`.

## 2. Why I moved out of ward-lead

A different chat was committing on the ward line in the ward-lead folder while I checked it. Seven
commits landed in ten minutes (15:22 to 15:31): merges of `ward/design-proposal-20260922`,
`ward/precommit-checks-20260925`, `ward/test-baseline-20260925` and `ward/claude-setup-fixes-20260925`,
a revert of the design-proposal merge, and "save the 25 September fresh full audit". About ten ward-lead
chats were open. Josh chose a separate folder, folding in afterwards.

## 3. Finding: the stopped repairs from review §9 were committed as one batch

- **`5d7f438126`** (25 Sept 11:48, "fix(ward-flow): resolve test failures and eliminate raw styling
  colors") holds all of it in one commit of **78 files**: the half-finished repairs that were stopped,
  and the other tool's governance files (`docs/ward-flow/governance/`, `design-test-registry.json`,
  `check-clinical-governance-gate.mjs`, `design-test-sync.mjs`, `package.json`,
  `ensure-local-server.mjs`). The review said not to commit them as one batch.
- It includes about 195 changed lines in `ward-flow-reducer.ts`, plus changes to `ward-flow-events.ts`,
  `ward-model.ts`, `ward-derivations.ts`, `ward-eligibility.ts`, `ward-patients.ts` and
  `ward-change-reasons.ts`. **The message says the test failures were resolved. The suite result below
  shows they were not.** Treat that engine code as unverified.
- 19 more commits followed on the line between 11:48 and 14:00 (settings, catchment resolver, MHA
  calculator, operator switcher, rail navigation, and others), all authored as BigSimmo.

## 4. Suite baseline (the full offline ward suite, at `7a5a01dc1b`)

**78 ward test files fail**, and none is listed as expected. The review counted 72 at `3e38413195`, so
the red has grown by 6 files since the review. The list is in the appendix, and is reproduced by
`node scripts/check-ward-expected-reds.mjs` run in the ward-audit-followup folder.

## 5. Committed on my branch (not folded)

1. **`7b1215cc47`: Handover and Alerts name the linked patient (review §4.1.1).** Removed the typed-in
   table of names and record numbers keyed by movement ID. It overrode the linked patient on Handover
   (WF-002 showed "Dermot Hawthorn") and filled gaps on Alerts, with `UM100001` as a fallback. The
   third, unused copy in `movements-screen.tsx` is removed too. Identity now comes only from
   `resolveSubjectPatient`, which shows "Unknown Patient" / "UMRN not recorded" when no record is
   linked. Alerts' invented fallback location ("Metropolitan Mental Health Service") now reads
   "Location not recorded". New test: `tests/ward-handover-alerts-patient-identity.test.ts` (5 pass). The
   110 existing Handover and Alerts checks across 13 files still pass.
2. **`c02510cadd`: suburb search (review §5.1 and §5.2).** "constructor" no longer crashes the lookup,
   and matching now ignores capital letters. The fix is a Map keyed by the normalised name. The new test
   in `tests/ward-catchment.test.ts` **fails on the old code and passes on the new** (checked). All 57
   pass.

## 6. Uncommitted, left in place (not deleted; needs Josh's decision)

- **ward-audit-followup, `ward-flow-reducer.ts`:** review §3 item 4 (a booked vehicle stays open after
  arrival). `RECORD_TRANSPORT_NEED` now refuses "not needed" while an uncancelled, un-arrived job is
  booked. `PATIENT_ARRIVED`'s no-transport route now needs no live job, and it no longer writes
  `arrivedAt` onto a job it did not use. **Not tested.**
- **Helper A (ward-audit-truth-a):** `alerts-screen.tsx`, `tests/ward-alerts-sovereign-features.dom.test.tsx`
  (review §4.2 alerts feed, "Conditions checked: 7", "of 23 units"). Stopped mid-test.
- **Helper B (ward-audit-truth-b):** `ward/ward-screen.tsx` (invented vital signs and bed layout,
  §4.1.3–4). It had reached a passing type check and was moving on to `ward-answer-view.tsx`.
- **Helper C (ward-audit-truth-c):** `search/patient-search.tsx` (invented legal status, age and sex,
  §4.1.5). It was moving on to the referral drawer.
- **Helper D (ward-audit-truth-d):** `statistics-community-screen.tsx`, `statistics-ed-screen.tsx`,
  `statistics-ward-screen.tsx` (typed-in figures, §4.2). It was about to run its tests.

The helpers were Sonnet, doing implementation work. Their brief (kept only in the session's scratch folder) said: compute a figure from state when it can be, otherwise remove it or show "Not recorded"; never keep typed-in values with a demo label. None of
their work is verified.

## 7. Engine findings made while reading (nothing changed except as noted)

- **The invented arrival admission (review §3 items 2, 5 and 6) has one cause.** Commit **`53105ca6ea`**
  (25 Sept 00:02, labelled "standardize patient identification … WA UMRNs"; 150 files) added a branch to
  `PATIENT_ARRIVED`. It creates an `AD-ARR-` admission when none exists. That admission is marked
  locked without taking a locked bed (so the free locked count creeps up on leaving), back-dated to
  `movement.openedAt`, and starts at discharge revision 1. The comment right above it says: "Fabricating
  one here would invent an occupant". **Proposed fix, not applied (Josh stopped it):** delete that
  branch, which returns the arrival step to its documented rule. It closes items 2, 5 and 6 together.
  The `AD-ARR-` ids that `PULL_PATIENT` issues are unaffected.
- **Review §3 item 3 (release and leaving paired by ward-wide counts) needs a model decision, not a code
  fix.** `BedRelease` has no link to an admission or a patient, so the engine cannot currently pair a
  released bed with the person who left it. Fixing it means adding that link (model, seed, and the
  `FLAG_BED_RELEASE` producers). The workaround comes from `7f64c1a4ac`, with hard-coded exceptions
  `WR-008` and `AD-LEFT-`. **A question for Josh:** is a bed release the same event as a named patient
  leaving, or a separate ward-level fact?

## 8. Not started

- Review §4.1 items 2, 6, 7, 8 and 9, and §4.2/§4.5 in screens no helper had reached (governance
  registers, Handover discharges and breaches tabs, referral drawer, add-patient match percentages,
  patient-page swap buttons, officer, on-call, delays, settings, rail).
- Broadcast-alert validation in the engine (§4.5).
- Step 4 (make the suite green: update the seed counts, and put each ruling conflict to Josh).
- Step 5 (correct STATUS.md; close #Q6WD1M and #BAY1TY in `docs/outstanding-issues.md`, once
  re-confirmed against the current code).
- **Questions for Josh that the review hands back (§5):** (a) admission AD-SCGA-06 / PT-041 has sex Female
  but the patient record says Male (gender Female): should ward male/female counts follow sex or gender?
  (b) `ward-legal-clock.ts` hard-codes Mental Health Act time limits (e.g. Form 3A at 6 days); these are
  used only by tests. Keep them, remove them, or get legal review?
- **A peer request not acted on:** the "Add pre-commit checks" chat asked for a read-only review of
  `docs/ward-flow/audit-2026-09-25-fresh-full.md` (check each finding and its P0–P3 ranking against the
  code). Held until Josh says so.

## 9. To resume

1. Run `bash ~/.claude/hooks/ward-fold-debt.sh --report` in ward-audit-followup. If it says BEHIND, merge
   the ward line in first.
2. Decide on each section 6 item: keep and finish, or discard. To discard, restore the file from `HEAD`
   in that folder. That is a deletion of unsaved work, so it needs Josh's yes.
3. Continue with section 8. Fold into the ward line only when the ward line is not being committed by
   another chat. Tell the folding chat before you fold.

## Appendix: the 78 failing ward test files at `7a5a01dc1b`

- `tests/ward-act-section-citation-guard.test.ts`
- `tests/ward-activity-category-filters.dom.test.tsx`
- `tests/ward-activity-consistent-across-screens.dom.test.tsx`
- `tests/ward-activity-count-separate.dom.test.tsx`
- `tests/ward-acuity-override-num.dom.test.tsx`
- `tests/ward-agent2-stress-test.test.ts`
- `tests/ward-announced-figures-carry-their-marker.test.ts`
- `tests/ward-answer-current-facts.dom.test.tsx`
- `tests/ward-audit-engine-fixes-2026-09-16.test.ts`
- `tests/ward-audit.test.ts`
- `tests/ward-bar-tasks-role-message.dom.test.tsx`
- `tests/ward-bed-availability-model.test.ts`
- `tests/ward-bed-release-lifecycle.test.ts`
- `tests/ward-bed-release-threshold-provenance.test.ts`
- `tests/ward-builder-2-features.dom.test.tsx`
- `tests/ward-cancel-transport-no-bed-held.test.ts`
- `tests/ward-cancel-transport-stage.test.ts`
- `tests/ward-capacity-screen.dom.test.tsx`
- `tests/ward-capacity-sexmix-release.dom.test.tsx`
- `tests/ward-command-third-edition.dom.test.tsx`
- `tests/ward-console-controls.dom.test.tsx`
- `tests/ward-coordinator-service-scope.dom.test.tsx`
- `tests/ward-css-token-references-resolve.test.ts`
- `tests/ward-design-language-contract.test.ts`
- `tests/ward-escalation.test.ts`
- `tests/ward-event-permissions.test.ts`
- `tests/ward-event-reachability.test.ts`
- `tests/ward-flow-contracts.test.ts`
- `tests/ward-flow-data-boundary.test.ts`
- `tests/ward-flow-reducer.test.ts`
- `tests/ward-forced-colors-tokens.test.ts`
- `tests/ward-form-labels-from-register.test.ts`
- `tests/ward-gender-at-referral.test.ts`
- `tests/ward-instant-display.test.ts`
- `tests/ward-legal-figure-guard.test.ts`
- `tests/ward-management-print-coverage.test.ts`
- `tests/ward-movement-drawer-person.test.ts`
- `tests/ward-movement-fixture-reducer-reachable.test.ts`
- `tests/ward-movement-stage-changes.test.ts`
- `tests/ward-movement-step-back-reducer.test.ts`
- `tests/ward-movement-third-edition.dom.test.tsx`
- `tests/ward-movements-service-scope.dom.test.tsx`
- `tests/ward-network-queue-count.dom.test.tsx`
- `tests/ward-network-referral-placement.dom.test.tsx`
- `tests/ward-network-stage-filter.dom.test.tsx`
- `tests/ward-network-stage-strip.dom.test.tsx`
- `tests/ward-no-screen-claims-a-durable-access-record.test.ts`
- `tests/ward-non-binary-placement.test.ts`
- `tests/ward-non-binary-single-gender-ward-placement.test.ts`
- `tests/ward-notice-mark-read.dom.test.tsx`
- `tests/ward-notices.test.ts`
- `tests/ward-override-control.dom.test.tsx`
- `tests/ward-override-surfaces.test.ts`
- `tests/ward-patient-link-default-deny.test.ts`
- `tests/ward-primitives-shared.test.ts`
- `tests/ward-pull-vocabulary.dom.test.tsx`
- `tests/ward-ready-has-one-arithmetic.test.ts`
- `tests/ward-referral-ed-medical-source.test.ts`
- `tests/ward-referral-match-gender-placement.dom.test.tsx`
- `tests/ward-referral-producers.test.ts`
- `tests/ward-referral-reducer.test.ts`
- `tests/ward-referral-referrer.test.ts`
- `tests/ward-refinement-discharge-ui.dom.test.tsx`
- `tests/ward-refusal-gaps-referrals.test.ts`
- `tests/ward-repeat-examination.test.ts`
- `tests/ward-scenarios.test.ts`
- `tests/ward-screen-eligibility-warning.dom.test.tsx`
- `tests/ward-screen-refusal-surface.dom.test.tsx`
- `tests/ward-seed-referral-census.test.ts`
- `tests/ward-service-scope.test.ts`
- `tests/ward-shortlist-gender-placement.dom.test.tsx`
- `tests/ward-stage-reached-at.test.ts`
- `tests/ward-statistics-claims.test.ts`
- `tests/ward-status-colour-reach.test.ts`
- `tests/ward-table-min-width.test.ts`
- `tests/ward-table-single-source.test.ts`
- `tests/ward-transport-not-needed.test.ts`
- `tests/ward-withdrawal-reason-privacy.test.ts`
