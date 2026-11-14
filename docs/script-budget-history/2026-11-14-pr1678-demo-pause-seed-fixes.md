# 14 Nov 2026, demo Pause and seed fixes (PR #1678, D-229)

Measured by CI's production build of the PR head (`scripts/check-script-budget.mjs`; main could not
be measured in that run). Each new limit is the measurement plus 0.2, well inside the 5 KB allowance.

Raised:

- Coordinator `/ward-flow` 603.9 to 604.6 (measured 604.4), Referrals 602.8 to 603.5 (603.3), ED
  556.1 to 556.8 (556.6), Ward 640.4 to 641.1 (640.9), Movement 634.3 to 635.0 (634.8), ED board
  694.9 to 695.6 (695.4), Bed meeting 605.2 to 605.9 (605.7), Statistics 652.1 to 652.8 (652.6).

Why: the growth (about 0.5 KB) is in the shared shell every screen loads. The demo Pause now holds
Board time, which lives in the board clock in `ward-flow-provider.tsx` (with a small container
action and a saved clock baseline), and the save check now names why it refuses a day with more
patients than beds (`ward-flow-storage-invariants.ts`).

What was tried first: the clock hold has to sit where the board's time is worked out, so it cannot
load later without moving the clock out of the provider. The over-capacity rule reuses the existing
check rather than adding a second one.
