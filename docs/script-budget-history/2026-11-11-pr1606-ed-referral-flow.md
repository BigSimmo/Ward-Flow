# 11 Nov 2026, ED and referral flow (PR #1606)

Changed on top of `main` at `8d948c7`. Each raise is under 5 KB, within the per-screen allowance in HOW-WE-WORK section 6:

- Home `/ward-flow`: 574.7 to 577.1
- Referrals `/ward-flow/referrals`: 583.4 to 586.5
- ED `/ward-flow/ed`: 534.3 to 535.6
- Ward `/ward-flow/ward/rph-adult-secure`: 613.0 to 613.9
- Movement `/ward-flow/movements/WF-001`: 608.6 to 610.9
- Capacity `/ward-flow/capacity`: 653.3 to 654.3
- ED site `/ward-flow/ed/arm-ed`: 667.4 to 668.0
- Bed meeting `/ward-flow/bed-meeting`: 590.7 to 592.0

Measured locally from a production build of `f66eb99`: Home 576.6 KB, Referrals 586.0, ED 535.1, ward 613.4, movement 610.1, Capacity 653.8, ED site 667.5, bed meeting 591.2. Each limit is the measurement plus 0.5. That margin covers the seed-only commit that followed. After main merged in #1604 (which raised the movement and bed meeting limits by 0.3), those two limits keep the same 0.5 margin on top of that growth.

Why it changed: Batch 1 (D-133, D-140, D-141) adds three engine events to the shared reducer that every route loads: `RECORD_ESCALATION_CALL`, `RECORD_CREW_TIMES` and `RECORD_ARRIVAL_MODE`, about 0.5 to 1 KB. On top of that:

- Referrals and the movement page gain "Still open", "Not opened yet" and "Copy to notes".
- Home gains the crews-waiting line.

Trim tried: building the notes text only after "Copy to notes" is pressed would move about 1 KB off Referrals and the movement page. It was not done, because Safari refuses a clipboard write that follows an awaited import. The crew times, the "Brought by" choice and the escalation call sheet already load only when opened.
