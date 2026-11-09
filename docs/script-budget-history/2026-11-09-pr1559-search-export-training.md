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

## After merging main 4105c7e (with #1563)

#1563 moved main's limits to ED 521.0, secure 601.3, movement 594.8, bed meeting 573.5 and statistics 613.8. This PR keeps the same increments over main as before: +1.7 KB for ED, movement, bed meeting and statistics, and +1.2 KB for the secure ward. New limits: 522.7, 602.5, 596.5, 575.2 and 615.5. Hosted CI decides; each screen stays well within the 5 KB allowance.

## Hosted CI on 2fb3331 (merged with main 4105c7e)

Hosted CI measured three screens over: Referrals 568.7 KB (limit 568.0), secure ward 602.8 KB (602.5) and ARM ED 658.9 KB (657.0). The Referrals queue and ED lists now carry this PR's lazy Export button and the shared go-to and saved-view code. Limits set to the hosted measurement plus 0.2 KB: Referrals 568.9 (+0.9 over main), secure ward 603.0 (+1.7 over main) and ARM ED 659.1 (+2.1 over main). Each stays within the 5 KB per-screen allowance.

## Hosted CI on a67d87a (merged with main c890cda, after #1579)

The secure ward measured 603.0 KB and ARM ED 659.1 KB, both a fraction over limits set to the same rounded value; Referrals measured exactly at its 568.9 limit. Limits now carry 0.2 KB headroom: Referrals 569.1 (+1.1 over main), secure ward 603.2 (+1.9) and ARM ED 659.3 (+2.3). Each stays within the 5 KB per-screen allowance.
