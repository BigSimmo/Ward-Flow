# 14 Nov 2026, stress test fixes (PR #1674, D-213 to D-218)

Measured by CI's production build of the PR head (`scripts/check-script-budget.mjs`; main could not
be measured in that run, and main has not moved since #1670). Each new limit is the measurement plus
0.2, well inside the 5 KB allowance.

Raised:

- Coordinator `/ward-flow` 602.9 to 603.9 (measured 603.7), Referrals 601.4 to 602.8 (602.6), ED
  554.9 to 556.1 (555.9), Ward 638.0 to 640.4 (640.2), Movement 632.9 to 634.3 (634.1), ED board
  693.7 to 694.9 (694.7), Bed meeting 604.2 to 605.2 (605.0), Statistics 650.8 to 652.1 (651.9).

Why: the growth (1.0 to 2.2 KB) is in the shared shell every screen loads. The new shell modules are
the Western Australia clock rule (`src/lib/ward-time-zone.ts`, read by the reducer and every time
shown), the one-hour bed-count freshness rule (D-214), the legal-mismatch badge and the medical-trip
held-bed warning. The D-218 wording removal took text out, which offsets part of it.

What was tried first: the time-zone rule and the freshness rule are read by the engine at load, so
neither can load later without splitting the reducer. One export that nothing used was made private,
which changes nothing in the build.
