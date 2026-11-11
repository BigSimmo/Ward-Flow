# 11 Nov 2026, ED and referral flow (PR #1606)

Changed on top of `main` at `cc755fa` (after #1605, #1609 and #1625, among others, merged). Each raise is under 5 KB, within the per-screen allowance in HOW-WE-WORK section 6:

- Home `/ward-flow`: 578.2 to 580.3
- Referrals `/ward-flow/referrals`: 586.5 to 589.6
- ED `/ward-flow/ed`: 537.8 to 538.3
- Ward `/ward-flow/ward/rph-adult-secure`: 616.5 to 617.1
- Movement `/ward-flow/movements/WF-001`: 612.6 to 613.8
- Capacity `/ward-flow/capacity`: 657.3 to 657.5
- ED site `/ward-flow/ed/arm-ed`: 668.1 to 672.3
- Bed meeting `/ward-flow/bed-meeting`: 594.8 to 595.1
- Statistics `/ward-flow/statistics`: 635.1 to 635.7

Measured locally from a production build of this branch with `main` at `cc755fa` merged in: Home 579.8 KB, Referrals 589.1, ED 537.8, ward 616.6, movement 613.3, Capacity 657.0, ED site 671.8, bed meeting 594.6, Statistics 635.2. Each limit is the measurement plus 0.5, and no limit is set below `main`'s.

Why it changed: Batch 1 (D-133, D-140, D-141) adds three engine events to the shared reducer that every route loads: `RECORD_ESCALATION_CALL`, `RECORD_CREW_TIMES` and `RECORD_ARRIVAL_MODE`, about 0.5 to 1 KB. On top of that:

- Referrals and the movement page gain "Still open", "Not opened yet" and "Copy to notes".
- Home gains the crews-waiting line.
- The ED site page carries the crew times and "Brought by" entry points. Its rise grew from 1.4 KB to 4.2 KB as main's item 4, 15 and 28 work was merged in.

Trim tried: building the notes text only after "Copy to notes" is pressed would move about 1 KB off Referrals and the movement page. It was not done, because Safari refuses a clipboard write that follows an awaited import. The crew times, the "Brought by" choice and the escalation call sheet already load only when opened.
