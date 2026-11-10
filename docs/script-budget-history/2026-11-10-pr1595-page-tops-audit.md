# 10 Nov 2026, Page tops audit fixes (PR #1595)

Changed on top of `main` at `c2fdee9` merged in (after #1596): referrals `/ward-flow/referrals` lowered 583.8 to 579.2; ED `/ward-flow/ed` raised 529.8 to 530.9; movements `/ward-flow/movements/WF-001` raised 605.3 to 605.7; bed meeting `/ward-flow/bed-meeting` raised 584.5 to 585.0. Each raise is under 1.2 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured on a local production build of the merge commit: referrals 578.8 KB, ED 530.5, movements 605.3, bed meeting 584.6. Local and hosted sizes differ by about 0.2 KB, so each limit is the measurement plus about 0.4. Re-measure on hosted CI and lower if it reads lower.

Why it changed: referrals dropped after unused CSS was removed. The small rises come from shared code every route carries: the clock placeholder in `live.tsx`, tab `aria-controls` and the toggle toolbar in `choice.tsx`, and labelled loading states in `loading-status.tsx`.

Trim tried: the removal of about 274 unused CSS classes offset part of the growth; no further safe trim was found.
