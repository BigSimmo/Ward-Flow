# 11 Nov 2026, Ward arrival and beds batch (PR #1608)

Changed on top of `main` at `5b08a5e`. Each raise is under 5 KB, within the per-screen allowance in HOW-WE-WORK section 6:

| Screen                                  | Old   | New   | Raise |
| --------------------------------------- | ----- | ----- | ----- |
| Home `/ward-flow`                       | 575.4 | 577.6 | 2.2   |
| Referrals `/ward-flow/referrals`        | 583.6 | 585.5 | 1.9   |
| ED `/ward-flow/ed`                      | 535.4 | 537.7 | 2.3   |
| Ward `/ward-flow/ward/rph-adult-secure` | 613.8 | 616.9 | 3.1   |
| Movement `/ward-flow/movements/WF-001`  | 609.8 | 612.8 | 3.0   |
| Capacity `/ward-flow/capacity`          | 654.3 | 658.1 | 3.8   |
| ED desk `/ward-flow/ed/arm-ed`          | 667.4 | 671.2 | 3.8   |
| Bed meeting `/ward-flow/bed-meeting`    | 592.2 | 593.4 | 1.2   |
| Statistics `/ward-flow/statistics`      | 632.6 | 633.8 | 1.2   |

Measured on a local production build of the PR head with the change below (hosted CI matched the earlier head to within 0.1 KB): Home 576.5, referrals 584.9, ED 536.1, ward 615.7, movement 610.9, capacity 656.7, ED desk 670.7, bed meeting 591.2, statistics 633.4. Each limit is the measurement plus about 0.4. After merging `main` at `5b08a5e`, each limit is main's new limit plus the same raise, since main's own raises cover its growth.

Why it changed: items 6, 7, 13 and 18 add two events (`SET_INTAKE_WINDOW`, `MARK_TRANSPORT_COLLECTED`), the bed closure review time and the transport wait to the shared engine, storage checks and history words that every screen loads (about 1.5 to 2 KB). Capacity also carries the two new cards, and the ward screen the intake line and arrival staffing note.

Trim tried: the ward hero's intake hours editor now loads as its own chunk when Edit is first pressed (`ward-intake-window-dialog.tsx`), which took the ward screen from 618.5 to 615.7 KB. The engine additions are the smallest that record and check the new facts. No other safe trim was found.
