# 11 Nov 2026, Repository review fixes and features (PR #1623)

Changed on top of `main` at `35c7ccd`: movements `/ward-flow/movements/WF-001` raised 609.8 to 610.3; statistics `/ward-flow/statistics` raised 632.6 to 632.9. Each raise is under 1 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured on hosted CI (production build of the PR head `883a3c1`, merged with main): movements 610.0 KB, statistics 632.6 KB, both over their limit after rounding. Main alone could not be measured because this PR updates patch-level dependencies. Each new limit is the measurement plus about 0.3.

Why it changed: Movements gained Print and spreadsheet Export (D-145 item 3). The CSV download helper moved to the ward root (`ward-csv.ts`) so Legal forms and Movements can share it without importing from the Statistics screen; Statistics now loads it through a thin wrapper.

Trim tried: the export code only runs on a tap but is small and shares the existing download helper; splitting it into a lazy chunk would add more than it saves. No other safe trim was found.

Later the same day (merged with main `c21e99a`, which had raised every route): the same two raises applied on top of main's values, so movements is 610.9 + 0.5 = 611.4 and statistics 633.6 + 0.3 = 633.9. Every other route takes main's value.
