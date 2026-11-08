# 9 Nov 2026, triage safety plan (PR #1542)

Raised: ward `/ward-flow/ward/rph-adult-secure`, budget 593.8 to 594.3. Hosted CI measured 593.9 KB on this PR and 593.8 KB for main alone, so main sat exactly at the limit.

Why it grew: this PR changes only triage screens. The 0.1 KB is most likely this PR's What's new line, which the build inlines into the shared Help chunks every route loads. This is not proven. Trim made: the What's new line is shortened. Trim considered: nothing else in this PR reaches the ward route. The raise is within the 5 KB per screen allowance in HOW-WE-WORK section 6.
