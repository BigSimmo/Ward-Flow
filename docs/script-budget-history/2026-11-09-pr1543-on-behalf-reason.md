# 9 Nov 2026, On behalf of the ward reason (PR #1543)

Raised: ED site `/ward-flow/ed/arm-ed`, budget 653.3 to 653.7. Hosted CI measured 653.5 KB on this PR; main alone measured 653.2 KB.

Why it grew: D-80 item 17. The shared reducer now checks the coordinator's "on behalf of the ward" reason when a ward's discharge record is opened, and the record access log and stored-state check carry the reason. That rule lives in the shared engine, so every screen carries it. Trim done: the reason picker itself is loaded lazily, so it adds nothing to the first load of Capacity or Discharges. The engine check cannot be lazy because the reducer refuses an open without a reason. The raise is 0.4 KB, within the 5 KB per screen allowance in HOW-WE-WORK section 6.
