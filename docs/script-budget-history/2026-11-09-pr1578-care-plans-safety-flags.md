# 9 Nov 2026, care plans and safety flags (PR #1578)

Six limits raised to this PR's measured size plus 0.2 KB, after merging `main` at `c890cda6a`. Most
of each raise is `main`'s own growth: `main` alone was already over these limits on the same build
(hosted run on this PR, "main alone" step). This PR's own share is under 1 KB on each route.

Before raising, two routes that grew by more than 5 KB were trimmed. The patient page's new Care and
safety card now loads on its own (as the ward change and journey cards already do), which took the
movement page from 616.5 to 596.8 KB. The ED board and person sheet load the card tags on their own,
because the referral reader they use was not otherwise on the ED page; that took ED arm-ed from 665.1
to 656.0 KB, under its limit.

Measured locally with `next build --webpack` and `scripts/check-script-budget.mjs`, KB gzipped:

| Route       | Main alone (hosted) | This PR | Old limit | New limit |
| ----------- | ------------------- | ------- | --------- | --------- |
| referrals   | 569.3               | 569.3   | 568.0     | 569.5     |
| ED          | 522.3               | 522.5   | 521.0     | 522.7     |
| ward        | 602.4               | 602.9   | 601.3     | 603.1     |
| movement    | 595.9               | 596.8   | 594.8     | 597.0     |
| bed meeting | 574.6               | 575.1   | 573.5     | 575.3     |
| statistics  | 614.8               | 614.7   | 613.8     | 614.9     |
| ED arm-ed   | 658.6               | 656.0   | 657.0     | 657.0     |
