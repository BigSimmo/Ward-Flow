# 11 Nov 2026, ED and referral flow (PR #1606)

Changed on top of `main` at `5b08a5e` (after #1599, #1601, #1604 and #1610 merged). Each raise is under 5 KB, within the per-screen allowance in HOW-WE-WORK section 6:

- Home `/ward-flow`: 575.4 to 578.2
- Referrals `/ward-flow/referrals`: 583.6 to 587.5
- ED `/ward-flow/ed`: 535.4 to 536.6
- Ward `/ward-flow/ward/rph-adult-secure`: 613.8 to 614.9
- Movement `/ward-flow/movements/WF-001`: 609.8 to 611.6
- Capacity `/ward-flow/capacity`: 654.3 to 655.4
- ED site `/ward-flow/ed/arm-ed`: 667.4 to 668.8
- Bed meeting `/ward-flow/bed-meeting`: 592.2 to 593.0
- Statistics `/ward-flow/statistics`: 632.6 to 633.6

Measured locally from a production build of this branch with `main` at `5b08a5e` merged in: Home 577.7 KB, Referrals 587.0, ED 536.1, ward 614.4, movement 611.1, Capacity 654.9, ED site 668.3, bed meeting 592.5, Statistics 633.1. Each limit is the measurement plus 0.5.

Why it changed: Batch 1 (D-133, D-140, D-141) adds three engine events to the shared reducer that every route loads: `RECORD_ESCALATION_CALL`, `RECORD_CREW_TIMES` and `RECORD_ARRIVAL_MODE`, about 0.5 to 1 KB. On top of that:

- Referrals and the movement page gain "Still open", "Not opened yet" and "Copy to notes".
- Home gains the crews-waiting line.

Trim tried: building the notes text only after "Copy to notes" is pressed would move about 1 KB off Referrals and the movement page. It was not done, because Safari refuses a clipboard write that follows an awaited import. The crew times, the "Brought by" choice and the escalation call sheet already load only when opened.
