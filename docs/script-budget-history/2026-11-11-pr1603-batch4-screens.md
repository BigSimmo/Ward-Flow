# 11 Nov 2026, Batch 4 screens (PR #1603, D-142)

Limits now, against main's limits at 5b08a5e (each set to the hosted CI measurement plus 0.5):

| Route                              | Main limit | CI measured | New limit | Raise |
| ---------------------------------- | ---------- | ----------- | --------- | ----- |
| `/ward-flow`                       | 575.4      | 577.9       | 578.4     | 3.0   |
| `/ward-flow/referrals`             | 583.6      | 585.7       | 586.2     | 2.6   |
| `/ward-flow/ed`                    | 535.4      | 537.0       | 537.5     | 2.1   |
| `/ward-flow/ward/rph-adult-secure` | 613.8      | 617.8       | 618.3     | 4.5   |
| `/ward-flow/movements/WF-001`      | 609.8      | 611.5       | 612.0     | 2.2   |
| `/ward-flow/capacity`              | 654.3      | 656.3       | 656.8     | 2.5   |
| `/ward-flow/ed/arm-ed`             | 667.4      | 667.9       | 668.4     | 1.0   |
| `/ward-flow/bed-meeting`           | 592.2      | 593.9       | 594.4     | 2.2   |
| `/ward-flow/statistics`            | 632.6      | 634.4       | 634.9     | 2.3   |

These figures come from the hosted "Ward Flow production build" check on 86d32f4, which reported main alone at 575.2, 583.5, 535.2, 613.6, 609.3, 654.1, 664.3, 591.7 and 632.2. That puts this PR's growth at about 1.7 to 4.2 KB per route. Every raise is under the 5 KB per-screen allowance in HOW-WE-WORK section 6. The 10 Nov file covers the first part of this PR (the events alone).

Why it changed: the Batch 4 screens (D-142).

- My ward gains the outage pack's printed line in its hero and the "Not confirmed since the outage" bed tags.
- Home gains the old packs check.
- The kit's hero band gains a note line and a wrap layout, which every route uses.
- The access admin's "Features at this site" card joins the Access tab.
- The site switch sync is mounted in the ward-flow layout.

Trim tried: Home's "Catch-up after the outage" card was already lazy. My ward's catch-up card now loads the same way (`ward-screen-lazy.tsx`, fetched when the browser is idle), which cut about 1.9 KB from the ward route locally. The bed tags and the pack line render inside the first screen, so lazy loading them would only move the text and add a jump.

Later the same day (PR head `7250033`, merged with main `35c7ccd`): hosted CI measured ED `/ward-flow/ed/arm-ed` at 671.7 KB against the 668.4 limit, after main's shared long-wait and named-bed fixes (PR #1621) also landed on this route. Main's own build could not be measured in that run. New limits over main: Home 578.7 (+3.0), referrals 586.5 (+2.6), ED 537.8 (+2.1), ward 618.6 (+4.5), capacity 657.2 (+2.5), arm-ed 672.2 (+4.8). Each stays inside the 5 KB per-screen allowance. Same trim reasoning as above.
