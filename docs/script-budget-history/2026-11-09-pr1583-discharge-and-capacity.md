# 9 Nov 2026, discharge and capacity features (PR #1583)

Raised (against main 4105c7ec5, after PR #1563 merged) referrals 568.0 to 569.7, ED 521.0 to 523.0,
ward 601.3 to 604.2, movement 594.8 to 596.8, bed meeting 573.5 to 575.4 and statistics 613.8 to 615.2
(1.4 to 2.9 KB each). Every other route fits its existing limit.

Why: the PR's new engine records (clinically ready date and reason, Extend pull, weekend discharge
review, discharge checklist, follow-up reply and the discharge date trail) join the shared engine
every page loads: reducer cases, event roles and history wording, safe-event list, storage schema,
operational defaults and signed clinical values, plus the synthetic seed stays and demo overlay
that show them (about 1.1 KB of the growth is seed and overlay data). That added about 2.2 KB to
every route. To trim it, the Extend pull rule and its wording moved out of `ward-bed-hold.ts` into
`ward-bed-hold-extension.ts`, so they load only with the ward screen and the engine slice, and the
demo overlay reads the readmission window from `ward-clinical-values.ts` instead of importing
`ward-readmission.ts` into the shared chunk. That saved about 0.3 KB per route; what is left is
state every screen restores and validates on first load.

Measured locally with the webpack production build (`npm run build`) on the branch after merging main 4105c7ec5 (5d7f44320), KB gzipped:

| Route       | Main 4105c7ec5 | This PR | Limit | New limit |
| ----------- | -------------- | ------- | ----- | --------- |
| referrals   | 567.6          | 569.5   | 568.0 | 569.7     |
| ED          | 520.7          | 522.8   | 521.0 | 523.0     |
| ward        | 601.1          | 604.0   | 601.3 | 604.2     |
| movement    | 594.5          | 596.6   | 594.8 | 596.8     |
| bed meeting | 573.2          | 575.2   | 573.5 | 575.4     |
| statistics  | 613.5          | 615.0   | 613.8 | 615.2     |

Each new limit allows the measured size plus 0.2 KB (HOW-WE-WORK §6), within the 5 KB a PR may raise without asking.
