# 9 Nov 2026, staff and handover tools (PR #1562)

Raised ED 519.9 to 521.0 (1.1 KB), ward 599.0 to 600.5 (1.5 KB), movement 592.7 to 594.5 (1.8 KB),
bed meeting 572.0 to 573.0 (1.0 KB) and statistics 611.9 to 613.0 (1.1 KB).

Why: the staff request events (feature 10) join the shared engine every page loads (reducer case,
event roles, storage schema and history wording), and the rail's handover card now offers the
Shift digest. That added about 1.8 KB to every route. To trim it, the alert notifier, which
renders nothing, now loads when the browser is idle instead of on first load
(`shell/ward-act-now-notifier-lazy.tsx`). That saved about 1.6 KB per route. The ward page also
carries the Staff needed and Contact buttons.

Measured in hosted CI on `7e747afc` against `main` `8f854538`, KB gzipped:

| Route       | Main  | This PR | Old limit | New limit |
| ----------- | ----- | ------- | --------- | --------- |
| ED          | 518.6 | 519.5   | 519.9     | 521.0     |
| ward        | 595.1 | 597.9   | 599.0     | 600.5     |
| movement    | 591.0 | 592.8   | 592.7     | 594.5     |
| bed meeting | 571.0 | 571.7   | 572.0     | 573.0     |
| statistics  | 610.8 | 611.7   | 611.9     | 613.0     |

Each new limit leaves about 1 to 2 KB for this PR's review fixes and later merges.
