# 9 Nov 2026, ED and referral flow features (PR #1563)

Raised ED 519.9 to 520.5, ward 599.0 to 600.8, movement 593.0 to 594.2, bed meeting 572.0 to
572.9 and statistics 611.9 to 613.3 (largest raise 1.8 KB). Every other route fits its existing
limit.

Why: the ten ED and referral features (D-110) add new engine events every page loads (psychiatry
review stages, ward ready-for-next, referral escalation and alternatives to admission: reducer
cases, event roles, storage schema and history wording). The ward page also gains the wait list
and step-down request, statistics gains the time-to-clearance median, and the bed meeting gains
the escalate action. To trim it, the patient page's no-reply timer list and the movement page's
referral timers now load on demand instead of on first load (about 0.3 KB on movement).

Measured locally with `next build --webpack` on the merge of `22635ba37` (it matched the hosted
CI figures on the previous head to 0.1 KB), KB gzipped:

| Route       | This PR | Limit | New limit |
| ----------- | ------- | ----- | --------- |
| ED          | 520.3   | 519.9 | 520.5     |
| ward        | 600.6   | 599.0 | 600.8     |
| movement    | 594.0   | 593.0 | 594.2     |
| bed meeting | 572.7   | 572.0 | 572.9     |
| statistics  | 613.1   | 611.9 | 613.3     |

Each limit allows the PR's measured size plus the usual 0.2 KB margin.
