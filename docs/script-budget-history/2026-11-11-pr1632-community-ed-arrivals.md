# 11 Nov 2026, community desk ED heads-up (PR #1632, D-154)

Changed on top of `main` at `0b657ad` (just after #1606 merged). Each raise is under 1 KB, well within the per-screen allowance in HOW-WE-WORK section 6:

- Home `/ward-flow`: 587.7 to 588.3
- ED `/ward-flow/ed`: 543.4 to 543.9
- Movement `/ward-flow/movements/WF-001`: 618.7 to 619.0
- Capacity `/ward-flow/capacity`: 665.7 to 665.9
- Bed meeting `/ward-flow/bed-meeting`: 600.1 to 600.7
- Statistics `/ward-flow/statistics`: 640.5 to 641.0
- Referrals, Ward and ED site: unchanged

Hosted CI (job 130831009655) measured, in KB: Home 588.1, Referrals 594.0, ED 543.7, Ward 625.1, Movement 618.8, Capacity 665.7, ED site 676.1, Bed meeting 600.5 and Statistics 640.8. Each changed limit is the measurement plus 0.2.

Why it changed: the scoped workspace builder (`ward-access-scope.ts`), which every screen loads, now builds the community desk's narrow ED list (D-154). So it imports the heads-up list builder and the small episode team list, and the access shell gains one context. That costs about 0.3 to 0.6 KB a screen.

Trim tried: building the list only on the community desk's Home card would keep it off other screens. That would mean the card reads the whole workspace again, which is the exposure D-154 removes. The scoped view has to carry the list, so it is built where the scope is built.
