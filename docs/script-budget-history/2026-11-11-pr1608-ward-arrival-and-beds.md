# 11 Nov 2026, Ward arrival and beds batch (PR #1608)

Changed on top of `main` at `8d948c7`. Each raise is under 5 KB, within the per-screen allowance in HOW-WE-WORK section 6:

| Screen                                  | Old   | New   | Raise |
| --------------------------------------- | ----- | ----- | ----- |
| Home `/ward-flow`                       | 574.7 | 576.9 | 2.2   |
| Referrals `/ward-flow/referrals`        | 583.4 | 585.3 | 1.9   |
| ED `/ward-flow/ed`                      | 534.3 | 536.6 | 2.3   |
| Ward `/ward-flow/ward/rph-adult-secure` | 613.0 | 616.1 | 3.1   |
| Movement `/ward-flow/movements/WF-001`  | 608.3 | 611.3 | 3.0   |
| Capacity `/ward-flow/capacity`          | 653.3 | 657.1 | 3.8   |
| ED desk `/ward-flow/ed/arm-ed`          | 667.4 | 671.2 | 3.8   |
| Bed meeting `/ward-flow/bed-meeting`    | 590.4 | 591.6 | 1.2   |
| Statistics `/ward-flow/statistics`      | 632.6 | 633.8 | 1.2   |

Measured on a local production build of the PR head with the change below (hosted CI matched the earlier head to within 0.1 KB): Home 576.5, referrals 584.9, ED 536.1, ward 615.7, movement 610.9, capacity 656.7, ED desk 670.7, bed meeting 591.2, statistics 633.4. Each limit is the measurement plus about 0.4.

Why it changed: items 6, 7, 13 and 18 add two events (`SET_INTAKE_WINDOW`, `MARK_TRANSPORT_COLLECTED`), the bed closure review time and the transport wait to the shared engine, storage checks and history words that every screen loads (about 1.5 to 2 KB). Capacity also carries the two new cards, and the ward screen the intake line and arrival staffing note.

Trim tried: the ward hero's intake hours editor now loads as its own chunk when Edit is first pressed (`ward-intake-window-dialog.tsx`), which took the ward screen from 618.5 to 615.7 KB. The engine additions are the smallest that record and check the new facts. No other safe trim was found.
