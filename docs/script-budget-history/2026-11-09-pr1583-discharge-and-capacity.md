# 9 Nov 2026, discharge and capacity features (PR #1583)

Raised ED 519.9 to 522.2, ward 599.0 to 601.5, movement 593.0 to 595.5, bed meeting 572.0 to 574.5
and statistics 611.9 to 614.4 (2.3 to 2.5 KB each). Every other route fits its existing limit.

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

Measured locally with the webpack production build (`npm run build`) on the trimmed branch, KB gzipped:

| Route       | Main a6740f02 | This PR | Limit | New limit |
| ----------- | ------------- | ------- | ----- | --------- |
| ED          | 519.8         | 521.7   | 519.9 | 522.2     |
| ward        | 598.2         | 601.0   | 599.0 | 601.5     |
| movement    | 593.1         | 595.0   | 593.0 | 595.5     |
| bed meeting | 572.0         | 574.0   | 572.0 | 574.5     |
| statistics  | 612.0         | 613.9   | 611.9 | 614.4     |

Each new limit allows the measured size plus 0.5 KB, within the 5 KB a PR may raise without asking.
