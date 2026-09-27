# F01a Movements resolved-outcome correction r36

Date: 2026-09-13  
Owner: `/root/hub_inventory`

## Reproduced defect and cause

The Resolved today population was correct: six movements closed with `closure.outcome: "arrived"`
and one closed with `closure.outcome: "did_not_proceed"`. The StageRow renderer branched only on
the existence of `closure` and assigned every closed row the `Did not proceed` chip. This made all
seven cards contradict the correct 6-arrived/1-did-not-proceed reconciliation shown elsewhere.

## Owned files

- `src/components/ward-management/movements/movements-screen.tsx`
- `tests/ward-movements-screen.dom.test.tsx`

Before-source copies are under
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-movements-outcome-label-r36/` with the
same repository-relative paths.

## Correction

StageRow now derives only its terminal state chip from the existing closure outcome:

- `arrived` renders `Arrived` with the screen's existing `routine` chip level.
- `did_not_proceed` retains `Did not proceed` with the existing `cancelled` chip level.

The closure population, stage, row tone, recorded closure reason, frozen closure clock, urgency chip,
links, counts, engine, and reducer are unchanged.

The DOM regression opens the real Resolved today tab, derives today's closures from the fixture and
model clock, requires both outcomes to be present, and checks the state-chip node on every resolved
row for its recorded outcome and against the opposite outcome. The existing closed-row reason and
frozen-clock coverage remains intact.

## Source evidence

| File                                 | Before SHA-256                                                     | After SHA-256                                                      |
| ------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `movements-screen.tsx`               | `2E13851A3AE210B1C337EB1367C88CBB6E9666C079A4C39781AACF79145ACE81` | `E30488FBB240DA976FD138BAD358A1F517E7AA2CCB898FAB6E9F97F8B6BEA8CF` |
| `ward-movements-screen.dom.test.tsx` | `97D25127FDE2DF22AA8ACFD33852AAE5670062845842C2451FE586FB2BA625C2` | `D07758940C58BDD693DDE75FA7AED5608812F5408EFCE3291B9806F9963C3172` |

- Prettier completed on both owned files with no further change.
- `git diff --check` passed for both owned files.
- No test runner or browser was used, as instructed.

Controller-focused test command:

`node .superpowers/sdd/2026-09-12-visual-rebuild-wave-one/run-focused.mjs tests/ward-movements-screen.dom.test.tsx`

The earlier full-suite result (`454/454` files, `5077` passing, one unrelated Hub token failure) was
captured before this correction and is not validation of the new source or regression.

### Focused-run follow-up

The controller's next three-file focused run collected 51 tests: 49 passed and two failed. The new
per-closure outcome regression passed. One older seven-stage assertion failed because its unscoped
`getByText("Arrived")` now matched both the stage heading and the newly truthful resolved-row chip.
That assertion now queries the level-three stage heading within the existing `Every movement today`
region. This preserves its seven-stage, populated-stage, and empty-stage checks without weakening the
contract.

The regression derives every expected row label from `closure.outcome`; it does not assert six or one
as fixed future counts. Requiring the current fixture to contain both outcome kinds is deliberate
anti-vacuity: the regression could not distinguish the two rendering branches if one kind silently
disappeared from its seed.

The test-only follow-up was snapshotted at
`.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/before-movements-stage-query-r36/`:

| File                                 | Before follow-up SHA-256                                           | After follow-up SHA-256                                            |
| ------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `ward-movements-screen.dom.test.tsx` | `616909FF7FD6B03417F6DCE2EE5845E89AC3A0BEDC1E8A87027A6C91EAFD434A` | `D07758940C58BDD693DDE75FA7AED5608812F5408EFCE3291B9806F9963C3172` |

`npx prettier --check tests/ward-movements-screen.dom.test.tsx` and `git diff --check --
tests/ward-movements-screen.dom.test.tsx` passed. The follow-up has not been rerun; the controller can
use the same focused command above.
