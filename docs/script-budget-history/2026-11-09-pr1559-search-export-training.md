# 9 November 2026, PR #1559 (search, export, saved views, training mode, go-to keys)

Raised three phone limits after the build merged with main e26f0f4c7 measured them just over:
`/ward-flow/ed` 519.9 to 521.0 KB (measured 520.0), `/ward-flow/bed-meeting` 571.0 to 573.0 KB
(measured 572.4) and `/ward-flow/statistics` 611.9 to 613.0 KB (measured 612.2). The growth is the
shared shell code every page now loads: the training-mode store and connection in the provider, the
G-then-letter go-to keys in the rail, and the export button on list screens. The training banner was
already split so only a small gate loads on every page, and the report picture library loads only
when someone makes a report picture. Each raise is well under the 5 KB a PR may add per screen.
