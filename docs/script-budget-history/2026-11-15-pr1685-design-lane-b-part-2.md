# 15 November 2026, PR #1685 (design lane B part 2)

Measured by the local production build of the PR head (`scripts/check-script-budget.mjs`). Each new
limit is the measurement plus 0.3.

Raised (from main after #1679 and the other 15 November merges): Coordinator `/ward-flow` 607.3 to
608.4 (measured 608.1), Referrals 605.6 to 605.9 (605.6), ED 558.3 to 559.5 (559.2), Ward 647.0 to
648.1 (647.8), Movement 639.0 to 640.0 (639.7), ED board 698.8 to 699.9 (699.6), Bed meeting 607.6
to 608.2 (607.9), Statistics 654.3 to 655.7 (655.4).

Why: Home's act-now count and the timed reminder rows (a 4 hour no-reply reminder and a 24 hour
leave bed prompt) are worked out with the task list in the shared shell, so every route carries
them, and the rail's Board time card now shows the shift and time to handover.

What was tried first: the reminder rows use the existing inbox and signed times rather than a second
list, and the overdue rule is shared with the referral list instead of copied.
