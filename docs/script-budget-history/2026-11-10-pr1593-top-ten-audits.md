# 10 Nov 2026, Top 10 master-list audits (PR #1593)

Raised Home `/ward-flow` from 570.0 to 570.4 KB on top of `main` at `29352cd0f`. Within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured on hosted CI: the merged branch at 570.0 KB against main alone at 569.6 KB, so this PR adds about 0.4 KB. Every other route stayed within main's limits; statistics was already over on main alone (626.6 against 626.4), which the budget trim issue tracks.

Why it grew: the shared client keeps an offline refusal on screen and counts unsent changes after a reload (audit M10), refusals name the patient (audit M2), Statistics shows an unknown share as "—" (audit M6), and Acknowledge visible records a held batch when the page is left (audit M8). These are small additions to code every route loads.

Trim made: the M10 refusal helpers moved into `ward-conflict-scope.ts`, which is already in the shared bundle, so nothing new is loaded. No further safe trim was found. Re-measure on hosted CI and set the limit to that measurement plus 0.2 KB if it reads lower.

Update, 10 November 2026 (after merging `main` at `c2fdee950` and adding D-126): hosted CI measured the merged branch at Home 570.5, Referrals 584.0, ED 530.0, Movement detail 605.4 and Bed meeting 584.6 KB, against main alone at 570.6 or less, 583.6, 529.6, 605.1 and 584.3. Each limit is now the measurement plus 0.2 KB: Home 570.7, Referrals 584.2, ED 530.2, Movement detail 605.6, Bed meeting 584.8. The growth is the shared refusal, sign-out and sort code every route loads; no further safe trim was found. Statistics is over on main alone (626.6) and is left to the budget trim issue.

Update, 10 November 2026 (after merging `main` at `48b4ccd92`): hosted CI measured Statistics at 629.2 KB merged against main alone at 628.7 KB, so this PR adds 0.5 KB there (the D-126 neutral map order and the M6 unknown share). The Statistics limit is now the measurement plus 0.2 KB: 629.4.
