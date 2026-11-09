# 9 Nov 2026, discharge and capacity features (PR #1583)

Raised ED 519.9 to 522.0, ward 599.0 to 601.3, movement 593.0 to 595.4, bed meeting 572.0 to 574.3
and statistics 611.9 to 614.2 (2.1 to 2.4 KB each). Every other route fits its existing limit.

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

Measured locally with the webpack production build (`npm run build`) on the branch after the review fixes (e0bbdca46), KB gzipped:

| Route       | Main a6740f02 | This PR | Limit | New limit |
| ----------- | ------------- | ------- | ----- | --------- |
| ED          | 519.8         | 521.8   | 519.9 | 522.0     |
| ward        | 598.2         | 601.1   | 599.0 | 601.3     |
| movement    | 593.1         | 595.2   | 593.0 | 595.4     |
| bed meeting | 572.0         | 574.1   | 572.0 | 574.3     |
| statistics  | 612.0         | 614.0   | 611.9 | 614.2     |

Each new limit allows the measured size plus 0.2 KB (HOW-WE-WORK §6), within the 5 KB a PR may raise without asking.
