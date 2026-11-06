# 5 Nov 2026, front-end audit fix PR 1 (saves, times and edge cases)

Raised `/ward-flow` 557.8 to 558.6 KB, `/ward-flow/referrals` 551.8 to 552.5 KB and `/ward-flow/ward/rph-adult-secure` 587.2 to 591.0 KB. Measured locally on this branch against `main` at `1f2b0d2f`, both built with the same command: Home 556.1 to 558.1, Referrals 550.5 to 552.0, Ward 586.0 to 590.5 (ED 511.3 to 512.3 and Movement 582.0, both still under). The growth is spread across the shared provider and shared-client chunks (about 1.4 and 1.3 KB), from the audit fixes every screen carries: keeping the last safe demo save, the not-saved and other-tab notes in the layout, Perth time helpers, the search fold and name collation, and the sign-out and token-store guards. No single import leak was found when the chunk lists were compared. Each raise is under the 5 KB per-screen allowance in HOW-WE-WORK section 6.

## 5 Nov 2026, carried over after `main` moved

`main` moved the ward budget from 587.2 to 587.5 KB and the movement budget from 583.2 to 583.4 KB (#1471) before this PR merged. The merge keeps `main`'s value plus this PR's own raise on each screen: ward 587.5 + 3.8 = 591.3 KB, Home 558.6 KB and Referrals 552.5 KB (`main` had not moved them), and movement stays at `main`'s 583.4 KB because this PR did not raise it. Each raise is still under 5 KB over `main`. Not re-measured after the merge.

## Hosted measure after the main merge (6 Nov 2026, 00:05Z)

CI run 42132907062, merged with main 07d6dfb2: Referrals 552.6 KB (main alone 552.1 KB), so its budget 552.5 is raised to 553.1. RPH ward measured 588.3 KB (main alone 587.7 KB), so its budget is lowered from 591.3 to 588.8. Home 558.5, ED 512.9 and Movement 583.1 KB are under their budgets.

## Carried over #1474 (6 Nov 2026)

Merging main after #1474 took the higher budget for each screen, which is `main`'s value on every screen: Home 559.1, Referrals 553.4, ED 516.1, RPH ward 590.6 and Movement 585.0 KB. No budget is above what either side had. Not re-measured after the merge.
