# 10 Nov 2026, Rules and docs audit fixes (PR #1592)

Raised on top of `main` at `29352cd`: home `/ward-flow` 570.0 to 570.2. Within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured by hosted CI on head `466ae4a`: home 570.0 KB (main alone 569.6), over its limit once unrounded. Every other route this PR touches stayed under its limit; referrals, movements and statistics were already at or over their limits on main alone.

Why it grew: the Help and Activity phone tabs gained 48 px tap areas, and Help's "Recently opened" list changed how it reads usage. Both ship in the shell every route carries.

Trim tried: the growth is about 0.4 KB of the audit's accessibility fixes; no safe trim was found. The limit is the measurement plus 0.2 KB. Re-measure on hosted CI and lower if it reads lower.
