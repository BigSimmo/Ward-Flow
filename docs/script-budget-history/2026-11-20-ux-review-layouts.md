20 Nov 2026, the nine UX review layout changes (D-270, PR 2). A local production build measured three screens over their limit by 0.1 to 0.4 KB. Each limit is now the first build's size plus 0.3 KB. A second build, after one CSS fix, measured 623.8, 621.0 and 623.0 KB, so the sizes move about 0.2 KB between builds:

- `/bedchart`: 623.9 → 624.3 KB (measured 624.0 KB).
- `/bedchart/referrals`: 620.8 → 621.4 KB (measured 621.1 KB).
- `/bedchart/bed-meeting`: 622.7 → 623.4 KB (measured 623.1 KB).

Every raise is under the 5 KB a PR may add (D-82).

**Why it grew.** Home's Flow filter row (the stage chips move off the tab row into Flow, with a "Show" label hidden on a phone) and the Tools sheet's Most used list, in code these three screens share.

**What fell.** The ward page (662.9 against 663.8), Statistics (671.9 against 672.3), Capacity and the ED screens measured under their limits, since the ward hero's Checking band, the ED sort control and the Statistics bar slot left. Those limits are left as they are, for the next PR to lower once main is measured.
