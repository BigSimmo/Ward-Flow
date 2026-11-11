# 11 Nov 2026, feature batch 3: shift change and follow-up (PR #1605)

Raised seven phone routes by 0.6 to 1.7 KB on top of `main` at `8d948c74f`, each within the 5 KB
per-screen allowance in HOW-WE-WORK section 6. Each limit is the hosted CI measurement plus 0.2 KB:
Home 575.6 (limit 575.8, was 574.7), Referrals 583.8 (584.0, was 583.4), ED 535.6 (535.8, was 534.3),
Ward 614.0 (614.2, was 613.0), Movement detail 609.8 (610.0, was 608.3), Capacity 654.5 (654.7, was
653.3), Bed meeting 591.7 (591.9, was 590.4). ED arm-ed and Statistics stayed under their limits.
After main at `72d99b1cf` raised Movement detail to 608.6 and Bed meeting to 590.7 (PR #1604), the
merge kept this PR's own raise on top: Movement detail 610.3 and Bed meeting 592.2.
CI could not build main alone for comparison (its main-only build failed on
`src/instrumentation-client.ts`), so these are measured against main's limits.

Why it grew: shared code every route loads gained the batch 3 records. The reducer, the saved-board
check and the access filter now know the hand-over and carer call back records (their schema must
load to accept a saved board), and the provider derives the "returned to ED" prompts for the
community team page. The hand-over reducer itself is a lazy slice, and the Bed round card, the
returned-to-ED card and the call back form load only on their screens.

Trim: considered, none made. The returned-to-ED derivation in the provider is the first candidate to
move behind the community screen's own load. Re-measure on hosted CI and set each limit to the
measurement plus 0.2 KB if it reads lower.
