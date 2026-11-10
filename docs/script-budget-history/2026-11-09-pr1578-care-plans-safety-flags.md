# 9 Nov 2026, care plans and safety flags (PR #1578)

Six limits raised to this PR's measured size plus 0.2 KB, after merging `main` at `4e5163a1f`
(after #1559). Each raise is 1.2 to 2.2 KB over `main`'s limit. Most of it is `main`'s own growth:
on the earlier merge with `c890cda6a`, `main` alone was already over these limits on the hosted
build, and this PR's own share was under 1 KB on each route.

Before raising, two routes that grew by more than 5 KB were trimmed. The patient page's new Care and
safety card now loads on its own (as the ward change and journey cards already do), which took the
movement page from 616.5 to 596.8 KB on the `c890cda6a` merge. The ED board and person sheet load
the card tags on their own, because the referral reader they use was not otherwise on the ED page;
that took ED arm-ed from 665.1 to 656.0 KB, under its limit.

Measured locally with `next build --webpack` and `scripts/check-script-budget.mjs` on the merge with
`4e5163a1f`, KB gzipped:

| Route       | This PR | Old limit (`main`) | New limit |
| ----------- | ------- | ------------------ | --------- |
| referrals   | 570.4   | 569.1              | 570.6     |
| ED          | 524.2   | 522.7              | 524.4     |
| ward        | 604.7   | 603.2              | 604.9     |
| movement    | 598.5   | 596.5              | 598.7     |
| bed meeting | 576.7   | 575.2              | 576.9     |
| statistics  | 616.5   | 615.5              | 616.7     |
| ED arm-ed   | 658.2   | 659.3              | 659.3     |

## 10 Nov 2026 follow-up (review fixes)

The review fixes (shared duplicate-check helpers, escalation wording, a restored-role check) added
under 0.1 KB to four routes. The hosted build on `b71af274d` measured them at their old limits or
just over, so each limit is now that measurement plus 0.2 KB:

| Route       | Hosted build | Old limit | New limit |
| ----------- | ------------ | --------- | --------- |
| referrals   | 570.6        | 570.6     | 570.8     |
| ward        | 604.9        | 604.9     | 605.1     |
| movement    | 598.7        | 598.7     | 598.9     |
| bed meeting | 577.0        | 576.9     | 577.2     |
