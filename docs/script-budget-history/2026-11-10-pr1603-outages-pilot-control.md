# 10 Nov 2026, Outages and pilot control (PR #1603)

Changed on top of `main` at `8d948c7`: `/ward-flow` 574.7 to 576.1 (measured 575.7); `/ward-flow/referrals` 583.4 to 584.4 (measured 584.0); `/ward-flow/ed` 534.3 to 536.1 (measured 535.7); `/ward-flow/ward/rph-adult-secure` 613.0 to 614.5 (measured 614.1); `/ward-flow/movements/WF-001` 608.3 to 610.2 (measured 609.8); `/ward-flow/capacity` 653.3 to 655.0 (measured 654.6); `/ward-flow/bed-meeting` 590.4 to 592.3 (measured 591.9); `/ward-flow/statistics` 632.6 to 633.0 (measured 632.6). Each raise is under 2 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured on hosted CI (production build of the PR head `24f493f`). Each limit is the measurement plus 0.4. The budget gate could not build `main` alone on that run, so part of the growth may be main's own.

Why it changed: Batch 4 adds three shared records (site feature switches, downtime pack print times and outage windows). Their stored-state schema, reducer slice hook, provider fields and the site switch sync in the ward layout load on every route, about 1 to 1.5 KB gzipped.

Trim tried: the reducer logic already sits in a lazy slice. The site switch list must load with the shell, because the feature flag store and the stored-state check read it on start, so lazy loading the sync would not move the module out. No other safe trim was found.
