# 9 Nov 2026, Keep people on the page: item 6 panels (PR #1584)

Raised, each by 1.0 KB on top of `main` at `c8288cece`: ED `/ward-flow/ed` 519.9 to 520.9 and statistics `/ward-flow/statistics` 612.2 to 613.2. Within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured locally with a production build of this branch: ED 519.5 KB and statistics 612.2 KB. Every other route stayed under its limit. Hosted CI has measured about 0.9 KB above local builds, and both routes were at their lines already, so each needs a little room.

Why it grew: the Alerts bookings pop-up and the Tools Log a delay form each add a lazily loaded part, and every such part adds a small entry to the loader map that every route carries. The Home decision view reuses the Referrals board's lazily loaded view.

Trim made: the first build put ED and statistics over by 0.4 KB. The bookings sheet moved into its own file loaded on the first press, and the Log a delay form now loads when Tools first opens it, which took statistics from 612.6 to 612.2 KB and ED from 519.9 to 519.5 KB. No further safe trim was found. Re-measure on hosted CI and lower to the measurement plus 0.2 KB if it reads lower.

Merged after `main` 4105c7e, which had already raised ED to 521.0 and statistics to 613.8: this PR's raise now sits on top of those, at 0.6 KB each (ED 521.6, statistics 614.4), the measured growth plus a small margin. A local production build of the merged branch measured ED 520.8 KB and statistics 613.6 KB; every other route stayed under main's limits.

Merged again after `main` c890cda: a local production build measured ward `rph-adult-secure` 601.3, movements `WF-001` 594.8, `arm-ed` 657.0 and bed meeting 573.5 KB, each at its line. Each limit rises by 0.2 KB, to the measurement plus 0.2 KB: 601.5, 595.0, 657.2 and 573.7. ED (521.0) and statistics (613.8) stay within this PR's earlier raise. Re-measure on hosted CI and set each to that measurement plus 0.2 KB.

Merged again after `main` moved on 10 Nov 2026 (it had raised every route above this PR's values). This PR now takes main's limits and raises only statistics, 615.5 to 615.7 KB: a local production build measured it at 615.5 KB, on its line. Every other route measured under main's limits.

10 Nov 2026, merged again after `main` moved (it had raised every route above this PR's values). This PR now takes main's limits and raises only the routes a local production build of the merged branch put over or on the line, each to the measurement plus 0.2 KB: Home `/ward-flow` 565.1 to 565.6 (measured 565.4), ED 524.4 to 524.6 (524.4), ward `rph-adult-secure` 605.1 to 605.5 (605.3), bed meeting 577.2 to 577.4 (577.2) and statistics 616.7 to 617.5 (617.3). Every raise is well within the 5 KB per-screen allowance. Re-measure on hosted CI and set each to that measurement plus 0.2 KB.
