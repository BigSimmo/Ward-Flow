# 13 Nov 2026, system fixes (PR C, D-190)

Seven limits are raised, on top of `main` at `ea4cd8b57` (after PR #1657):

- Coordinator `/ward-flow`: 585.2 to 588.8
- Referrals `/ward-flow/referrals`: 589.9 to 594.9
- ED `/ward-flow/ed`: 538.5 to 543.5 (needs 545.5; the further 2.0 waits on Josh's yes, because it is over the 5 KB allowance)
- Ward `/ward-flow/ward/rph-adult-secure`: 618.2 to 623.2 (needs 625.4; the further 2.2 waits on Josh's yes)
- Movement `/ward-flow/movements/WF-001`: 616.9 to 621.2
- ED board `/ward-flow/ed/arm-ed`: 677.9 to 680.4
- Statistics `/ward-flow/statistics`: 636.4 to 640.2

Capacity (660.3) and the bed meeting (594.6) end under their limits after the trim and are unchanged.

Measured with a local `next build --webpack` (WARD_GATE_BUILD=1) and `scripts/check-script-budget.mjs` on main plus the PR C tree, before and after the trim in this PR. Each limit is the trimmed figure plus 0.2, except Referrals, held at exactly +5.0.

Why it grew: the script every page shares grew by about 8.6 KB from PR B's head, from real fix code spread thinly: the one staff names list (A16-21), the closed-ward demo choice (A16-17), the seeded pull holds, sample days and working hours, seed growth, the server-away link guard (A4-05), the time-audit fixes (reducer, legal-time words, registration, month names, shared clock and bar) and the "not saved" note that now loads with the first page (A4-02).

What was trimmed first (6 to 20 KB per route): the Ward page no longer pulls the answer view's feedback component; a split chunk shared by Referrals and the ED board no longer carries a second copy of Next's link helpers (two named chunks in `next.config.ts`); the patient and officer screens no longer pull the referral letter builder; the bed meeting, TV and board no longer pull the printed daily sheet or the board's stylesheet map (`board/ward-daily-sheet-model.ts`); the TV lock's stand-in host loads just after the page draws. `tests/ward-page-first-load-imports.test.ts` pins these.

Tried and dropped: packing the error pages' shared helpers and icons (routes grew 1 to 3.5 KB); adding Next's lazy-load helpers to the shared group (copied icons three times). The largest lever left is `tailwind-merge` in the error pages (28 KB raw), too large a change before the demo.
