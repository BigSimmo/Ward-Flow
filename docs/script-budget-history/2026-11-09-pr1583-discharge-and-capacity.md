# 9 Nov 2026, discharge and capacity features (PR #1583)

Raised (against main b29dfaa76, after PR #1581 page tops and #1588 merged) home 565.6 to 570.0,
referrals 580.8 to 583.4, ED 527.9 to 529.4, ward 607.5 to 609.2, movement 602.6 to 604.8, ED
Armadale 663.0 to 664.5, bed meeting 583.0 to 584.1 and statistics 623.1 to 626.4 (1.1 to 4.4 KB
each). Capacity stays at 651.1, under its limit. Main itself measured 1.7 KB over its home limit at
this path, so the PR's own growth on home is about 2.5 KB.

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
main b29dfaa76 (9ab70208b), each built at its own fixed checkout path, KB gzipped:

| Route       | Main b29dfaa76 | This PR | Limit | New limit |
| ----------- | -------------- | ------- | ----- | --------- |
| home        | 567.3          | 569.8   | 565.6 | 570.0     |
| referrals   | 575.7          | 583.2   | 580.8 | 583.4     |
| ED          | 527.2          | 529.2   | 527.9 | 529.4     |
| ward        | 606.4          | 609.0   | 607.5 | 609.2     |
| movement    | 602.1          | 604.6   | 602.6 | 604.8     |
| capacity    | 647.1          | 648.8   | 651.1 | 651.1     |
| ED Armadale | 662.9          | 664.3   | 663.0 | 664.5     |
| bed meeting | 582.0          | 583.9   | 583.0 | 584.1     |
| statistics  | 621.8          | 626.2   | 623.1 | 626.4     |

Referrals grew 7.5 KB, but most of that is webpack splitting differently, not this PR's code: the
build now ships a 5.7 KB copy of Next.js's own link and dynamic-loading runtime as a separate chunk on
that page (the duplicate Next.js chunk PR #1581 left as a follow-up), and the export and referral
status chunks were regrouped. The limit raise is 2.6 KB.

Each new limit allows the measured size plus 0.2 KB (HOW-WE-WORK §6), within the 5 KB a PR may raise without asking.
