# 9 Nov 2026, discharge and capacity features (PR #1583)

Raised (against main 3eb843f38, after PRs #1563, #1579, #1559 and #1578 merged) referrals 570.8 to
572.8, ED 524.4 to 526.5, ward 605.1 to 608.0, movement 598.9 to 601.0, capacity 645.0 to 647.5,
ED Armadale 659.3 to 660.1, bed meeting 577.2 to 579.1 and statistics 616.7 to 618.8 (0.8 to 2.9 KB
each). Home fits its existing limit.

Why: the PR's new engine records (clinically ready date and reason, Extend pull, weekend discharge
review, discharge checklist, follow-up reply and the discharge date trail) join the shared engine
every page loads: reducer cases, event roles and history wording, safe-event list, storage schema,
operational defaults and signed clinical values, plus the synthetic seed stays and demo overlay
that show them (about 1.1 KB of the growth is seed and overlay data). That added about 2 KB to
every route. To trim it, the Extend pull rule and its wording moved out of `ward-bed-hold.ts` into
`ward-bed-hold-extension.ts`, so they load only with the ward screen and the engine slice, and the
demo overlay reads the readmission window from `ward-clinical-values.ts` instead of importing
`ward-readmission.ts` into the shared chunk. That saved about 0.3 KB per route; what is left is
state every screen restores and validates on first load. Capacity and ED Armadale had some room
under their limits on main, so their raises are only what the shared growth pushes past it.

Measured locally with the webpack production build (`npm run build`) on the branch after merging
main 3eb843f38 (034feaa11), each built at its own fixed checkout path, KB gzipped:

| Route       | Main 3eb843f38 | This PR | Limit | New limit |
| ----------- | -------------- | ------- | ----- | --------- |
| referrals   | 570.6          | 572.6   | 570.8 | 572.8     |
| ED          | 524.3          | 526.3   | 524.4 | 526.5     |
| ward        | 604.9          | 607.8   | 605.1 | 608.0     |
| movement    | 598.7          | 600.8   | 598.9 | 601.0     |
| capacity    | 644.4          | 647.3   | 645.0 | 647.5     |
| ED Armadale | 658.4          | 659.9   | 659.3 | 660.1     |
| bed meeting | 576.9          | 578.9   | 577.2 | 579.1     |
| statistics  | 616.7          | 618.6   | 616.7 | 618.8     |

Each new limit allows the measured size plus 0.2 KB (HOW-WE-WORK §6), within the 5 KB a PR may raise without asking.
