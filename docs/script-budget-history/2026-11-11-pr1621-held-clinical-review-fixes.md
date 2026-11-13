# 11 Nov 2026, Held clinical review fixes (PR #1621)

Changed on top of `main` at `5b08a5e`: Home `/ward-flow` raised 575.4 to 575.7; referrals `/ward-flow/referrals` raised 583.6 to 583.9; ward `/ward-flow/ward/rph-adult-secure` raised 613.8 to 614.1; capacity `/ward-flow/capacity` raised 654.3 to 654.7. Each raise is under 1 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured on hosted CI (production build of the PR head `eda932a`, merged with main): Home 575.4 KB, referrals 583.6 KB, ward 613.8 KB, capacity 654.4 KB, each over its limit after rounding. Main alone measured 575.2, 583.5, 613.6 and 654.1. Each new limit is the measurement plus about 0.3.

Why it changed: the shared bed-forecast code that these routes load grew by 0.1 to 0.3 KB gzipped. Planned admissions now skip a patient who already holds a named bed (`patientsHoldingANamedBed`), and the ED long-wait check moved into one shared `isLongWait` helper (D-145 item 1).

Trim tried: the forecast is already part of each route's first load and the added code is the fix itself, so lazy loading would save nothing. No other safe trim was found.

Later the same day (PR head `65ea28a`, merged with main `c339231`): ED `/ward-flow/ed` raised 535.4 to 535.7. Hosted CI measured 535.4 KB against main alone 535.2 KB; the same shared `isLongWait` helper and named-bed check account for the 0.2 KB. Same trim reasoning as above.
