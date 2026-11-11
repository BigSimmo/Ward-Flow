# 11 Nov 2026, ED and referral flow (PR #1606)

Changed on top of `main` at `30abc7a` (after #1603, #1605, #1607, #1609, #1625 and #1628, among others, merged). Each raise is under 5 KB, within the per-screen allowance in HOW-WE-WORK section 6:

- Home `/ward-flow`: 583.5 to 584.9
- Referrals `/ward-flow/referrals`: 589.5 to 594.5
- ED `/ward-flow/ed`: unchanged at 540.6
- Ward `/ward-flow/ward/rph-adult-secure`: unchanged at 622. `main` raised it from 621.3 to 622 in another PR before `e5a8191` merged in here; this PR does not change it
- Movement `/ward-flow/movements/WF-001`: 615.3 to 616.3
- Capacity `/ward-flow/capacity`: unchanged at 661.8
- ED site `/ward-flow/ed/arm-ed`: 673.3 to 674.5
- Bed meeting `/ward-flow/bed-meeting`: unchanged at 598.7
- Statistics `/ward-flow/statistics`: unchanged at 638

Measured locally from a production build of this branch with `main` at `30abc7a` merged in, in KB: Home 584.0, Referrals 593.6, ED 539.8, Ward 620.6, Movement 615.3, Capacity 660.5, ED site 673.8, Bed meeting 597.8, Statistics 637.2. Each changed limit is the measurement plus 0.5, and no limit is set below `main`'s.

Why it changed: Batch 1 (D-133, D-140, D-141) adds three engine events to the shared reducer that every route loads: `RECORD_ESCALATION_CALL`, `RECORD_CREW_TIMES` and `RECORD_ARRIVAL_MODE`, about 0.5 to 1 KB. On top of that:

- Referrals and the movement page gain "Still open", "Not opened yet" and "Copy to notes". Referrals is the largest raise. It grew from 3.4 KB to 4.6 KB over `main`'s limit as Batches 3, 4 and 5 merged into `main` ahead of this PR.
- Home gains the crews-waiting line.
- The ED site page carries the crew times and "Brought by" entry points.

Trim tried: building the notes text only after "Copy to notes" is pressed would move about 1 KB off Referrals and the movement page. It was not done, because Safari refuses a clipboard write that follows an awaited import. The crew times, the "Brought by" choice and the escalation call sheet already load only when opened.

Later the same day, after the review fixes (817a61b) and merging `main` at `51a4745`, hosted CI (job 130554741936) measured, in KB: Home 584.7, Referrals 594.3, Movement 616.1 and ED site 674.3, against `main` alone at 581.6, 587.6, 613.6 and 669.7. The fixes add the transport job's status line and a copy-failure message to the notes, and a load-failure message to the crew controls. Those four limits are now the measurement plus 0.2. Referrals is now exactly 5 KB over `main`'s limit, the most the per-screen allowance permits, so any further growth on that screen needs a trim or Josh's yes.

After merging `main` at `024f903` (which brings #1631's Home layout-shift fix), hosted CI (job 130748219734) measured Home at 585.2 KB against its 584.9 limit. Every other screen stayed inside its limit. Home's limit is now 585.4, the measurement plus 0.2 and 1.9 KB over `main`'s 583.5.

After merging `main` at `205b637` (#1622, #1630), hosted CI (job 130768853350) measured Statistics just over its 638 limit (shown as 638.0 KB). `main` alone could not be built for comparison. Statistics' limit is now 638.2, 0.2 KB over `main`'s. Every other screen stayed inside its limit.

After merging `main` at `0e24781` (#1608, which raised every limit for the ward arrival batch), each limit is `main`'s new limit plus this PR's own raise above the old `main`, in KB: Home 587.9 (+1.9 over `main`'s 586.0), Referrals 598.4 (+5.0 over 593.4), Movement 618.9 (+1.0 over 617.9), ED site 679.3 (+1.2 over 678.1) and Statistics 640.5 (+0.2 over 640.3). ED, Ward, Capacity and Bed meeting take `main`'s limits unchanged. Hosted CI's measurement will show whether any can come down.
