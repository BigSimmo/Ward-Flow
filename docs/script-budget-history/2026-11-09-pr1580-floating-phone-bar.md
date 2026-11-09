# 9 Nov 2026, phone floating bar (PR #1580)

Raised ED 519.9 to 520.2, movement 593.0 to 593.5, bed meeting 572.0 to 572.4 and statistics
611.9 to 612.4. Every other route fits its existing limit.

Why: the phone bar's tap-again-for-top (D-112) adds a small click handler to the dock, which every
page loads. That added about 0.2 KB to every route. The bar's new look is CSS, which the budget
does not count. To trim it, the handler was rewritten to compare whole addresses and loop over
one list of scrollers, which saved about 0.1 KB per route. Main itself was already at or just over
three of these limits after #1555 and #1556 (PR #1582 raises them separately).

Measured locally on the merged branch (node 24, same checkout as main's baseline), KB gzipped:

| Route       | Main  | This PR | Old limit | New limit |
| ----------- | ----- | ------- | --------- | --------- |
| ED          | 519.8 | 520.0   | 519.9     | 520.2     |
| movement    | 593.1 | 593.3   | 593.0     | 593.5     |
| bed meeting | 572.0 | 572.2   | 572.0     | 572.4     |
| statistics  | 612.0 | 612.1   | 611.9     | 612.4     |

Each new limit allows the PR's measured size plus the usual 0.2 KB margin. Main's figures match
main's own hosted CI build (run 42654163717).
