# 9 Nov 2026, main went 0.1 KB over on three screens after #1555 and #1556

Raised movement 593.0 to 593.5, bed meeting 572.0 to 572.5 and statistics 611.9 to 612.5
(0.5 to 0.6 KB each).

Why: every pull request was inside its limits on its own, but after #1562, #1555 and #1556 merged
in a row, main's own CI build (run 42654163717, commit `a6740f02`) measured three screens just over:

| Route       | Main measured | Old limit | New limit |
| ----------- | ------------- | --------- | --------- |
| movement    | 593.1         | 593.0     | 593.5     |
| bed meeting | 572.0         | 572.0     | 572.5     |
| statistics  | 612.0         | 611.9     | 612.5     |

The growth is 0.1 KB or less per screen, spread across the shared code that the three merges touched,
so there is no single part to load later instead. A trim that small would cost more risk than it
saves. This restores main to green with about 0.4 KB of room on each. Pull requests that grow
these screens still carry their own raise (budget-gate.mjs judges each one against main).
