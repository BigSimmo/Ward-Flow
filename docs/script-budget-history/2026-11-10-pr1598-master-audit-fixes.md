# 10 Nov 2026, master audit non-clinical fixes (PR #1598)

Raised every phone route by 2.0 to 4.5 KB on top of `main` at `f5323252b`. Each is within the 5 KB
per-screen allowance in HOW-WE-WORK section 6.

Measured on hosted CI (merged branch against main alone, KB gzipped): Home 573.4 / 570.1, Referrals
586.9 / 584.3, ED 532.8 / 530.1, Ward 612.0 / 608.9, Movement detail 607.5 / 605.5, Capacity
651.5 / 648.9, ED arm-ed 667.2 / 664.8, Bed meeting 589.1 / 584.6, Statistics 632.1 / 629.5. Each
limit is now the measurement plus 0.2 KB.

Why it grew: shared code every route loads gained the D-129 fixes. The shared client reloads tabs
after a restore, holds and resends saves on a 429, spreads reconnect reads and explains a 413. Toasts
sit above the floating bar, Show me explains when it is offline, and shared views say when a local
setting differs (the last adds most on Bed meeting and the TV tops).

Trim: none made in this PR. The local settings note is the first candidate to load lazily; the budget
trim issue tracks it. Re-measure on hosted CI and set each limit to the measurement plus 0.2 KB if it
reads lower.
