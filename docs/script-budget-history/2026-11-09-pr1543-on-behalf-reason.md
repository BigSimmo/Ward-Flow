# 9 Nov 2026, On behalf of the ward reason (PR #1543)

Raised: ED site `/ward-flow/ed/arm-ed`, budget 653.6 to 654.0 (main had raised it from 653.3 to 653.6 in PR #1541). On the earlier base, hosted CI measured 653.5 KB on this PR against 653.2 KB for main alone, so this PR adds about 0.3 KB.

Why it grew: D-80 item 17. The shared reducer now checks the coordinator's "on behalf of the ward" reason when a ward's discharge record is opened, and the record access log and stored-state check carry the reason. That rule lives in the shared engine, so every screen carries it. Trim done: the reason picker itself is loaded lazily, so it adds nothing to the first load of Capacity or Discharges. The engine check cannot be lazy because the reducer refuses an open without a reason. The raise is 0.4 KB, within the 5 KB per screen allowance in HOW-WE-WORK section 6.

## Second raise, after the access fixes and Report a problem design joined this PR

Measured by hosted CI against main alone (main a08dd534). Main then raised these three budgets for its own growth (to 560.9, 594.3 and 589.2), so this PR's raise sits on top of main's:

- `/ward-flow/referrals`: to 561.4 (main 560.9) (560.6 KB measured, main alone 560.2 KB, so +0.4 KB).
- `/ward-flow/ward/rph-adult-secure`: to 595.3 (main 594.3) (594.6 KB measured, main alone 593.7 KB, so +0.9 KB).
- `/ward-flow/movements/WF-001`: to 589.7 (main 589.2) (589.0 KB measured, main alone 588.6 KB, so +0.4 KB).

Why it grew: the desk-held cookie that keeps the coordinator's network figures out of a ward desk's first page lives in the shared desk store and layout, so every screen carries it, along with the D-80 reason check above. Trim done: the held page first reused the route loading placeholder, which pulled its client page-shape code into every screen (about +1.4 KB everywhere). It now uses a server-only loading line (`src/app/ward-flow/loading-status.tsx`), which brought six of the nine routes back under budget. Each raise above is within the 5 KB per screen allowance in HOW-WE-WORK section 6.
