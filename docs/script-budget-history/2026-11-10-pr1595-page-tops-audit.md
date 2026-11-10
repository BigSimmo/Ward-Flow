# 10 Nov 2026, Page tops audit fixes (PR #1595)

Changed on top of `main` at `9c06e96`: referrals `/ward-flow/referrals` lowered 583.6 to 579.2; ED `/ward-flow/ed` raised 529.6 to 530.5; movements `/ward-flow/movements/WF-001` raised 605.1 to 605.7; bed meeting `/ward-flow/bed-meeting` raised 584.1 to 585.0. Each raise is under 1 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured on a local production build: referrals 578.6 KB, ED 530.1, movements 605.3, bed meeting 584.6. Local and hosted sizes differ by about 0.2 KB; re-measure on hosted CI and lower if it reads lower.

Why it changed: referrals dropped after unused CSS was removed. The small rises come from shared code every route carries: the clock placeholder in `live.tsx`, tab `aria-controls` and the toggle toolbar in `choice.tsx`, and labelled loading states in `loading-status.tsx`.

Trim tried: the removal of about 274 unused CSS classes offset part of the growth; no further safe trim was found.
