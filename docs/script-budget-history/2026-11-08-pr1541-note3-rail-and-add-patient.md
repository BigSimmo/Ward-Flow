# 8 Nov 2026, Note 3 collapsed sidebar and Add patient (PR #1541)

Raised: ED detail `/ward-flow/ed/arm-ed`, budget 653.3 to 653.6. Hosted CI measured 653.4 KB on this PR, against 653.1 KB for main alone.

Why it grew: about 0.3 KB from the collapsed sidebar's new bed alert (a small occupancy ring and place caption in `next-rail-parts.tsx`), which sits in the shared shell on every route. Trim considered: the ring is a few lines of SVG rendered in the always-visible rail, so lazy loading it would cost more than it saves. The raise is the PR's growth plus about 0.2 KB margin, within the 5 KB per screen allowance in HOW-WE-WORK section 6. `/ward-flow/capacity` is also over, but main alone is already over there, so it is left to the budget-heal issue.
