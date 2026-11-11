# 11 Nov 2026, ED and referral flow (PR #1606)

Changed on top of `main` at `f0db2be` (after #1599, #1601, #1604, #1609, #1610, #1612 and #1614 merged). Each raise is under 5 KB, within the per-screen allowance in HOW-WE-WORK section 6:

- Home `/ward-flow`: 576.9 to 579.0
- Referrals `/ward-flow/referrals`: 585.1 to 588.4
- ED `/ward-flow/ed`: 536.3 to 537.0
- Ward `/ward-flow/ward/rph-adult-secure`: 615.0 to 615.8
- Movement `/ward-flow/movements/WF-001`: 610.9 to 612.5
- Capacity `/ward-flow/capacity`: 655.9 to 656.2
- ED site `/ward-flow/ed/arm-ed`: 667.6 to 671.0
- Bed meeting `/ward-flow/bed-meeting`: 593.3 to 593.9
- Statistics `/ward-flow/statistics`: 633.6 to 634.4

Measured locally from a production build of this branch with `main` at `f0db2be` merged in: Home 578.5 KB, Referrals 587.9, ED 536.5, ward 615.3, movement 612.0, Capacity 655.7, ED site 670.5, bed meeting 593.4, Statistics 633.9. Each limit is the measurement plus 0.5.

Why it changed: Batch 1 (D-133, D-140, D-141) adds three engine events to the shared reducer that every route loads: `RECORD_ESCALATION_CALL`, `RECORD_CREW_TIMES` and `RECORD_ARRIVAL_MODE`, about 0.5 to 1 KB. On top of that:

- Referrals and the movement page gain "Still open", "Not opened yet" and "Copy to notes".
- Home gains the crews-waiting line.
- The ED site page carries the crew times and "Brought by" entry points. Its rise grew from 1.4 to 3.4 KB once main's item 4 and 15 work (#1609) was merged in.

Trim tried: building the notes text only after "Copy to notes" is pressed would move about 1 KB off Referrals and the movement page. It was not done, because Safari refuses a clipboard write that follows an awaited import. The crew times, the "Brought by" choice and the escalation call sheet already load only when opened.
