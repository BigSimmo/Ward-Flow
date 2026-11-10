# 10 Nov 2026, Clinical display fixes from the 10 Nov audit (PR #1590)

Raised on top of `main` at `3f4b957`: ED `/ward-flow/ed` 529.4 to 529.6 and ED arm `/ward-flow/ed/arm-ed` 664.5 to 664.7. Within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured by hosted CI on the merged branch: ED 529.4 KB (main alone 529.2) and arm-ed 664.5 KB (main alone 664.4), each on its line. Every other route stayed under its limit.

Why it grew: D-122 adds four synthetic entries to the clinical values register (forecast alerts and the handover prompt), and the help copy now reads the access grant length from the register. The register is shared code that every ED route carries.

Trim tried: the growth is 0.1 to 0.2 KB of register data that D-122 requires; no safe trim was found. Each limit is the measurement plus 0.2 KB. Re-measure on hosted CI and lower if it reads lower.

## Second raise, same day (on `main` at `29352cd`)

Hosted CI on head `39e13c5` measured this PR over five limits after the second main merge and the review fixes: home `/ward-flow` 570.2 KB (main alone 569.6), ED 529.6 (main alone 529.5), bed meeting 584.3 (main alone 584.1), and referrals and movements at their limits of 583.6 and 605.1 once unrounded. Raised home 570.0 to 570.4, referrals 583.6 to 583.8, ED 529.6 to 529.8, movements 605.1 to 605.3 and bed meeting 584.1 to 584.5, each the measurement plus 0.2 KB. Statistics is left alone: main alone is already over its limit, and the budget trim issue tracks that. The growth is the same shared register text as above; no safe trim was found.

## Third raise, same day (on `main` at `9c06e96`)

After #1592 merged, main's home limit is 570.2 KB (home measured 570.0 there). This PR alone measured home 0.6 KB over main, so the combined home limit is set to 570.8 (about main plus this PR's growth plus 0.2). Re-measure on hosted CI and lower if it reads lower.
