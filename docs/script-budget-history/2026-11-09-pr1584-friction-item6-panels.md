# 9 Nov 2026, Keep people on the page: item 6 panels (PR #1584)

Raised, each by 1.0 KB on top of `main` at `c8288cece`: ED `/ward-flow/ed` 519.9 to 520.9 and statistics `/ward-flow/statistics` 612.2 to 613.2. Within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured locally with a production build of this branch: ED 519.5 KB and statistics 612.2 KB. Every other route stayed under its limit. Hosted CI has measured about 0.9 KB above local builds, and both routes were at their lines already, so each needs a little room.

Why it grew: the Alerts bookings pop-up and the Tools Log a delay form each add a lazily loaded part, and every such part adds a small entry to the loader map that every route carries. The Home decision view reuses the Referrals board's lazily loaded view.

Trim made: the first build put ED and statistics over by 0.4 KB. The bookings sheet moved into its own file loaded on the first press, and the Log a delay form now loads when Tools first opens it, which took statistics from 612.6 to 612.2 KB and ED from 519.9 to 519.5 KB. No further safe trim was found. Re-measure on hosted CI and lower to the measurement plus 0.2 KB if it reads lower.

Merged after `main` 4105c7e, which had already raised ED to 521.0 and statistics to 613.8: this PR's raise now sits on top of those, at 0.6 KB each (ED 521.6, statistics 614.4), the measured growth plus a small margin. A local production build of the merged branch measured ED 520.8 KB and statistics 613.6 KB; every other route stayed under main's limits.
