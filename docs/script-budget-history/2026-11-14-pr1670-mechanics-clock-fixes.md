# 14 Nov 2026, mechanics and clock audit fixes (PR #1670, D-210)

Measured with a local `npm run build` and `scripts/check-script-budget.mjs`, and matched within
0.1 by CI's build of the same head. Each new limit is the measurement plus 0.2, capped at the 5 KB
allowance.

Raised:

- Referrals 599.3 to 601.1 (measured 600.9), ED 549.9 to 554.6 (554.4), ED board 688.7 to 693.3
  (693.1), Bed meeting 599.7 to 603.9 (603.7), Statistics 645.5 to 650.5 (650.3).
- Movement 627.5 to 632.5 (measured 632.4 to 632.5): the full 5 KB allowance, with no margin.
- Coordinator `/ward-flow` 597.2 to 602.6 (measured 602.4) and Ward 632.2 to 637.7 (637.4 to
  637.5): past the 5 KB allowance, with Josh's yes on a decision card (14 Nov 2026, 04:33 UTC,
  recorded in D-210).

Why: almost all of the growth is in the shared shell every screen loads (500.2 KB), because the
fixes live in the board's engine, which runs in the browser. New engine modules in the shell, by the
analyser: one rule for bed numbers and locked or open bed type (`ward-bed-numbers.ts`, 1.2 KB
gzipped, H10), the held-bed-elsewhere flag (0.6, M11), one Ready-bed count (0.4, M7), calendar days
that move with a sample day (0.5) and the admitted-legal rule (0.2, M1), plus the edits to the
reducer, eligibility, referrals, inbox and act-now rules.

What was tried first: the analyser showed no page-only code pulled into the shell by this PR; every
new shell module is read by the reducer or by stored-state checks at load, so none can load later.
Shrinking them would mean rewriting engine rules this PR has just fixed. Six internal helpers were
made private, which changes nothing in the build.

## After merging main with #1668 (14 Nov 2026)

#1668 merged first and raised Home, Ward, Movement and Statistics by 0.3 to 0.5 KB on main. Re-measured
on the merged tree (local `npm run build`, `scripts/check-script-budget.mjs`); the shared shell is
500.5 KB. Each limit is the measurement plus 0.2 where that stays within the allowance over main's
limit, else the allowance itself:

- Home 597.7 to 602.9 (measured 602.7) and Ward 632.6 to 638.0 (637.8): within the 5.5 KB Josh
  approved.
- Referrals 599.3 to 601.4 (601.2), ED 549.9 to 554.9 (554.7), ED board 688.7 to 693.7 (693.6),
  Bed meeting 599.7 to 604.2 (604.0), Statistics 645.9 to 650.8 (650.6).
- Movement 627.8 to 632.8 (measured 632.8, a few hundredths over): the full 5 KB allowance. It
  needs 0.1 KB more, which waits for Josh's yes.
