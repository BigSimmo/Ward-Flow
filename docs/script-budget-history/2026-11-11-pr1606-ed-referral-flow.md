# 11 Nov 2026, ED and referral flow (PR #1606)

Changed on top of `main` at `30abc7a` (after #1603, #1605, #1607, #1609, #1625 and #1628, among others, merged). Each raise is under 5 KB, within the per-screen allowance in HOW-WE-WORK section 6:

- Home `/ward-flow`: 583.5 to 584.5
- Referrals `/ward-flow/referrals`: 589.5 to 594.1
- ED `/ward-flow/ed`: unchanged at 540.6
- Ward `/ward-flow/ward/rph-adult-secure`: unchanged at 621.3
- Movement `/ward-flow/movements/WF-001`: 615.3 to 615.8
- Capacity `/ward-flow/capacity`: unchanged at 661.8
- ED site `/ward-flow/ed/arm-ed`: 673.3 to 674.3
- Bed meeting `/ward-flow/bed-meeting`: unchanged at 598.7
- Statistics `/ward-flow/statistics`: unchanged at 638

Measured locally from a production build of this branch with `main` at `30abc7a` merged in, in KB: Home 584.0, Referrals 593.6, ED 539.8, Ward 620.6, Movement 615.3, Capacity 660.5, ED site 673.8, Bed meeting 597.8, Statistics 637.2. Each changed limit is the measurement plus 0.5, and no limit is set below `main`'s.

Why it changed: Batch 1 (D-133, D-140, D-141) adds three engine events to the shared reducer that every route loads: `RECORD_ESCALATION_CALL`, `RECORD_CREW_TIMES` and `RECORD_ARRIVAL_MODE`, about 0.5 to 1 KB. On top of that:

- Referrals and the movement page gain "Still open", "Not opened yet" and "Copy to notes". Referrals is the largest raise, 4.6 KB over `main`'s limit: it grew from 3.4 KB to 4.6 KB as Batches 3, 4 and 5 merged into `main` ahead of this PR.
- Home gains the crews-waiting line.
- The ED site page carries the crew times and "Brought by" entry points.

Trim tried: building the notes text only after "Copy to notes" is pressed would move about 1 KB off Referrals and the movement page. It was not done, because Safari refuses a clipboard write that follows an awaited import. The crew times, the "Brought by" choice and the escalation call sheet already load only when opened.
