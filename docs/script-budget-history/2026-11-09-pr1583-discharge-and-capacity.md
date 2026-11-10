# 9 Nov 2026, discharge and capacity features (PR #1583)

Raised (against main 4e5163a1f, after PRs #1563, #1579 and #1559 merged) referrals 569.1 to 571.0,
ED 522.7 to 524.8, ward 603.2 to 606.2, movement 596.5 to 598.7, capacity 645.0 to 645.7, bed
meeting 575.2 to 577.3 and statistics 615.5 to 617.1 (0.7 to 3.0 KB each). Every other route fits
its existing limit.

Why: the PR's new engine records (clinically ready date and reason, Extend pull, weekend discharge
review, discharge checklist, follow-up reply and the discharge date trail) join the shared engine
every page loads: reducer cases, event roles and history wording, safe-event list, storage schema,
operational defaults and signed clinical values, plus the synthetic seed stays and demo overlay
that show them (about 1.1 KB of the growth is seed and overlay data). That added about 2.2 KB to
every route. To trim it, the Extend pull rule and its wording moved out of `ward-bed-hold.ts` into
`ward-bed-hold-extension.ts`, so they load only with the ward screen and the engine slice, and the
demo overlay reads the readmission window from `ward-clinical-values.ts` instead of importing
`ward-readmission.ts` into the shared chunk. That saved about 0.3 KB per route; what is left is
state every screen restores and validates on first load. Capacity was 2.5 KB under its limit on
main, so its raise is only the 0.7 KB the shared engine growth pushes past it.

Measured locally with the webpack production build (`npm run build`) on the branch after merging
main 4e5163a1f (5bde9c84d), both built at their own checkout paths, KB gzipped:

| Route       | Main 4e5163a1f | This PR | Limit | New limit |
| ----------- | -------------- | ------- | ----- | --------- |
| referrals   | 568.9          | 570.8   | 569.1 | 571.0     |
| ED          | 522.5          | 524.6   | 522.7 | 524.8     |
| ward        | 603.0          | 606.0   | 603.2 | 606.2     |
| movement    | 596.3          | 598.5   | 596.5 | 598.7     |
| capacity    | 642.5          | 645.5   | 645.0 | 645.7     |
| bed meeting | 575.0          | 577.1   | 575.2 | 577.3     |
| statistics  | 615.4          | 616.9   | 615.5 | 617.1     |

Each new limit allows the measured size plus 0.2 KB (HOW-WE-WORK §6), within the 5 KB a PR may raise without asking.
