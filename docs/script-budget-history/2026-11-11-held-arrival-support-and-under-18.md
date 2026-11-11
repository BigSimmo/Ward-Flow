# 11 Nov 2026, Held arrival support lines and under 18 notice (items 4 and 15, held PR)

Changed on top of `main` at `5b08a5e`. Each raise is under 1 KB, within the 5 KB per-screen allowance in HOW-WE-WORK section 6:

| Screen                                  | Old   | New   | Raise |
| --------------------------------------- | ----- | ----- | ----- |
| Referrals `/ward-flow/referrals`        | 583.6 | 584.3 | 0.7   |
| ED `/ward-flow/ed`                      | 535.4 | 536.0 | 0.6   |
| Ward `/ward-flow/ward/rph-adult-secure` | 613.8 | 614.7 | 0.9   |
| Movement `/ward-flow/movements/WF-001`  | 609.8 | 610.9 | 1.1   |
| Bed meeting `/ward-flow/bed-meeting`    | 592.2 | 593.3 | 1.1   |

Measured on a local production build before merging `main`: referrals 583.7, ED 534.5, ward 613.5, movement 609.0, bed meeting 591.1, and each limit was then the measurement plus about 0.4. After merging `main` at `5b08a5e`, each limit is main's new limit plus the same raise, so it sits 0.6 to 2.2 KB above those older measurements. Hosted CI's build after the merge is the measurement that counts.

Why it changed: item 4 adds the `RECORD_CHIEF_PSYCHIATRIST_NOTIFIED` event, its storage check and history words to the shared engine, and item 15 adds the interpreter, Aboriginal liaison and advocate lines to the arrival checklist.

Trim tried: the new event lives in its own small file and the notice renders only inside the bed drawer. No other safe trim was found.
