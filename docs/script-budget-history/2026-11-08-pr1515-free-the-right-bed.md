# 8 Nov 2026, coordinator phone tools and Free the right bed (PR #1515)

Raised: Capacity `/ward-flow/capacity`, budget 659.2 to 659.5. Hosted CI measured 659.5 KB on this PR against 658.4 KB for main.

Why it grew: the Capacity pop-up (`capacity-mismatch-popup.tsx`), which loads with the page, now lists the planned discharges that could free a short bed type (`free-the-right-bed.ts`) and shows each time with its day. Josh asked for it on that pop-up (8 Nov 2026), so the code is meant to be on the page. The phone Capacity glance and Call and log are loaded separately (`next/dynamic`) and are not on this page's first load. Trim considered: lazy-loading the pop-up would put a load delay on the page's main tap target to save about 1 KB, so it was not done. The ED detail route (`/ward-flow/ed/arm-ed`) is over on main as well, and the CI judge credits that to main, not this PR, so it is left unchanged here. The raise is within the 5 KB per screen allowance in HOW-WE-WORK section 6.
