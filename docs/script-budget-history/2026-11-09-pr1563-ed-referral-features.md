# 9 Nov 2026, ED and referral flow features (PR #1563)

Raised ED 520.2 to 521.0, ward 599.0 to 601.3, movement 593.5 to 594.8, bed meeting 572.4 to
573.5 and statistics 612.4 to 613.8 (largest raise 2.3 KB). Every other route fits its existing
limit.

Why: the ten ED and referral features (D-110) add new engine events every page loads (psychiatry
review stages, ward ready-for-next, referral escalation and alternatives to admission: reducer
cases, event roles, storage schema and history wording). The ward page also gains the wait list
and step-down request, statistics gains the time-to-clearance median, and the bed meeting gains
the escalate action. To trim it, the patient page's no-reply timer list and the movement page's
referral timers now load on demand instead of on first load (about 0.3 KB on movement).

Measured locally with `next build --webpack` on this PR merged with main `33397422` (after #1560
and #1580; an earlier local measure matched hosted CI to 0.1 KB), KB gzipped:

| Route       | This PR | Main's limit | New limit |
| ----------- | ------- | ------------ | --------- |
| ED          | 520.7   | 520.2        | 521.0     |
| ward        | 601.0   | 599.0        | 601.3     |
| movement    | 594.5   | 593.5        | 594.8     |
| bed meeting | 573.2   | 572.4        | 573.5     |
| statistics  | 613.5   | 612.4        | 613.8     |

Each limit allows the PR's rounded measured size plus 0.3 KB, which covers the usual 0.2 KB margin
on the unrounded size.
