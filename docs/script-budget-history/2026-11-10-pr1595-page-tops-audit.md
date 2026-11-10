# 10 Nov 2026, Page tops audit fixes (PR #1595)

Changed on top of `main` at `f532325` merged in (after #1593 and #1596): referrals `/ward-flow/referrals` lowered 584.2 to 579.8; ED `/ward-flow/ed` raised 530.2 to 531.5; movements `/ward-flow/movements/WF-001` raised 605.6 to 606.2; bed meeting `/ward-flow/bed-meeting` raised 584.8 to 585.5. Each raise is under 1.5 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6.

Measured on a local production build of the merge commit: referrals 579.4 KB, ED 531.1, movements 605.8, bed meeting 585.1. Local and hosted sizes differ by about 0.2 KB, so each limit is the measurement plus about 0.4. Re-measure on hosted CI and lower if it reads lower.

Why it changed: referrals dropped after unused CSS was removed. The small rises come from shared code every route carries: the clock placeholder in `live.tsx`, tab `aria-controls` and the toggle toolbar in `choice.tsx`, labelled loading states in `loading-status.tsx`, and the tour's handling of phone wrappers in `ward-spotlight.ts`.

Trim tried: the removal of about 274 unused CSS classes offset part of the growth; no further safe trim was found.
