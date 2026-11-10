# 10 Nov 2026, final master audit fixes (PR #1594)

Raised Home `/ward-flow` from 570.7 to 570.9 KB, Referrals from 579.8 to 580.5 KB and Statistics from 629.4 to 629.7 KB, on top of `main` at `8f3b07282` (main lowered Referrals from 584.2 to 579.8 after #1595, so this branch's Referrals limit follows it; 580.5 allows for this PR's measured 0.2 to 0.3 KB growth with a little margin until the next hosted measurement). Within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured on hosted CI: the merged branch at Home 570.7, Referrals 584.2 and Statistics 629.5 KB, each just over main's limits (set at main's own measurement plus 0.2 KB). Every other route stayed within its limit.

Why it grew: the shared client sends a retry key with break glass and cover (audit M58), the update toast holds Reload while unsent work would be lost (M33), and the ward reducer checks the acting ward and accepted ward (M2, M4, D-128). These are small additions to code every route loads.

Trim made: the browser error reporter (TE-04) loads lazily after the page starts, so it adds nothing to first load, and the retry-key logic sits in its own small helper. No further safe trim was found. Each new limit is the measurement plus 0.2 KB.
