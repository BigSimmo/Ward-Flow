# 10 Nov 2026, held clinical audit fixes (PR #1599)

Changed on top of `main` at `8d948c7`: Home 574.7 to 575.4, ED 534.3 to 535.3, Ward 613.0 to 613.7,
Movement detail 608.3 to 609.5, Capacity 653.3 to 654.3 and Bed meeting 590.4 to 591.8. Each raise is
1.4 KB or less, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured on hosted CI (merged PR head `04114c3`, KB gzipped): Home 575.2, ED 535.1, Ward 613.5,
Movement detail 609.3, Capacity 654.1, Bed meeting 591.6. Each limit is the measurement plus 0.2 KB.
Main alone could not be built for comparison (its `src/instrumentation-client.ts` fails to parse in
that step), so every route over its limit counted against this PR.

Why it grew: shared code gained the D-125 and D-130 fixes. The TV and legal lines name the form in
full and say "Recorded as ended", wait bands read the signed values, sheets print initials and UMRN,
and the bed finder and out-of-area lists carry their notes.

Trim tried: none. The additions are short strings and value reads in code every route loads.
