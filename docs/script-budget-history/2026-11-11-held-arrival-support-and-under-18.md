# 11 Nov 2026, Held arrival support lines and under 18 notice (items 4 and 15, held PR)

Changed on top of `main` at `8d948c7`. Each raise is under 1 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6:

| Screen                                  | Old   | New   | Raise |
| --------------------------------------- | ----- | ----- | ----- |
| Referrals `/ward-flow/referrals`        | 583.4 | 584.1 | 0.7   |
| ED `/ward-flow/ed`                      | 534.3 | 534.9 | 0.6   |
| Ward `/ward-flow/ward/rph-adult-secure` | 613.0 | 613.9 | 0.9   |
| Movement `/ward-flow/movements/WF-001`  | 608.3 | 609.4 | 1.1   |
| Bed meeting `/ward-flow/bed-meeting`    | 590.4 | 591.5 | 1.1   |

Measured on a local production build of the branch head: referrals 583.7, ED 534.5, ward 613.5, movement 609.0, bed meeting 591.1. Each limit is the measurement plus about 0.4.

Why it changed: item 4 adds the `RECORD_CHIEF_PSYCHIATRIST_NOTIFIED` event, its storage check and history words to the shared engine, and item 15 adds the interpreter, Aboriginal liaison and advocate lines to the arrival checklist.

Trim tried: the new event lives in its own small file and the notice renders only inside the bed drawer. No other safe trim was found.
