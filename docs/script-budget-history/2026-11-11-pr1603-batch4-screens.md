# 11 Nov 2026, Batch 4 screens (PR #1603, D-142)

Changed on top of the 10 Nov 2026 Batch 4 limits: `/ward-flow` 576.1 to 577.3 (measured 576.9); `/ward-flow/referrals` 584.4 to 585.1 (measured 584.7); `/ward-flow/ward/rph-adult-secure` 614.5 to 617.1 (measured 616.7); `/ward-flow/movements/WF-001` 610.2 to 610.8 (measured 610.4); `/ward-flow/capacity` 655.0 to 655.6 (measured 655.2); `/ward-flow/bed-meeting` 592.3 to 592.9 (measured 592.5); `/ward-flow/statistics` 633.0 to 633.7 (measured 633.3). Each raise is under 3 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured locally (production build of this branch, `node scripts/check-script-budget.mjs`), not on hosted CI. Each limit is the measurement plus 0.4. `/ward-flow/ed` (536.0) and `/ward-flow/ed/arm-ed` (666.8) stayed within their limits and are unchanged.

Why it changed: the Batch 4 screens (D-142). My ward gains the outage pack's printed line in its hero and the "Not confirmed since the outage" bed tags; Home gains the old packs check; the kit's hero band gains a note line and a wrap layout used on every route; the access admin's Features at this site card joins the Access tab.

Trim tried: Home's Catch-up after the outage card was already lazy. My ward's catch-up card now loads the same way (`ward-screen-lazy.tsx`, fetched when the browser is idle), which took `/ward-flow/ward/rph-adult-secure` from 618.6 to 616.7. The bed tags and the pack line render inside the first screen, so lazy loading them would only move the text and add a jump. No other safe trim was found.
