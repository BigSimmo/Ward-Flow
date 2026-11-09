# 9 November 2026, PR #1559 (search, export, saved views, training mode, go-to keys)

Raised three phone limits after the build merged with main e26f0f4c7 measured them just over:
`/ward-flow/ed` 519.9 to 521.0 KB (measured 520.0), `/ward-flow/bed-meeting` 572.0 (main after #1557) to 573.0 KB
(measured 572.4) and `/ward-flow/statistics` 611.9 to 613.0 KB (measured 612.2). The growth is the
shared shell code every page now loads: the training-mode store and connection in the provider, the
G-then-letter go-to keys in the rail, and the export button on list screens. The training banner was
already split so only a small gate loads on every page, and the report picture library loads only
when someone makes a report picture. Each raise is well under the 5 KB a PR may add per screen.

After merging main a446dca15 (staff and handover tools, PR #1562), CI measured five routes just over.
Raised: `/ward-flow/ed` 521.0 to 521.6 KB (measured 521.1), `/ward-flow/ward/rph-adult-secure` 599.0
to 600.2 KB (599.7), `/ward-flow/movements/WF-001` 593.0 to 595.0 KB (594.5), `/ward-flow/bed-meeting`
573.0 to 573.9 KB (573.4) and `/ward-flow/statistics` 613.0 to 613.9 KB (613.4). The extra comes from
this PR's shared shell code sitting alongside #1562's new shell pieces. Each total raise over main's
numbers stays under 2.1 KB, inside the 5 KB a PR may add per screen.

## After merging main 1b362e9 (9 Nov 2026, 19:50 UTC)

Main had since raised movement, bed meeting and statistics (#1582) and taken #1560. This PR keeps its own limits above. A local build of the merged branch measured ED 521.3, secure ward 599.9, movement 594.7, bed meeting 573.6 and statistics 613.6 KB, all inside them. Hosted CI is the deciding measurement.

## After merging main 3339742 (with #1580), 9 Nov 2026

#1580 raised ED, movement, bed meeting and statistics by 0.2 to 0.3 KB on main. This PR keeps the same increase over main as before (ED, movement, bed meeting and statistics +1.7 KB; secure ward +1.2 KB), so the limits become ED 521.9, secure ward 600.2, movement 595.2, bed meeting 574.1 and statistics 614.1 KB.
