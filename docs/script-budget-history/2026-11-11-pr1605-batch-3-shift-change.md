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

After main at `5b08a5ebe` raised six routes again (PR #1599), the second merge kept this PR's own raise on top of main's values: Home 576.5, Referrals 584.2, ED 536.9, Ward 615.0, Movement detail 611.5, Capacity 655.7 and Bed meeting 593.7.

The production build on that merge (`0384eb1df`) measured four routes just over those sums, each about 1.4 KB above main alone. They are set to the measured size plus 0.1 KB: Home 576.7, Referrals 585.0, Ward 615.1 and Statistics 633.7 (up 1.1 KB from main's 632.6). Every raise stays within the 5 KB rule.

After main at `35c7ccd91` raised five routes by 0.3 to 0.4 KB, the third merge kept this PR's raise on top of main's values: Home 577.0, Referrals 585.3, ED 537.2, Ward 615.6, Movement detail 611.5 and Capacity 656.1. Ward gets 0.2 KB more rounding room, because the build on `50ee20680` measured it at exactly its limit, and that counted as over.

The build on `47311d11b` measured Statistics at 633.9 KB, 1.4 KB above main alone. It is set to 634.1, up 1.5 KB from main's 632.6.

After main at `f0db2beec` raised every route again (PR #1609), the fourth merge kept this PR's raise on top of main's values: Home 578.2, Referrals 586.5, ED 537.8, Ward 616.5, Movement detail 612.6, Capacity 657.3, Bed meeting 594.8 and Statistics 635.1. Arm ED stays at main's 667.6.

The build on `3ac0b5560` measured Arm ED at 667.9 KB against main's 667.6 limit. Main alone could not be built for comparison. Arm ED is set to 668.1, up 0.5 KB.
