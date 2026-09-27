# Ward Flow — test baseline, 25 September 2026

The known starting point for the ward tests. Every later change can be measured against this:
after a change, **any failing file not listed below is a new break.** Nothing was fixed in this run.

- **Measured on:** the ward line at `a338c3067d`, in a clean worktree with no uncommitted changes.
- **Type check** (`tsc -p tsconfig.typecheck.json --noEmit`): **passes, 0 errors.**
- **Production build** (`npm run build`): **passes** (exit 0, about 14 minutes; it compiled and generated all 1,878 pages).
- **Full offline ward suite** (the 648 files `check:ward-expected-reds` discovers, run with Vitest
  exactly as that script runs them): **569 files pass, 79 fail.** 7,593 tests: 7,327 pass, 176 fail,
  90 skipped. All 648 files reported; none was dropped. The expected-failures list is empty, so all
  79 count as unexpected. The run took about 18 minutes.

The fresh audit earlier the same day counted 77 failing files at `13ce7b588b`. The two lists were not
compared file by file.

## The failures, grouped by likely cause

The causes are my reading of each file's first failure message, plus one direct probe for group 1.
They are likely, not proven, and one cause often explains a whole group, so fixing a cause should
clear many files at once. Numbers in brackets are failing tests out of the file's total.

### 1. Referring a patient is now refused (14 files, 71 tests)

Many tests walk a movement forward, and the first step (`REFER_TO_UNITS`) is now rejected. A direct
probe on WF-012 showed why: referral now runs the ward eligibility check, and the sex-mix gate refuses
with "This placement needs a recorded override reason". Josh ruled on 21 September to keep "invite,
then the ward refuses", so this may be a behaviour change against a ruling rather than a test
problem. **Needs a ruling check before anyone edits tests.** Everything after the refused step then
fails too, which is why the counts are high.

- `ward-cancel-transport-no-bed-held.test.ts` (1 of 7)
- `ward-cancel-transport-stage.test.ts` (1 of 3)
- `ward-flow-reducer.test.ts` (6 of 75)
- `ward-movement-fixture-reducer-reachable.test.ts` (2 of 20)
- `ward-movement-stage-changes.test.ts` (8 of 12)
- `ward-movement-step-back-reducer.test.ts` (27 of 31)
- `ward-non-binary-placement.test.ts` (5 of 10)
- `ward-non-binary-single-gender-ward-placement.test.ts` (1 of 5)
- `ward-refusal-gaps-referrals.test.ts` (3 of 6)
- `ward-repeat-examination.test.ts` (9 of 13)
- `ward-stage-reached-at.test.ts` (1 of 4)
- `ward-acuity-override-num.dom.test.tsx` (2 of 2)
- `ward-override-control.dom.test.tsx` (3 of 5)
- `ward-screen-refusal-surface.dom.test.tsx` (2 of 3)

### 2. A date crash on the activity and notice screens (5 files, 16 tests)

All five fail with "Cannot read properties of undefined (reading 'getTime')": something on these
screens reads a date that is missing. Probably one bug.

- `ward-activity-category-filters.dom.test.tsx` (3 of 3)
- `ward-activity-consistent-across-screens.dom.test.tsx` (4 of 4)
- `ward-activity-count-separate.dom.test.tsx` (2 of 3)
- `ward-bar-tasks-role-message.dom.test.tsx` (2 of 3)
- `ward-notice-mark-read.dom.test.tsx` (5 of 6)

### 3. The invented seed data grew, and counts are pinned (18 files, 31 tests)

Movements went from 60 to 77, referrals from 30 to 31, and a referral source was added. Tests that
pin counts, ID lists or the shape of the standard scenarios still hold the old numbers. Mostly
mechanical, but a few ("the fixture has exactly two…", "the scarce night's stranded set") need a
person to decide whether the new data still exercises what the test was for.

- `ward-agent2-stress-test.test.ts` (2 of 5)
- `ward-bed-release-lifecycle.test.ts` (1 of 28)
- `ward-escalation.test.ts` (1 of 5)
- `ward-movement-drawer-person.test.ts` (1 of 3)
- `ward-referral-reducer.test.ts` (1 of 68)
- `ward-referral-referrer.test.ts` (1 of 18)
- `ward-scenarios.test.ts` (2 of 6)
- `ward-seed-referral-census.test.ts` (6 of 7)
- `ward-service-scope.test.ts` (1 of 39)
- `ward-transport-not-needed.test.ts` (1 of 4)
- `ward-command-third-edition.dom.test.tsx` (1 of 10)
- `ward-coordinator-service-scope.dom.test.tsx` (1 of 8)
- `ward-movements-service-scope.dom.test.tsx` (2 of 14)
- `ward-network-queue-count.dom.test.tsx` (1 of 4)
- `ward-network-referral-placement.dom.test.tsx` (1 of 17)
- `ward-network-stage-filter.dom.test.tsx` (5 of 8)
- `ward-network-stage-strip.dom.test.tsx` (2 of 8)
- `ward-refinement-discharge-ui.dom.test.tsx` (1 of 5)

### 4. Behaviour has drifted from a recorded ruling or contract (14 files, 19 tests)

Examples: a declined referral now raises "waitlisted" instead of "declined"; an ED role can raise a
psychiatric ward referral (ruling R9); seven new engine events have no permission or screen entry;
`Referral.originUnitId` has nothing that writes it; new writes to withdrawal reasons and patient links
appeared outside their allowlists. **Each needs a decision:** restore the ruled behaviour, or record
Josh's later decision in `OWNER-RULINGS.md` and then update the test.

- `ward-audit-engine-fixes-2026-09-16.test.ts` (2 of 16)
- `ward-audit.test.ts` (1 of 24)
- `ward-bed-availability-model.test.ts` (1 of 13)
- `ward-event-permissions.test.ts` (1 of 6)
- `ward-event-reachability.test.ts` (1 of 3)
- `ward-flow-contracts.test.ts` (1 of 21)
- `ward-legal-figure-guard.test.ts` (3 of 12)
- `ward-notices.test.ts` (2 of 36)
- `ward-override-surfaces.test.ts` (2 of 15)
- `ward-patient-link-default-deny.test.ts` (1 of 4)
- `ward-ready-has-one-arithmetic.test.ts` (1 of 5)
- `ward-referral-ed-medical-source.test.ts` (1 of 100)
- `ward-referral-producers.test.ts` (1 of 6)
- `ward-withdrawal-reason-privacy.test.ts` (1 of 15)

### 5. Style and design-system guards (8 files, 13 tests)

New stylesheets use raw colours instead of `--ward-*` tokens, read tokens that do not exist, repeat
the shared table and field rules, or add table widths and status colours the guards do not know.

- `ward-css-token-references-resolve.test.ts` (2 of 8)
- `ward-design-language-contract.test.ts` (2 of 17)
- `ward-forced-colors-tokens.test.ts` (1 of 11)
- `ward-management-print-coverage.test.ts` (1 of 12)
- `ward-primitives-shared.test.ts` (2 of 5)
- `ward-status-colour-reach.test.ts` (1 of 3)
- `ward-table-min-width.test.ts` (2 of 5)
- `ward-table-single-source.test.ts` (2 of 6)

### 6. Wording and content guards (8 files, 9 tests)

Screens now quote Act section numbers, show figures without their marker, render a bare clock time
or a hard-coded threshold, name invented wards outside the data layer, or say access is "recorded"
without saying for how long. Several overlap with milestone 3 (removing invented data from screens).

- `ward-act-section-citation-guard.test.ts` (1 of 23)
- `ward-announced-figures-carry-their-marker.test.ts` (1 of 21)
- `ward-bed-release-threshold-provenance.test.ts` (1 of 6)
- `ward-flow-data-boundary.test.ts` (1 of 2)
- `ward-form-labels-from-register.test.ts` (1 of 2)
- `ward-instant-display.test.ts` (1 of 3)
- `ward-no-screen-claims-a-durable-access-record.test.ts` (1 of 4)
- `ward-statistics-claims.test.ts` (2 of 19)

### 7. Screen tests (11 files, 16 tests)

Individual screens no longer show what the test expects: missing test IDs on capacity and referral
matching, duplicated alerts, changed wording. Several are probably knock-on effects of groups 1 and
3, so re-run these after those are fixed before investigating them one by one.

- `ward-gender-at-referral.test.ts` (1 of 7)
- `ward-answer-current-facts.dom.test.tsx` (2 of 5)
- `ward-builder-2-features.dom.test.tsx` (1 of 5)
- `ward-capacity-screen.dom.test.tsx` (3 of 25)
- `ward-capacity-sexmix-release.dom.test.tsx` (2 of 4)
- `ward-console-controls.dom.test.tsx` (1 of 71)
- `ward-movement-third-edition.dom.test.tsx` (1 of 4)
- `ward-pull-vocabulary.dom.test.tsx` (1 of 15)
- `ward-referral-match-gender-placement.dom.test.tsx` (2 of 2)
- `ward-screen-eligibility-warning.dom.test.tsx` (1 of 4)
- `ward-shortlist-gender-placement.dom.test.tsx` (1 of 2)

### 8. Tooling (1 file, 1 test)

- `ward-organisation-core.test.ts` (1 of 28)

One check of the file-organisation tool fails with a bare `STACK_TRACE_ERROR`. Not investigated.

## How to repeat this measurement

Run `npm run check:ward-expected-reds` from a clean checkout of the ward line. It runs the same 648
files but prints only the failing file names, not the per-test counts above. Record any new
measurement in [`STATUS.md`](STATUS.md) with the commit it ran on.
