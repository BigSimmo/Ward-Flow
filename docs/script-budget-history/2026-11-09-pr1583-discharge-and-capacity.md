# 9 Nov 2026, discharge and capacity features (PR #1583)

Raised (against main c890cda6a, after PRs #1563 and #1579 merged) referrals 568.0 to 569.9, ED 521.0
to 523.1, ward 601.3 to 604.4, movement 594.8 to 597.0, bed meeting 573.5 to 575.7 and statistics
613.8 to 615.3 (1.5 to 3.1 KB each). Every other route fits its existing limit.

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

Measured locally with the webpack production build (`npm run build`) on the branch after merging main c890cda6a (94b6dfc3a), KB gzipped:

| Route       | Main c890cda6a | This PR | Limit | New limit |
| ----------- | -------------- | ------- | ----- | --------- |
| referrals   | 567.8          | 569.7   | 568.0 | 569.9     |
| ED          | 520.9          | 522.9   | 521.0 | 523.1     |
| ward        | 601.2          | 604.2   | 601.3 | 604.4     |
| movement    | 594.7          | 596.8   | 594.8 | 597.0     |
| bed meeting | 573.4          | 575.5   | 573.5 | 575.7     |
| statistics  | 613.7          | 615.1   | 613.8 | 615.3     |

Each new limit allows the measured size plus 0.2 KB (HOW-WE-WORK §6), within the 5 KB a PR may raise without asking.
