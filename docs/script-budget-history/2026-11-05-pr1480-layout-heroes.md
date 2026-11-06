# 2026-11-05 PR #1480 design audit 6 (layout and heroes) budget raise

CI run 42130161831 measured this PR merged with main 07d6dfb2:

- Referrals `/ward-flow/referrals`: 556.0 KB (main alone 552.1 KB). Budget 551.8 raised to 556.5.

Diagnosis: the growth is the kit `Menu` that MU1 adds to the Referrals hero, so the bed meeting agenda sits under "..." beside the one Next overdue button. The Referrals screen did not load the menu before. A trim by lazy-loading the menu was considered and not done: the hero's More button would appear late on a phone while its chunk loads. The raise is 3.9 KB over main alone plus 0.5 KB margin, under the 5 KB per screen allowance.

The RPH ward and Movement screens are over their budgets on main alone (587.7 and 583.8 KB), which is not this PR's growth. The budget trim issue tracks that.

Carried over #1474: merging main after #1474 took the higher budget for each screen. Home `/ward-flow` is 559.1 (main's #1474 value), Referrals stays 556.5 (this PR), and the RPH ward (590.6) and Movement (585.0) screens take main's #1474 values. No budget is above what either side had.

Re-measured after #1474: CI run 42139161537 measured this PR merged with main a702f96e at 557.8 KB on Referrals (main alone 553.5 KB, main's budget 553.4). The growth is the same kit `Menu` (4.3 KB over main alone). Budget 556.5 raised to 558.2, which is 4.8 KB over main's budget and inside the 5 KB per screen allowance.
