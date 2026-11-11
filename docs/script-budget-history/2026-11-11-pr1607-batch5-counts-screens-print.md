# 11 Nov 2026, Feature build batch 5: counts, screens and print (PR #1607)

Changed on top of `main` at `5b08a5eb`: Home `/ward-flow` raised 575.4 to 577.7; Capacity `/ward-flow/capacity` raised 654.3 to 656.3; bed meeting `/ward-flow/bed-meeting` raised 592.2 to 593.4; referrals `/ward-flow/referrals` raised 583.6 to 584.0; ED `/ward-flow/ed` raised 535.4 to 535.7; ward `/ward-flow/ward/rph-adult-secure` raised 613.8 to 614.1. Each raise is under 2.5 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured on hosted CI (production build of the PR head `b8c7a8cc`, merged with main): Home 577.4 KB, Capacity 656.0 KB, bed meeting 593.1 KB, referrals 583.7 KB, ED 535.4 KB, ward 613.8 KB. Each new limit is the measurement plus about 0.3.

Why it changed: Home and Capacity gained tap-a-number figures (plan item 5, D-137), whose buttons and row builders load with the screen, and Home's More menu links the Night view (item 29). The bed meeting and ward TV gained the "Changed 14:32" marks (item 43). Shared shell code every desk route carries grew by under 0.3 KB for the count leak fix (item 1).

Trim tried: the breakdown panel and phone sheet already load only when a figure is tapped (`next/dynamic`), and the desk QR library loads only on Settings. The row builders stay with the screens because they read the screens' own lists. No other safe trim was found.

Later the same day (PR head `272e9c8`, merged with `main` at `35c7ccd`, which carries PR #1621's raises): the two PRs' raises add up. Home is 578.0, referrals 584.3, ED 536.0, ward 614.4 and capacity 656.7. Hosted CI then measured three routes just over: movement `/ward-flow/movements/WF-001` at 610.0 KB (limit 609.8), bed meeting at 593.6 KB (593.4) and statistics at 632.9 KB (632.6). So movement is raised 609.8 to 610.3, bed meeting 593.4 to 593.9 and statistics 632.6 to 633.2, each the measurement plus about 0.3. The growth is the shared shell code from the count leak fix (item 1), which every desk route loads, combined with #1621's shared forecast code. Same trim reasoning as above. This PR's total raise is still under 2.5 KB on every screen.

Later again (merging `main` at `c21e99a`, which carries PR #1609's raises): this PR's raise on each screen is added on top of main's new limit. That gives Home 579.2, referrals 585.5, ED 536.6, ward 615.3, movement 611.4, capacity 657.9, bed meeting 595.0 and statistics 634.2. Arm ED takes main's 667.6.
Hosted CI on `143f097` measured ED at 536.7 KB, 0.1 KB over the summed limit, so ED is raised 536.6 to 537.0 (the measurement plus about 0.3).

Later again (merging `main` at `cc755fa`, which carries PR #1605's limits): this PR's raise on each screen is again added on top of main's new limit. That gives Home 580.5, referrals 586.9, ED 538.5, ward 616.8, movement 613.1, capacity 659.3, bed meeting 596.5 and statistics 635.7. Arm ED takes main's 668.1.
Hosted CI on `9e45f14` measured Arm ED at 668.2 KB, 0.1 KB over main's 668.1, so Arm ED is raised to 668.5 (the measurement plus about 0.3).
