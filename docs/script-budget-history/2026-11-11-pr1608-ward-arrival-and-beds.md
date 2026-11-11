# 11 Nov 2026, Ward arrival and beds batch (PR #1608)

Changed on top of `main` at `5b08a5e`. Each raise is under 5 KB, within the per-screen allowance in HOW-WE-WORK section 6:

| Screen                                  | Old   | New   | Raise |
| --------------------------------------- | ----- | ----- | ----- |
| Home `/ward-flow`                       | 575.4 | 577.9 | 2.5   |
| Referrals `/ward-flow/referrals`        | 583.6 | 586.3 | 2.7   |
| ED `/ward-flow/ed`                      | 535.4 | 537.6 | 2.2   |
| Ward `/ward-flow/ward/rph-adult-secure` | 613.8 | 617.2 | 3.4   |
| Movement `/ward-flow/movements/WF-001`  | 609.8 | 612.4 | 2.6   |
| Capacity `/ward-flow/capacity`          | 654.3 | 658.2 | 3.9   |
| ED desk `/ward-flow/ed/arm-ed`          | 667.4 | 672.2 | 4.8   |
| Bed meeting `/ward-flow/bed-meeting`    | 592.2 | 593.0 | 0.8   |
| Statistics `/ward-flow/statistics`      | 632.6 | 634.9 | 2.3   |

Measured by hosted CI on the PR head after merging `main` at `5b08a5e`: home 577.5, referrals 585.9, ed 537.2, ward 616.8, movement 612.0, capacity 657.8, ed desk 671.8, bed meeting 592.6, statistics 634.5. Each limit is the measurement plus 0.4.

Why it changed: items 6, 7, 13 and 18 add two events (`SET_INTAKE_WINDOW`, `MARK_TRANSPORT_COLLECTED`), the bed closure review time and the transport wait to the shared engine, storage checks and history words that every screen loads (about 1.5 to 2 KB). Capacity also carries the two new cards, and the ward screen the intake line and arrival staffing note.

Trim tried: the ward hero's intake hours editor now loads as its own chunk when Edit is first pressed (`ward-intake-window-dialog.tsx`), which took the ward screen from 618.5 to 615.7 KB. The engine additions are the smallest that record and check the new facts. No other safe trim was found.

After merging `main` at `35c7ccd`, which raised five of these screens by 0.3 to 0.4 KB, each limit is main's new limit plus this PR's same raise. No raise grew.
