# 10 Nov 2026, Audit fixes group 2 (PR #1604)

Changed on top of `main` at `8d948c7`: person `/ward-flow/movements/WF-001` raised 608.3 to 608.6; bed meeting `/ward-flow/bed-meeting` raised 590.4 to 590.7. Each raise is under 1 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured on hosted CI (production build of the PR head `1a52bc0`, merged with main): person 608.3 KB, bed meeting 590.4 KB, each just over its limit after rounding. Each new limit is the measurement plus about 0.3.

Why it changed: shared-shell code that every desk route carries grew by well under 0.1 KB gzipped. The break-glass button now stays off while its request is in flight (A2-04), the rail home links carry a space and a reworded accessible name (R1-N01), and four failure messages gained a next step (A8-11).

Trim tried: each change is a few bytes of the fix itself, and the shell parts are already loaded on these routes, so lazy loading would save nothing. No other safe trim was found.
