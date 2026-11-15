# 15 November 2026, PR #1685 (design lane B part 2)

Measured by the local production build of the PR head (`scripts/check-script-budget.mjs`). Each new
limit is the measurement plus 0.3.

Raised: Coordinator `/ward-flow` 605.7 to 607.3 (measured 607.0), Referrals 604.4 to 605.1 (604.8),
ED 558.1 to 559.0 (558.7), Ward 642.2 to 643.7 (643.4), Movement 637.5 to 639.1 (638.8), ED board
697.3 to 698.3 (698.0), Bed meeting 606.8 to 607.7 (607.4), Statistics 654.2 to 655.3 (655.0).

Why: Home's act-now count and the timed reminder rows (a 4 hour no-reply reminder and a 24 hour
leave bed prompt) are worked out with the task list in the shared shell, so every route carries
them, and the rail's Board time card now shows the shift and time to handover.

What was tried first: the reminder rows use the existing inbox and signed times rather than a second
list, and the overdue rule is shared with the referral list instead of copied.
