# 8 Nov 2026, Referrals Note 11 (PR #1534)

Raised: Referrals `/ward-flow/referrals`, budget 560.0 to 560.6. Hosted CI measured 560.1 KB on this PR against 559.5 KB for main alone. On 9 Nov main had already raised the limit to 560.9 for other work, so the merge sets 561.5 (main's 560.9 plus this PR's 0.6).

Why it grew: the ED review's decision buttons now portal into the drawer foot, and the Offered to wards table gained per-ward answer chips, a header summary (longest wait, declines, chased) and a send time with a comparison bar. Trim made: the old "Awaiting N answers" status helper and its duplicate screen-reader line were removed, since each chip now carries its own answer. The rest is the table's new content and cannot be lazy-loaded away from the page it renders on. The raise is within the 5 KB per screen allowance in HOW-WE-WORK section 6.
