# 9 Nov 2026, Movements Note 7 (PR #1527)

Raised: Referrals `/ward-flow/referrals`, budget 560.0 to 560.4 (hosted CI measured 560.2 KB; main alone 559.9 KB). Movement detail `/ward-flow/movements/WF-001`, budget 588.4 to 588.8 (hosted CI measured 588.6 KB; main alone 587.7 KB).

Why it grew: Josh's Note 7 changes to Movements. The Check in drawer itself is already loaded lazily (`movements-lazy-parts.tsx`); what remains in the shared code is the drawer's open state and wiring in `movements-screen.tsx`, the Check in button replacing the Transport link in `movements-transport-now.tsx`, the rewritten stage strip and its styles. Trim considered: the drawer, the heaviest part, is already split out, and the remaining wiring is not separable from the screen. Both raises are well within the 5 KB per screen allowance in HOW-WE-WORK section 6.
