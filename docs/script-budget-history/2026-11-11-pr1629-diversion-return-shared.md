# 11 Nov 2026, Returned to ED prompt in shared mode (PR #1629, D-152)

Changed on top of `main` at `b3a9f5a`: Arm ED `/ward-flow/ed/arm-ed` raised 668.1 to 668.5. The raise is 0.4 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured on hosted CI (production build of the PR head `3198944`, job 130446349074): Arm ED 668.3 KB against its 668.1 KB limit. Main alone could not be built in that job, so no main figure was available. The new limit is the measurement plus 0.2.

Why it changed: shared first-load code gained the `diversionReturns` field, its storage check, the closing-loop key and the browser's copy of the scoping rule (`diversionReturnsForTeam`), which `ward-access-state.ts` also runs when the browser scopes a desk's copy.

Trim tried: the prompt card is already loaded after the page (`diversion-return-review-lazy.tsx`), and the remaining bytes are the selector and validation wiring, which cannot be lazy. No other safe trim was found. Re-measure on hosted CI and lower to the measurement plus 0.2 KB if it reads lower.

Later the same day, after merging main at `30abc7a`: main had already raised Arm ED to 673.3 KB (batch 5, #1607), which covers this PR's 668.3 KB measurement, so this PR keeps main's limits and adds no raise of its own.
