# 9 Nov 2026, discharge and capacity features (PR #1583)

Raised (against main 1cad868ae, after PRs #1563, #1579, #1559, #1578, #1586 and #1584 merged) home
565.6 to 567.2, referrals 570.8 to 572.4, ED 524.6 to 526.2, ward 605.5 to 607.6, movement 598.9 to
600.7, capacity 645.0 to 647.0, ED Armadale 659.3 to 659.8, bed meeting 577.4 to 578.8 and
statistics 617.5 to 618.5 (0.5 to 2.1 KB each).

Why: the PR's new engine records (clinically ready date and reason, Extend pull, weekend discharge
review, discharge checklist, follow-up reply and the discharge date trail) join the shared engine
every page loads: reducer cases, event roles and history wording, safe-event list, storage schema,
operational defaults and signed clinical values, plus the synthetic seed stays and demo overlay
that show them (about 1.1 KB of the growth is seed and overlay data). That added about 2 KB to
every route. To trim it, the Extend pull rule and its wording moved out of `ward-bed-hold.ts` into
`ward-bed-hold-extension.ts`, so they load only with the ward screen and the engine slice, and the
demo overlay reads the readmission window from `ward-clinical-values.ts` instead of importing
`ward-readmission.ts` into the shared chunk. That saved about 0.3 KB per route; what is left is
state every screen restores and validates on first load. ED Armadale had some room under its
limit on main, so its raise is only what the shared growth pushes past it.

Measured locally with the webpack production build (`npm run build`) on the branch after merging
main 1cad868ae (e0d7aab14), each built at its own fixed checkout path, KB gzipped:

| Route       | Main 1cad868ae | This PR | Limit | New limit |
| ----------- | -------------- | ------- | ----- | --------- |
| home        | 565.4          | 567.0   | 565.6 | 567.2     |
| referrals   | 570.7          | 572.2   | 570.8 | 572.4     |
| ED          | 524.4          | 526.0   | 524.6 | 526.2     |
| ward        | 605.3          | 607.4   | 605.5 | 607.6     |
| movement    | 598.8          | 600.5   | 598.9 | 600.7     |
| capacity    | 644.9          | 646.8   | 645.0 | 647.0     |
| ED Armadale | 658.4          | 659.6   | 659.3 | 659.8     |
| bed meeting | 577.2          | 578.6   | 577.4 | 578.8     |
| statistics  | 617.3          | 618.3   | 617.5 | 618.5     |

Each new limit allows the measured size plus 0.2 KB (HOW-WE-WORK §6), within the 5 KB a PR may raise without asking.
