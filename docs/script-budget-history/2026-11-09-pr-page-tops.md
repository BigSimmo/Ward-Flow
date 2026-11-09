# 9 Nov 2026, the approved page tops (page-tops PR, branch `claude/project-thread-l4s9zr`)

Raised referrals 568.0 to 571.5, ED 519.9 to 522.8, ward 599.0 to 599.9, movement 592.7 to 595.4,
one ED 657.0 to 657.5 and bed meeting 572.0 to 577.0. Statistics is not raised here: it needs more
than the 5 KB a PR may add without asking (see below).

Why: every page now draws its top from two shared parts in `src/components/wf`: `hero-top.tsx` (the
figures, act row, chips, band and pill, about 2.4 KB gzipped, plus 0.5 KB for its class-name map) and
`folder-tabs.tsx` (the curved folder tabs, which measure the chosen tab and draw its outline, about
1.9 KB). Each measured route uses them, so each pays about 4.4 to 4.9 KB. On top of that, bed meeting
now uses the shared `Hero` (2.9 KB, already on other routes), referrals' board grew 2.0 KB, and
Statistics' own top, tabs and export grew about 2 to 3 KB.

Trims tried: lazy-loading was ruled out, because the tops and tabs are on screen at first load.
Splitting `hero-top.tsx` into one module per part, so a route loads only the parts it uses, would save
about 0.5 to 0.7 KB on routes that skip the band and pill. That file was being edited for visual
fixes at the time, so the split was not made in this PR. Drawing the folder tabs in CSS only, as the
Help drawer does, would save about 1.9 KB on every route, but it changes how the tab outline moves, so
it is a design decision and not a trim.

Measured locally, KB gzipped, on the merged tree (commit `cfc727e10`) and on `main` `8f8545382`, both
built the same way. Each new limit is the measured size plus about 1 KB, because hosted CI has
measured about 0.9 KB above local builds; bed meeting is capped at the 5 KB a PR may add.

| Route       | Main  | This PR | Old limit | New limit |
| ----------- | ----- | ------- | --------- | --------- |
| Home        | 548.8 | 551.1   | 565.1     | 565.1     |
| referrals   | 563.5 | 570.5   | 568.0     | 571.5     |
| ED          | 518.4 | 521.8   | 519.9     | 522.8     |
| ward        | 595.0 | 598.9   | 599.0     | 599.9     |
| movement    | 591.1 | 594.4   | 592.7     | 595.4     |
| Capacity    | 636.2 | 638.4   | 645.0     | 645.0     |
| one ED      | 650.7 | 656.5   | 657.0     | 657.5     |
| bed meeting | 570.9 | 576.3   | 572.0     | 577.0     |
| Statistics  | 610.2 | 618.7   | 611.9     | 611.9     |

Statistics needs about 7 KB (8 KB with the CI margin), which is more than a PR may raise without
Josh's yes.
