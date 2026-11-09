# 9 Nov 2026, triage safety plan (PR #1542)

Raised: ward `/ward-flow/ward/rph-adult-secure`, budget 593.8 to 594.3. Hosted CI measured 593.9 KB on this PR and 593.8 KB for main alone, so main sat exactly at the limit.

Why it grew: this PR changes only triage screens. The 0.1 KB is most likely this PR's What's new line, which the build inlines into the shared Help chunks every route loads. This is not proven. Trim made: the What's new line is shortened. Trim considered: nothing else in this PR reaches the ward route. The raise is within the 5 KB per screen allowance in HOW-WE-WORK section 6.

Later the same day, after main moved on: hosted CI measured referrals at 560.1 KB (main alone 559.9) and movements `/ward-flow/movements/WF-001` at 588.5 KB (main alone 587.7). Raised referrals 560.0 to 560.5 and movements 588.4 to 589.0. As above, the likely cause is this PR's shared Help and What's new text plus the safety plan drawer's leave warning reaching shared chunks; not proven. Both raises are within the 5 KB per screen allowance.
