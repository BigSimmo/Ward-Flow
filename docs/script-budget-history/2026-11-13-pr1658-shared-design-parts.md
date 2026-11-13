# 13 Nov 2026, shared design parts (PR E, D-192)

Every limit is raised, on top of `main` at `ea4cd8b` (after PR #1657 merged), each by less than the 5 KB a PR may add:

- Home `/ward-flow`: 585.2 to 586.6 (+1.4)
- Referrals `/ward-flow/referrals`: 589.9 to 591.9 (+2.0)
- ED `/ward-flow/ed`: 538.5 to 540.1 (+1.6)
- Ward `/ward-flow/ward/rph-adult-secure`: 618.2 to 621.6 (+3.4)
- Movement `/ward-flow/movements/WF-001`: 616.9 to 618.5 (+1.6)
- Capacity `/ward-flow/capacity`: 662.4 to 666.0 (+3.6)
- ED site `/ward-flow/ed/arm-ed`: 677.9 to 682.2 (+4.3). Raised 0.3 KB more on 13 Nov 16:40Z: the coverage-gap fixes (Appearance radios, demo confirm hold, timeline reasons) measured just over 681.9 KB in CI.
- Bed meeting `/ward-flow/bed-meeting`: 596.3 to 599.0 (+2.7)
- Statistics `/ward-flow/statistics`: 636.4 to 639.1 (+2.7)

After merging `main` at `ea4cd8b`, measured in KB: Home 586.4, Referrals 591.7, ED 539.9, Ward 621.4, Movement 618.3, Capacity 665.8, ED site 681.7, Bed meeting 598.8 and Statistics 638.9; each limit is the measurement plus 0.2. The figures below are the first measurement, on top of `92630b1`.

Measured with a local `next build --webpack` and `scripts/check-script-budget.mjs`. In KB: Home 583.5, Referrals 588.0, ED 538.1, Ward 618.3, Movement 615.3, Capacity 663.5, ED site 678.1, Bed meeting 596.5 and Statistics 636.4. The shared shell every route loads is 483.2 KB. Each limit is the measurement plus 0.2.

Why it grew: the shared kit parts every screen uses carry the D-192 behaviour. Compared module by module with a bundle-analyser build of `main`: the Field's row layout and its control error line (`form.tsx`, 1.7 KB raw, on screens with a form), the date box's own error words (`date-field.tsx`, 1.2 KB raw, Capacity), the Live chip publishing its pause to the Demo panel (`live.tsx`, 0.6 KB raw), a box opening on its heading instead of a drop-down (`use-modal-focus.ts`, 0.5 KB raw), count time windows (`primitives.tsx` and `choice.tsx`, 1 KB raw), the touch reason under a disabled button (`button.tsx`, 0.4 KB raw), Undo until a clock time (`toast.tsx` and `toast-timing.ts`, 0.5 KB raw), the stack keeping a re-registered layer in its place (`sheet-focus.ts`, 0.2 KB raw) and the Viewing as gate in the app frame (0.3 KB raw; the bar itself loads only when a role demo starts).

What was trimmed first, about 0.6 to 0.9 KB on every route: the loading placeholder's grey rows are drawn by the server and passed into the client shape, so the boundary that loads on every navigation no longer carries them; the dialog-only scroll body hook has its own file, so every hero and phone figure strip stopped carrying it; and the See it as session store has its own file, so the app frame's Viewing as gate no longer loads the role switching code.

Second step, same PR: the fixes that make the built screens match the approved pictures (count and window on one line, the not-yet reason drawn on the patient card, the synthetic tag placed by width on the full-screen timeline) added 0.5 to 1.0 KB on three routes. Measured: Referrals 589.0, Ward 619.0, ED site 678.8; each limit is the measurement plus 0.2. Every rise stays within 5 KB of `main`.

## After PR C (#1660) merged

PR C set every limit afresh, so E's limits are set again on top of PR C's (the C-only build measured, in KB: Home 588.1, Referrals 595.3, ED 545.5, Ward 624.8, Movement 621.1, Capacity 660.3, ED site 680.3, Bed meeting 594.8 and Statistics 640.1). Each limit is E on C measured plus 0.2:

- Home `/ward-flow`: 589.1 to 590.6 (+1.5)
- Referrals `/ward-flow/referrals`: 595.3 to 598.3 (+3.0)
- ED `/ward-flow/ed`: 545.8 to 548.5 (+2.7)
- Ward `/ward-flow/ward/rph-adult-secure`: 625.6 to 627.0 (+1.4)
- Movement `/ward-flow/movements/WF-001`: 621.5 to 625.0 (+3.5)
- Capacity `/ward-flow/capacity`: 662.4 to 664.0 (+1.6)
- ED site `/ward-flow/ed/arm-ed`: 680.6 to 686.3 (+5.7)
- Bed meeting `/ward-flow/bed-meeting`: 596.3 to 598.0 (+1.7)
- Statistics `/ward-flow/statistics`: 640.6 to 646.2 (+5.6)

The ED site page and Statistics rise more than 5 KB over PR C's limits. Josh approved that for this PR once a trim had been tried ("Go ahead with all recommendations", D-202, 14 November 2026). The trim was tried first: a module-by-module comparison of the C-only and E-on-C builds found no dead code and nothing that loads before it is needed. The growth is the D-192 behaviour listed above, plus the parts that PR C's screens now carry: on the ED site page, the full-screen frame and synthetic-data mark on the enlarged ED board (about 1.3 KB), and the Sheet's scroll body staying reachable by keyboard (about 0.5 KB). Statistics also loads the Field and date box changes. The one unused option (`Field`'s `reserveLine`) stays, because it is a tested part of spec items 10 and 17.

Measured with a local cloud `next build --webpack` and `scripts/check-script-budget.mjs`; CI may differ by a few tenths.

### Set from CI after the merge (13 Nov 19:09Z)

CI's first build of PR E on `main` with PR C (`00849b0`), measured in KB: Home 591.3, Referrals 596.0, ED 548.4, Ward 626.9, Movement 625.0, Capacity 661.7, ED site 686.1, Bed meeting 598.1 and Statistics 644.0. Each limit is now CI's measurement plus 0.2, which replaces the cloud figures above. Against PR C's limits:

- Home `/ward-flow`: 589.1 to 591.5 (+2.4)
- Referrals `/ward-flow/referrals`: 595.3 to 596.2 (+0.9)
- ED `/ward-flow/ed`: 545.8 to 548.6 (+2.8)
- Ward `/ward-flow/ward/rph-adult-secure`: 625.6 to 627.1 (+1.5)
- Movement `/ward-flow/movements/WF-001`: 621.5 to 625.2 (+3.7)
- Capacity `/ward-flow/capacity`: 662.4 to 661.9 (-0.5)
- ED site `/ward-flow/ed/arm-ed`: 680.6 to 686.3 (+5.7)
- Bed meeting `/ward-flow/bed-meeting`: 596.3 to 598.3 (+2.0)
- Statistics `/ward-flow/statistics`: 640.6 to 644.2 (+3.6)

Only the ED site page rises more than 5 KB, under D-202 as above. Statistics now rises 3.6 KB.
