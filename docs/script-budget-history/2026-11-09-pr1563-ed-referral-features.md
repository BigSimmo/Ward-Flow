# 9 Nov 2026, ED and referral flow features (PR #1563)

Raised ED 519.9 to 520.7, ward 599.0 to 601.0, movement 593.3 to 594.5, bed meeting 572.2 to
573.2 and statistics 612.2 to 613.5 (largest raise 2.0 KB). Every other route fits its existing
limit.

Why: the ten ED and referral features (D-110) add new engine events every page loads (psychiatry
review stages, ward ready-for-next, referral escalation and alternatives to admission: reducer
cases, event roles, storage schema and history wording). The ward page also gains the wait list
and step-down request, statistics gains the time-to-clearance median, and the bed meeting gains
the escalate action. To trim it, the patient page's no-reply timer list and the movement page's
referral timers now load on demand instead of on first load (about 0.3 KB on movement).

Measured locally with `next build --webpack` on this PR merged with main `c8288cec` (an earlier
local measure matched hosted CI to 0.1 KB), KB gzipped:

| Route       | This PR | Limit | New limit |
| ----------- | ------- | ----- | --------- |
| ED          | 520.5   | 519.9 | 520.7     |
| ward        | 600.8   | 599.0 | 601.0     |
| movement    | 594.3   | 593.3 | 594.5     |
| bed meeting | 573.0   | 572.2 | 573.2     |
| statistics  | 613.3   | 612.2 | 613.5     |

Each limit allows the PR's measured size plus the usual 0.2 KB margin.
