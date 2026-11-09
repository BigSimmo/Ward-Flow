# 9 Nov 2026, staff and handover tools (PR #1562)

Raised movement 592.7 to 593.0 (0.3 KB). Every other route fits its existing limit.

Why: the staff request events (feature 10) join the shared engine every page loads (reducer case,
event roles, storage schema and history wording), and the rail's handover card now offers the
Shift digest. That added about 1.8 KB to every route. To trim it, the alert notifier, which
renders nothing, now loads when the browser is idle instead of on first load
(`shell/ward-act-now-notifier-lazy.tsx`). That saved about 1.6 KB per route.

Measured in hosted CI on `9d2f7c6c`, KB gzipped:

| Route       | This PR | Limit | New limit |
| ----------- | ------- | ----- | --------- |
| ED          | 519.5   | 519.9 | 519.9     |
| ward        | 597.9   | 599.0 | 599.0     |
| movement    | 592.8   | 592.7 | 593.0     |
| bed meeting | 571.8   | 572.0 | 572.0     |
| statistics  | 611.7   | 611.9 | 611.9     |

The movement limit allows the PR's measured size plus the usual 0.2 KB margin.
